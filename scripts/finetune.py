#!/usr/bin/env python
# QLoRA fine-tune: load a base model in 4-bit, train small LoRA adapters on your examples, merge them back,
# and export a GGUF the app imports into Ollama. Progress is printed as one JSON object per line, so the app
# can show it live. Run: python finetune.py --job <job_dir>  (job_dir holds config.json and data.jsonl).
import argparse, json, os, sys, time

def emit(**k):
    k["t"] = time.time()
    print(json.dumps(k), flush=True)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--job", required=True)
    a = ap.parse_args()
    job = a.job
    cfg = json.load(open(os.path.join(job, "config.json"), encoding="utf-8"))
    base = cfg["base"]; epochs = float(cfg.get("epochs", 3)); lr = float(cfg.get("lr", 2e-4))
    lora_r = int(cfg.get("lora_r", 16)); cutoff = int(cfg.get("cutoff", 1024))
    out = os.path.join(job, "out"); os.makedirs(out, exist_ok=True)

    emit(stage="start", msg="Loading training libraries (torch, transformers, peft, trl)...")
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, TrainerCallback
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
    from datasets import load_dataset
    from trl import SFTTrainer, SFTConfig

    emit(stage="gpu", cuda=torch.cuda.is_available(), device=(torch.cuda.get_device_name(0) if torch.cuda.is_available() else "cpu"))
    if not torch.cuda.is_available():
        emit(stage="error", msg="No CUDA GPU is visible to PyTorch. Training needs the GPU.")
        sys.exit(2)

    emit(stage="load", msg="Loading the base model in 4-bit: " + base)
    bnb = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=torch.bfloat16, bnb_4bit_use_double_quant=True)
    tok = AutoTokenizer.from_pretrained(base)
    if tok.pad_token is None: tok.pad_token = tok.eos_token
    model = AutoModelForCausalLM.from_pretrained(base, quantization_config=bnb, device_map="auto", torch_dtype=torch.bfloat16)
    model = prepare_model_for_kbit_training(model)
    lcfg = LoraConfig(r=lora_r, lora_alpha=lora_r * 2, lora_dropout=0.05, bias="none", task_type="CAUSAL_LM",
                      target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"])
    model = get_peft_model(model, lcfg)
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in model.parameters())
    emit(stage="adapters", trainable=trainable, total=total, msg=f"Training {trainable:,} of {total:,} numbers ({100*trainable/total:.2f}%). The rest stay frozen.")

    ds = load_dataset("json", data_files=os.path.join(job, "data.jsonl"), split="train")
    def fmt(ex):
        if "messages" in ex:
            return {"text": tok.apply_chat_template(ex["messages"], tokenize=False, add_generation_prompt=False)}
        msgs = [{"role": "user", "content": ex.get("prompt", "")}, {"role": "assistant", "content": ex.get("response", "")}]
        return {"text": tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=False)}
    ds = ds.map(fmt)
    emit(stage="data", rows=len(ds), msg=f"{len(ds)} example(s) prepared.")

    class Prog(TrainerCallback):
        def on_log(self, args, state, control, logs=None, **kw):
            if logs and "loss" in logs:
                emit(stage="step", step=state.global_step, total_steps=state.max_steps, loss=round(float(logs["loss"]), 4),
                     epoch=round(float(logs.get("epoch", 0)), 2))

    import inspect
    want = dict(output_dir=os.path.join(job, "ckpt"), num_train_epochs=epochs, per_device_train_batch_size=1,
                gradient_accumulation_steps=8, learning_rate=lr, logging_steps=1, save_strategy="no",
                warmup_ratio=0.05, lr_scheduler_type="cosine", optim="paged_adamw_8bit", bf16=True,
                max_length=cutoff, max_seq_length=cutoff, dataset_text_field="text", report_to=[])
    sig = set(inspect.signature(SFTConfig.__init__).parameters)
    args = SFTConfig(**{k: v for k, v in want.items() if k in sig})   # keep only args this trl version accepts
    trainer = SFTTrainer(model=model, train_dataset=ds, args=args, callbacks=[Prog()])
    emit(stage="train", msg="Training started. Watch the loss fall as it learns your examples.")
    trainer.train()
    emit(stage="merge", msg="Folding the learned adapters back into the model...")
    adir = os.path.join(out, "adapter"); model.save_pretrained(adir)   # save the trained LoRA only
    del model
    import gc; gc.collect()
    try: torch.cuda.empty_cache()
    except Exception: pass
    from peft import PeftModel
    base_fp = AutoModelForCausalLM.from_pretrained(base, dtype=torch.float16, device_map="cpu")   # reload clean fp16, not 4-bit
    merged = PeftModel.from_pretrained(base_fp, adir).merge_and_unload()
    mdir = os.path.join(out, "merged"); merged.save_pretrained(mdir, safe_serialization=True); tok.save_pretrained(mdir)

    emit(stage="gguf", msg="Converting to GGUF for Ollama...")
    conv = os.path.join(os.path.dirname(__file__), "convert_hf_to_gguf.py")
    gguf = os.path.join(out, "model.gguf")
    import subprocess
    r = subprocess.run([sys.executable, conv, mdir, "--outfile", gguf, "--outtype", "f16"], capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(gguf):
        emit(stage="error", msg="GGUF conversion failed: " + (r.stderr or r.stdout)[-500:]); sys.exit(3)
    emit(stage="done", gguf=gguf, msg="Fine-tune complete. Import it into Ollama to use it.")

if __name__ == "__main__":
    try: main()
    except Exception as e:
        emit(stage="error", msg=str(e)[:600]); sys.exit(1)
