#!/usr/bin/env python
# Convert a Model Forge model (GPT-2 style, custom word list) to GGUF with llama.cpp's converter.
# The converter only accepts word lists it already knows; ours is new but uses GPT-2's exact splitting rules,
# so we tell it to treat the pre-tokenizer as "gpt-2". Usage: same arguments as convert_hf_to_gguf.py.
import importlib.util, os, sys
here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("convert_hf_to_gguf", os.path.join(here, "convert_hf_to_gguf.py"))
mod = importlib.util.module_from_spec(spec); sys.modules["convert_hf_to_gguf"] = mod; spec.loader.exec_module(mod)
mod.Model.get_vocab_base_pre = lambda self, tokenizer: "gpt-2"
sys.argv = ["convert_hf_to_gguf.py"] + sys.argv[1:]
mod.main()
