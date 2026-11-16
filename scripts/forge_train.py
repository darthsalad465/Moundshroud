#!/usr/bin/env python
# Model Forge: train a brand-new GPT-2-style language model from random weights on any text.
# 1) learn a word list (BPE tokenizer) from the text, 2) build a model with random numbers, 3) play the
# "guess the next word" game for a set time, printing the loss and sample writing, 4) save and convert to GGUF.
# Progress is one JSON object per line. Run: python forge_train.py --job <dir>  (dir holds config.json, corpus.txt)
import argparse, json, math, os, random, sys, time

def emit(**k):
    k["t"] = time.time(); print(json.dumps(k), flush=True)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--job", required=True); job = ap.parse_args().job
    cfg = json.load(open(os.path.join(job, "config.json"), encoding="utf-8"))
    out = os.path.join(job, "out"); hf_dir = os.path.join(out, "hf"); os.makedirs(hf_dir, exist_ok=True)
    stop_file = os.path.join(job, "STOP")
    if os.path.exists(stop_file): os.remove(stop_file)

    emit(stage="start", msg="Loading the training tools...")
    import torch
    from tokenizers import Tokenizer, models, trainers, pre_tokenizers, decoders
    from transformers import GPT2Config, GPT2LMHeadModel, PreTrainedTokenizerFast
    if not torch.cuda.is_available():
        emit(stage="error", msg="No CUDA GPU is visible to PyTorch."); sys.exit(2)
    dev = "cuda"

    text = open(os.path.join(job, "corpus.txt"), encoding="utf-8", errors="ignore").read()
    if len(text) < 20000:
        emit(stage="error", msg="Not enough text to learn from: add at least about 20,000 characters (a few pages)."); sys.exit(3)
    emit(stage="data", chars=len(text), msg=f"Read {len(text):,} characters of text.")

    # 1. the word list
    emit(stage="tokenizer", msg="Step 1: learning a word list from your text (common words and word-pieces)...")
    tok = Tokenizer(models.BPE())
    tok.pre_tokenizer = pre_tokenizers.ByteLevel(add_prefix_space=False)
    tok.decoder = decoders.ByteLevel()
    EOS = "<|endoftext|>"
    trainer = trainers.BpeTrainer(vocab_size=int(cfg["vocab"]), min_frequency=2, special_tokens=[EOS], initial_alphabet=pre_tokenizers.ByteLevel.alphabet(), show_progress=False)
    step = 1_000_000
    tok.train_from_iterator((text[i:i + step] for i in range(0, len(text), step)), trainer)
    hf_tok = PreTrainedTokenizerFast(tokenizer_object=tok, bos_token=EOS, eos_token=EOS, unk_token=EOS, pad_token=EOS)
    V = len(hf_tok)
    ids = []
    for i in range(0, len(text), step):
        for e in tok.encode_batch([text[i:i + step]]): ids.extend(e.ids)
    data = torch.tensor(ids, dtype=torch.long)
    n_val = max(int(len(data) * 0.02), cfg["ctx"] + 2)
    train_d, val_d = data[:-n_val], data[-n_val:]
    sample_word = tok.decode(ids[:4]).strip() or "The"
    emit(stage="tokens", vocab=V, tokens=len(ids), msg=f"Word list has {V:,} entries. Your text became {len(ids):,} tokens.")

    # 2. the random brain
    ctx = int(cfg["ctx"])
    conf = GPT2Config(vocab_size=V, n_positions=ctx, n_embd=int(cfg["n_embd"]), n_layer=int(cfg["n_layer"]), n_head=int(cfg["n_head"]),
                      bos_token_id=hf_tok.eos_token_id, eos_token_id=hf_tok.eos_token_id)
    model = GPT2LMHeadModel(conf).to(dev)
    params = sum(p.numel() for p in model.parameters())
    emit(stage="model", params=params, msg=f"Step 2: built a brand-new model with {params:,} numbers, all random. Right now it knows nothing.")

    # 3. the guessing game
    bs = int(cfg["batch"]); minutes = float(cfg["minutes"]); lr_max = float(cfg.get("lr", 6e-4))
    opt = torch.optim.AdamW(model.parameters(), lr=lr_max, betas=(0.9, 0.95), weight_decay=0.1)
    def batch(d):
        ix = torch.randint(0, len(d) - ctx - 1, (bs,))
        return torch.stack([d[i:i + ctx] for i in ix]).to(dev)
    def sample(prompt):
        model.eval()
        with torch.no_grad():
            enc = hf_tok(prompt, return_tensors="pt").to(dev)
            g = model.generate(**enc, max_new_tokens=60, do_sample=True, top_k=40, temperature=0.8, pad_token_id=hf_tok.eos_token_id)
        model.train(); return hf_tok.decode(g[0], skip_special_tokens=True)
    emit(stage="train", minutes=minutes, msg=f"Step 3: training for up to {minutes:g} minutes. It reads a chunk, guesses each next word, checks, and adjusts.")
    t0 = time.time(); last_sample = t0; it = 0; warm = 100
    emit(stage="sample", step=0, text=sample(sample_word), msg="Before training (random numbers):")
    model.train()
    while True:
        el = time.time() - t0
        if el > minutes * 60 or os.path.exists(stop_file): break
        frac = min(1.0, el / (minutes * 60))
        lr = lr_max * min(1.0, (it + 1) / warm) * (0.1 + 0.9 * 0.5 * (1 + math.cos(math.pi * frac)))
        for g_ in opt.param_groups: g_["lr"] = lr
        x = batch(train_d)
        with torch.autocast("cuda", dtype=torch.bfloat16):
            loss = model(input_ids=x, labels=x).loss
        loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0); opt.step(); opt.zero_grad(set_to_none=True); it += 1
        if it % 25 == 0:
            emit(stage="step", step=it, loss=round(loss.item(), 4), elapsed=round(el), total=round(minutes * 60), lr=lr)
        if it % 300 == 0:
            model.eval()
            with torch.no_grad(), torch.autocast("cuda", dtype=torch.bfloat16):
                vl = sum(model(input_ids=(v := batch(val_d)), labels=v).loss.item() for _ in range(5)) / 5
            model.train(); emit(stage="val", step=it, val_loss=round(vl, 4))
        if time.time() - last_sample > 75:
            last_sample = time.time(); emit(stage="sample", step=it, text=sample(sample_word), msg=f"What it writes after {it:,} steps:")
    emit(stage="sample", step=it, text=sample(sample_word), msg=f"Finished after {it:,} steps:")

    # 4. save and convert
    emit(stage="save", msg="Step 4: saving the model and converting it for Ollama...")
    model.save_pretrained(hf_dir, safe_serialization=True); hf_tok.save_pretrained(hf_dir)
    cpath = os.path.join(hf_dir, "config.json"); c = json.load(open(cpath, encoding="utf-8"))
    c["n_ctx"] = ctx; json.dump(c, open(cpath, "w", encoding="utf-8"), indent=1)   # the GGUF converter reads n_ctx
    gguf = os.path.join(out, "model.gguf")
    import subprocess
    conv = os.path.join(os.path.dirname(__file__), "forge_convert.py")
    r = subprocess.run([sys.executable, conv, hf_dir, "--outfile", gguf, "--outtype", "f16"], capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(gguf):
        emit(stage="error", msg="GGUF conversion failed: " + (r.stderr or r.stdout)[-600:]); sys.exit(4)
    emit(stage="done", gguf=gguf, steps=it, params=params, msg="Done. Your model is ready to be added to Ollama.")

if __name__ == "__main__":
    try: main()
    except Exception as e:
        emit(stage="error", msg=str(e)[:600]); sys.exit(1)
