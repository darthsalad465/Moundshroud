// Preparedness: household data, readiness checks, "stock up" downloads (offline libraries and models), self-repair.
const fs = require('fs'), path = require('path'), cp = require('child_process'), http = require('http');
const U = require('./util');

const ROOT = path.join(__dirname, '..'), DATA = path.join(ROOT, 'data'), LIB = path.join(ROOT, 'nomad', 'library');
const PREP = path.join(DATA, 'prep.json'), BACKUP = path.join(DATA, 'last-backup.json');
const ps = (cmd, ms = 30000) => new Promise(res => cp.execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd], { windowsHide: true, timeout: ms, maxBuffer: 4e6 }, (e, out) => res(e ? '' : String(out))));

/* ---------- household data (profile, people, contacts, supplies, places) ---------- */
const EMPTY = { profile: { adults: 2, children: 0, pets: 0, days: 7, needs: '', climate: 'temperate', location: null }, people: [], contacts: [], places: { meet1: '', meet2: '', outOfArea: '', shutoffs: '', notes: '' }, supplies: [], done: {} };
function load() { const d = U.readJson(PREP, null); return d && typeof d === 'object' ? Object.assign({}, EMPTY, d, { profile: Object.assign({}, EMPTY.profile, d.profile || {}), places: Object.assign({}, EMPTY.places, d.places || {}) }) : JSON.parse(JSON.stringify(EMPTY)); }
function save(d) {
  if (!d || typeof d !== 'object') return false;
  const clip = (a, n) => (Array.isArray(a) ? a.slice(0, n) : []);
  U.writeJson(PREP, { profile: d.profile || EMPTY.profile, people: clip(d.people, 40), contacts: clip(d.contacts, 500), places: d.places || EMPTY.places, supplies: clip(d.supplies, 800), done: d.done && typeof d.done === 'object' ? d.done : {} }); return true;
}
function noteBackup() { U.writeJson(BACKUP, { at: Date.now() }); }

/* ---------- catalog of things worth stocking up on while the internet works ---------- */
const K = 'https://download.kiwix.org/zim/';
const CATALOG = [
  { id: 'disaster', group: 'Survival', name: 'Post-disaster rebuilding', desc: 'Water, shelter, food, medicine, tools and rebuilding after a disaster', url: K + 'other/zimgit-post-disaster_en_2024-05.zim', mb: 615 },
  { id: 'water', group: 'Survival', name: 'Water purification and storage', desc: 'Making water safe, storing it, finding it', url: K + 'other/zimgit-water_en_2024-08.zim', mb: 20 },
  { id: 'food', group: 'Survival', name: 'Food preparation and preservation', desc: 'Cooking and storing food without a grid', url: K + 'other/zimgit-food-preparation_en_2025-04.zim', mb: 93 },
  { id: 'medicine', group: 'Survival', name: 'Field medicine guides', desc: 'Practical treatment guides for when help is far away', url: K + 'other/zimgit-medicine_en_2024-08.zim', mb: 67 },
  { id: 'knots', group: 'Survival', name: 'Knots', desc: 'Illustrated knot guides', url: K + 'other/zimgit-knots_en_2024-08.zim', mb: 27 },
  { id: 'appropedia', group: 'Survival', name: 'Appropedia (low-tech solutions)', desc: 'Solar power, water, sanitation, cooking, building', url: K + 'other/appropedia_en_all_maxi_2026-02.zim', mb: 555 },
  { id: 'trueprepper', group: 'Survival', name: 'TruePrepper', desc: 'Preparedness plans, gear and how-tos', url: K + 'other/trueprepper.com_en_all_2026-05.zim', mb: 1358 },
  { id: 'outdoors', group: 'Skills', name: 'Outdoors Q&A', desc: 'Shelter, navigation, fire, camping, hiking', url: K + 'stack_exchange/outdoors.stackexchange.com_en_all_2026-10.zim', mb: 135 },
  { id: 'ham', group: 'Skills', name: 'Ham radio Q&A', desc: 'Radios, antennas, licensing, emergency comms', url: K + 'stack_exchange/ham.stackexchange.com_en_all_2026-10.zim', mb: 74 },
  { id: 'mechanics', group: 'Skills', name: 'Car repair Q&A', desc: 'Keeping a vehicle running', url: K + 'stack_exchange/mechanics.stackexchange.com_en_all_2026-10.zim', mb: 326 },
  { id: 'gardening', group: 'Skills', name: 'Gardening Q&A', desc: 'Growing food, soil, pests, seasons', url: K + 'stack_exchange/gardening.stackexchange.com_en_all_2026-10.zim', mb: 890 },
  { id: 'electronics', group: 'Skills', name: 'Electronics Q&A', desc: 'Circuits, batteries, repairs (large)', url: K + 'stack_exchange/electronics.stackexchange.com_en_all_2026-10.zim', mb: 4096 },
  { id: 'ifixit', group: 'Skills', name: 'iFixit repair guides', desc: 'Phones, laptops, appliances, vehicles (large)', url: K + 'ifixit/ifixit_en_all_2025-12.zim', mb: 3380 },
  { id: 'g-medicine', group: 'Books', name: 'Gutenberg: Medicine', desc: 'Thousands of public-domain medical and health books', url: K + 'gutenberg/gutenberg_en_lcc-r_2026-03.zim', mb: 1926 },
  { id: 'g-agri', group: 'Books', name: 'Gutenberg: Agriculture, hunting and fishing', desc: 'Farming, animals, gardening, preserving, hunting, fishing', url: K + 'gutenberg/gutenberg_en_lcc-s_2026-03.zim', mb: 4323 },
  { id: 'g-military', group: 'Books', name: 'Gutenberg: Military science', desc: 'Field craft, drill manuals, fortification, history', url: K + 'gutenberg/gutenberg_en_lcc-u_2026-03.zim', mb: 1228 },
  { id: 'g-naval', group: 'Books', name: 'Gutenberg: Naval science', desc: 'Navigation, seamanship, boats', url: K + 'gutenberg/gutenberg_en_lcc-v_2026-03.zim', mb: 1305 },
  { id: 'g-tech', group: 'Books', name: 'Gutenberg: Technology (large)', desc: 'Engineering, building, electricity, radio, trades, home economics', url: K + 'gutenberg/gutenberg_en_lcc-t_2026-03.zim', mb: 12288 },
  { id: 'g-geo', group: 'Books', name: 'Gutenberg: Geography and recreation', desc: 'Travel, camping, maps, customs', url: K + 'gutenberg/gutenberg_en_lcc-g_2026-03.zim', mb: 7680 },
  { id: 'g-lit-general', group: 'Classics', name: 'Gutenberg: Literature (general)', desc: 'Guides and histories of literature', url: K + 'gutenberg/gutenberg_en_lcc-p_2026-03.zim', mb: 37 },
  { id: 'g-lit-russian', group: 'Classics', name: 'Gutenberg: Russian literature', desc: 'Tolstoy, Dostoevsky, Chekhov, Turgenev, Gogol', url: K + 'gutenberg/gutenberg_en_lcc-pg_2026-03.zim', mb: 261 },
  { id: 'g-lit-german', group: 'Classics', name: 'Gutenberg: German literature', desc: 'Goethe, Schiller, Kafka, Grimm fairy tales', url: K + 'gutenberg/gutenberg_en_lcc-pt_2026-03.zim', mb: 724 },
  { id: 'g-lit-classical', group: 'Classics', name: 'Gutenberg: Greek and Latin classics', desc: 'Homer, Plato, Virgil, Ovid, Greek tragedy', url: K + 'gutenberg/gutenberg_en_lcc-pa_2026-03.zim', mb: 498 },
  { id: 'g-lit-romance', group: 'Classics', name: 'Gutenberg: French, Italian and Spanish literature', desc: 'Dante, Cervantes, Hugo, Dumas, Flaubert, Moliere', url: K + 'gutenberg/gutenberg_en_lcc-pq_2026-03.zim', mb: 3800 },
  { id: 'g-lit-world', group: 'Classics', name: 'Gutenberg: Poetry, drama and story collections', desc: 'Anthologies, plays, poems, folk tales, short stories from everywhere', url: K + 'gutenberg/gutenberg_en_lcc-pn_2026-03.zim', mb: 3000 },
  { id: 'g-lit-english', group: 'Classics', name: 'Gutenberg: English literature (large)', desc: 'Shakespeare, Dickens, Austen, the Brontes, Wilde, Conan Doyle, Wells', url: K + 'gutenberg/gutenberg_en_lcc-pr_2026-03.zim', mb: 15000, optional: true },
  { id: 'g-lit-american', group: 'Classics', name: 'Gutenberg: American literature (large)', desc: 'Twain, Poe, Melville, Hawthorne, Alcott, London, Whitman', url: K + 'gutenberg/gutenberg_en_lcc-ps_2026-03.zim', mb: 15000, optional: true },
  { id: 'g-fiction', group: 'Classics', name: 'Gutenberg: Fiction and juvenile (large)', desc: 'Adventure, mystery, sci-fi and children\'s stories, many short stories', url: K + 'gutenberg/gutenberg_en_lcc-pz_2026-03.zim', mb: 18000, optional: true },
  { id: 'wikibooks', group: 'Books', name: 'Wikibooks (no pictures)', desc: 'Free textbooks, cookbooks and manuals', url: K + 'wikibooks/wikibooks_en_all_nopic_2026-04.zim', mb: 3345 },
  { id: 'wikivoyage', group: 'Books', name: 'Wikivoyage travel guides', desc: 'Places, transport and local tips (large)', url: K + 'wikivoyage/wikivoyage_en_all_maxi_2026-09.zim', mb: 1100, optional: true },
];
/* ---------- the AI models that can be added ----------
   Two kinds. The Ollama library takes a name and pulls it. Hugging Face takes one .gguf file: it is downloaded,
   checked to really be GGUF, and handed to Ollama, which makes it a model of this PC straight away, so it shows
   up in Chat (and everywhere else) as soon as the download finishes, with no restart. Sizes are the usual
   Q4_K_M file, which is the size asked for below; if a repo has no file of that size the nearest one is taken. */
const hf = require('./hf-gguf');
const H = (group, repo, quant, name, desc, mb) => ({ group, id: hf.nameOf(repo, quant), hf: { repo, quant }, name, desc, mb });
const MODELS = [
  /* --- popular: the models people are most often told to try, newest and best first --- */
  H('Popular models', 'unsloth/Qwen3-14B-GGUF', 'Q4_K_M', 'Qwen3 14B', 'A real step up from 7B for reasoning, coding and long answers, and still comfortable on a 16 GB PC.', 8585),
  H('Popular models', 'unsloth/Qwen3-30B-A3B-GGUF', 'Q4_K_M', 'Qwen3 30B A3B', 'Mixture of experts: answers like a 30B while only 3B runs at a time, so it stays quick for a big model.', 17697),
  H('Popular models', 'unsloth/gemma-3-12b-it-GGUF', 'Q4_K_M', 'Gemma 3 12B', 'Google’s mid-size Gemma 3: strong writing, pictures, tools and 140+ languages.', 6963),
  H('Popular models', 'unsloth/gemma-3-27b-it-GGUF', 'Q4_K_M', 'Gemma 3 27B', 'The largest Gemma 3 that still runs at home: excellent prose, for a PC with 24 GB or more.', 15780),
  H('Popular models', 'unsloth/DeepSeek-R1-0528-Qwen3-8B-GGUF', 'Q4_K_M', 'DeepSeek R1 0528 8B', 'DeepSeek’s 2025 reasoning model at 8B: it shows its working before answering, good for maths and logic.', 4795),
  H('Popular models', 'unsloth/Mistral-Small-3.1-24B-Instruct-2503-GGUF', 'Q4_K_M', 'Mistral Small 3.1 24B', 'Mistral’s newest small model: fast, good with code and instructions, and it can read pictures.', 13670),
  H('Popular models', 'unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF', 'Q4_K_M', 'Qwen3 Coder 30B A3B', 'One of the best open coding models, and quick because only about 3B of it runs per word.', 17697),
  H('Popular models', 'unsloth/Llama-3.1-8B-Instruct-GGUF', 'Q4_K_M', 'Llama 3.1 8B (official files)', 'Meta’s 8B straight from the original weights: dependable answers and a 128K memory of the conversation.', 4693),
  H('Popular models', 'bartowski/DeepSeek-R1-Distill-Qwen-32B-GGUF', 'Q4_K_M', 'DeepSeek R1 Distill 32B', 'Reasoning at 32B: the strongest R1 distillation most big PCs can run. Wants 24 GB of memory.', 18932),
  H('Popular models', 'bartowski/Qwen2.5-14B-Instruct-1M-GGUF', 'Q4_K_M', 'Qwen2.5 14B (1M context)', 'A 14B model that can hold a whole book, or a large codebase, in a single prompt.', 8572),
  H('Popular models', 'bartowski/granite-3.1-8b-instruct-GGUF', 'Q4_K_M', 'Granite 3.1 8B', 'IBM’s business model: tidy answers, tools and retrieval, on a clean licence for work.', 4714),
  H('Popular models', 'unsloth/Qwen3-4B-Instruct-2507-GGUF', 'Q4_K_M', 'Qwen3 4B Instruct (2507)', 'The newest Qwen3 4B: better at following instructions, small enough to run on a laptop.', 2382),
  /* --- tiny: fast on any PC, no graphics card, easy on battery --- */
  H('Tiny and low-power', 'bartowski/SmolLM2-135M-Instruct-GGUF', 'Q4_K_M', 'SmolLM2 135M', 'The smallest useful chat model: instant answers, tiny memory. Good for tests and very old PCs.', 105),
  H('Tiny and low-power', 'bartowski/SmolLM2-360M-Instruct-GGUF', 'Q4_K_M', 'SmolLM2 360M', 'Very small and quick; short answers, simple questions.', 271),
  H('Tiny and low-power', 'bartowski/Qwen2.5-0.5B-Instruct-GGUF', 'Q4_K_M', 'Qwen2.5 0.5B', 'Half a billion parameters: fast, and surprisingly good at following instructions.', 398),
  H('Tiny and low-power', 'bartowski/SmolLM2-1.7B-Instruct-GGUF', 'Q4_K_M', 'SmolLM2 1.7B', 'A small model that still chats sensibly. The best pick for Low-power mode on a laptop.', 1060),
  H('Tiny and low-power', 'bartowski/Llama-3.2-1B-Instruct-GGUF', 'Q4_K_M', 'Llama 3.2 1B', 'Meta’s one-billion model: good summaries and rewrites with very little memory.', 808),
  /* --- everyday chat --- */
  H('Everyday chat', 'bartowski/Qwen2.5-1.5B-Instruct-GGUF', 'Q4_K_M', 'Qwen2.5 1.5B', 'A quick everyday model for questions, lists and short writing.', 986),
  H('Everyday chat', 'bartowski/gemma-2-2b-it-GGUF', 'Q4_K_M', 'Gemma 2 2B', 'Google’s small model: friendly, clear English, works on a modest PC.', 1640),
  H('Everyday chat', 'bartowski/Qwen2.5-3B-Instruct-GGUF', 'Q4_K_M', 'Qwen2.5 3B', 'A good all-round small model: solid answers and fast enough to feel instant.', 1930),
  H('Everyday chat', 'unsloth/Llama-3.2-3B-Instruct-GGUF', 'Q4_K_M', 'Llama 3.2 3B', 'Meta’s 3B model: strong writing and conversation for its size.', 2020),
  H('Everyday chat', 'bartowski/Phi-3.5-mini-instruct-GGUF', 'Q4_K_M', 'Phi-3.5 mini', 'Microsoft’s 3.8B model: excellent at reasoning for its size, 128K memory of the conversation.', 2490),
  H('Everyday chat', 'unsloth/Phi-4-mini-instruct-GGUF', 'Q4_K_M', 'Phi-4 mini', 'Microsoft’s newer small model: better maths and instructions than Phi-3.5 at the same size.', 2490),
  H('Everyday chat', 'unsloth/gemma-3-4b-it-GGUF', 'Q4_K_M', 'Gemma 3 4B', 'Google’s Gemma 3: chat, writing and questions, with a very large context window.', 2480),
  H('Everyday chat', 'Qwen/Qwen3-4B-GGUF', 'Q4_K_M', 'Qwen3 4B', 'The official Qwen3 4B file: quick thinking mode, strong for its size.', 2510),
  H('Everyday chat', 'bartowski/Mistral-7B-Instruct-v0.3-GGUF', 'Q4_K_M', 'Mistral 7B Instruct v0.3', 'Mistral’s classic 7B: tidy, direct writing and good summaries.', 4370),
  H('Everyday chat', 'TheBloke/Mistral-7B-Instruct-v0.2-GGUF', 'Q4_K_M', 'Mistral 7B Instruct v0.2', 'The older Mistral 7B, kept for anyone who prefers its style.', 4370),
  H('Everyday chat', 'TheBloke/Llama-2-7B-Chat-GGUF', 'Q4_K_M', 'Llama 2 7B Chat', 'Meta’s Llama 2: plain, careful answers. Lighter on memory than 8B models.', 3820),
  H('Everyday chat', 'bartowski/Qwen2.5-7B-Instruct-GGUF', 'Q4_K_M', 'Qwen2.5 7B', 'A very strong 7B all-rounder: writing, questions, summaries and tools.', 4680),
  H('Everyday chat', 'bartowski/Starling-LM-7B-beta-GGUF', 'Q4_K_M', 'Starling 7B', 'Tuned for helpful, ranked answers; pleasant everyday conversation.', 4680),
  H('Everyday chat', 'bartowski/Meta-Llama-3.1-8B-Instruct-GGUF', 'Q4_K_M', 'Llama 3.1 8B', 'The most widely used open 8B model: dependable answers, good with long text.', 4930),
  H('Everyday chat', 'bartowski/Hermes-3-Llama-3.1-8B-GGUF', 'Q4_K_M', 'Hermes 3 8B', 'Llama 3.1 8B tuned for direct, role-play friendly answers and tool use.', 4930),
  H('Everyday chat', 'bartowski/dolphin-2.9.4-llama3.1-8b-GGUF', 'Q4_K_M', 'Dolphin 2.9 8B', 'A Llama 3.1 8B tuned to answer without refusing; good for creative and blunt writing.', 4930),
  H('Everyday chat', 'bartowski/aya-expanse-8b-GGUF', 'Q4_K_M', 'Aya Expanse 8B', 'Cohere’s 8B model, strong in many languages: useful for translation and the Languages tab.', 4930),
  H('Everyday chat', 'unsloth/Qwen3-8B-GGUF', 'Q4_K_M', 'Qwen3 8B', 'Qwen3 at 8B: a visible thinking mode and very solid general answers.', 5020),
  H('Everyday chat', 'bartowski/gemma-2-9b-it-GGUF', 'Q4_K_M', 'Gemma 2 9B', 'Google’s 9B model: warm, well-written answers; a favourite for letters and stories.', 5760),
  H('Everyday chat', 'bartowski/glm-4-9b-chat-GGUF', 'Q4_K_M', 'GLM-4 9B Chat', 'Zhipu’s 9B chat model: strong bilingual answers and long documents.', 5900),
  H('Everyday chat', 'bartowski/Mistral-Nemo-Instruct-2407-GGUF', 'Q4_K_M', 'Mistral Nemo 12B', 'A 12B model with a huge context window: good for long books and notes.', 7250),
  /* --- coding --- */
  H('Coding', 'bartowski/Qwen2.5-Coder-0.5B-Instruct-GGUF', 'Q4_K_M', 'Qwen2.5 Coder 0.5B', 'Tiny coding helper: quick snippets and explanations.', 398),
  H('Coding', 'bartowski/Qwen2.5-Coder-1.5B-Instruct-GGUF', 'Q4_K_M', 'Qwen2.5 Coder 1.5B', 'Small but genuinely useful for reading code and small fixes.', 986),
  H('Coding', 'bartowski/Qwen2.5-Coder-7B-Instruct-GGUF', 'Q4_K_M', 'Qwen2.5 Coder 7B', 'One of the best 7B coding models: write, explain and fix code on this PC.', 4680),
  H('Coding', 'bartowski/Qwen2.5-Coder-14B-Instruct-GGUF', 'Q4_K_M', 'Qwen2.5 Coder 14B', 'Much stronger coding and refactoring; wants 16 GB of memory.', 8980),
  H('Coding', 'bartowski/Qwen2.5-Coder-32B-Instruct-GGUF', 'Q4_K_M', 'Qwen2.5 Coder 32B', 'Near the best open coding model; needs a big PC or graphics card.', 19800),
  H('Coding', 'bartowski/DeepSeek-Coder-V2-Lite-Instruct-GGUF', 'Q4_K_M', 'DeepSeek Coder V2 Lite', 'DeepSeek’s mixture-of-experts coder: only part of it runs at a time, so it is quick for its skill.', 10300),
  /* --- reasoning and maths --- */
  H('Reasoning and maths', 'bartowski/DeepSeek-R1-Distill-Qwen-1.5B-GGUF', 'Q4_K_M', 'DeepSeek R1 Distill 1.5B', 'A tiny model that thinks step by step before answering: puzzles and simple maths.', 1120),
  H('Reasoning and maths', 'bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF', 'Q4_K_M', 'DeepSeek R1 Distill 7B', 'Reasoning at 7B: works problems out in the open before it answers.', 4680),
  H('Reasoning and maths', 'bartowski/DeepSeek-R1-Distill-Llama-8B-GGUF', 'Q4_K_M', 'DeepSeek R1 Distill Llama 8B', 'The 8B reasoning model most people use offline: maths, logic and careful answers.', 4930),
  H('Reasoning and maths', 'bartowski/Qwen2.5-Math-7B-Instruct-GGUF', 'Q4_K_M', 'Qwen2.5 Math 7B', 'Built for arithmetic and algebra: use it for the Calculator and homework.', 4680),
  H('Reasoning and maths', 'bartowski/DeepSeek-R1-Distill-Qwen-14B-GGUF', 'Q4_K_M', 'DeepSeek R1 Distill 14B', 'Strong reasoning at 14B for hard questions and long chains of thought.', 8980),
  H('Reasoning and maths', 'bartowski/phi-4-GGUF', 'Q4_K_M', 'Phi-4 14B', 'Microsoft’s Phi-4: excellent at maths, science and exam-style questions.', 9100),
  /* --- pictures --- */
  H('Pictures (vision)', 'bartowski/Qwen2-VL-2B-Instruct-GGUF', 'Q4_K_M', 'Qwen2-VL 2B', 'Small model that can see: describe a photo, read a sign or a receipt. Qwen draws illustrations too.', 1620),
  H('Pictures (vision)', 'bartowski/Qwen2-VL-7B-Instruct-GGUF', 'Q4_K_M', 'Qwen2-VL 7B', 'A sharper seeing model: photos, screenshots, diagrams and handwriting.', 4640),
  /* --- embeddings: the models behind Search and memory --- */
  H('Search and memory (embeddings)', 'nomic-ai/nomic-embed-text-v1.5-GGUF', 'Q4_K_M', 'Nomic Embed Text v1.5', 'Turns text into numbers so Search finds pages that mean the same thing. The usual choice.', 274),
  H('Search and memory (embeddings)', 'CompendiumLabs/bge-small-en-v1.5-gguf', 'Q4_K_M', 'BGE Small (English)', 'A very small search model: fast, good for English libraries and notes.', 66),
  H('Search and memory (embeddings)', 'CompendiumLabs/bge-large-en-v1.5-gguf', 'Q4_K_M', 'BGE Large (English)', 'A larger search model: better matches in big collections, slower.', 670),
  H('Search and memory (embeddings)', 'second-state/All-MiniLM-L6-v2-Embedding-GGUF', 'Q4_K_M', 'All-MiniLM-L6-v2', 'The smallest embedding model: instant, fine for short notes and bookmarks.', 45),
  /* --- big models, for a big PC --- */
  H('Wide and large (a big PC)', 'bartowski/Mistral-Small-24B-Instruct-2501-GGUF', 'Q4_K_M', 'Mistral Small 24B', 'A modern 24B model: strong writing, coding and reasoning. Wants 24 GB of memory.', 14300),
  H('Wide and large (a big PC)', 'bartowski/gemma-2-27b-it-GGUF', 'Q4_K_M', 'Gemma 2 27B', 'Google’s 27B model: a big step up in quality, for a machine with lots of memory.', 17000),
  H('Wide and large (a big PC)', 'bartowski/Qwen2.5-32B-Instruct-GGUF', 'Q4_K_M', 'Qwen2.5 32B', 'One of the best open models: near the top of the local leaderboards.', 19800),
  H('Wide and large (a big PC)', 'bartowski/Meta-Llama-3.1-70B-Instruct-GGUF', 'Q4_K_M', 'Llama 3.1 70B', 'The full-size Llama: slow, needs 48 GB or more, and answers like a large service.', 42500),
  H('Wide and large (a big PC)', 'bartowski/Llama-3.3-70B-Instruct-GGUF', 'Q4_K_M', 'Llama 3.3 70B', 'Meta’s newest 70B: excellent general answers. Needs a very big PC.', 42500),
  H('Wide and large (a big PC)', 'bartowski/Qwen2.5-72B-Instruct-GGUF', 'Q4_K_M', 'Qwen2.5 72B', 'A 72B model that rivals online services, for a workstation with 48 GB of memory.', 47000),
  H('Wide and large (a big PC)', 'bartowski/Mistral-Large-Instruct-2411-GGUF', 'Q2_K_L', 'Mistral Large 123B', 'Mistral’s largest open model. Only the most compressed file fits on a normal PC, so it is a heavy download and needs a very big machine.', 41500),
  /* --- underground: lesser-known models that are genuinely worth the download --- */
  H('Underground (lesser known)', 'mradermacher/Cydonia-24B-v4.1-i1-GGUF', 'Q4_K_M', 'Cydonia 24B v4.1', 'A community favourite for creative writing and role-play, sharper than its size suggests.', 13670),
  H('Underground (lesser known)', 'mradermacher/NemoMix-Unleashed-12B-i1-GGUF', 'Q4_K_M', 'NemoMix Unleashed 12B', 'A well-regarded community merge: rich, natural prose and strong character voices.', 7131),
  H('Underground (lesser known)', 'mradermacher/Rocinante-12B-v1.1-i1-GGUF', 'Q4_K_M', 'Rocinante 12B v1.1', 'Tuned for stories and description: a good writer that very few people have heard of.', 7131),
  H('Underground (lesser known)', 'mradermacher/Chronos-Gold-12B-1.0-i1-GGUF', 'Q4_K_M', 'Chronos Gold 12B', 'A patient, chatty 12B for conversation and role-play, popular in small communities.', 7131),
  H('Underground (lesser known)', 'mradermacher/Fimbulvetr-11B-v2-i1-GGUF', 'Q4_K_M', 'Fimbulvetr 11B v2', 'Made for atmosphere and description: slower, careful prose rather than quick answers.', 6310),
  H('Underground (lesser known)', 'mradermacher/Lumimaid-v0.2-8B-i1-GGUF', 'Q4_K_M', 'Lumimaid v0.2 8B', 'A friendly 8B chat model tuned by hand: warm conversation without a big download.', 4693),
  H('Underground (lesser known)', 'mradermacher/L3-8B-Stheno-v3.2-i1-GGUF', 'Q4_K_M', 'L3 Stheno v3.2 8B', 'Role-play and dialogue at 8B: keeps a character consistent through a long chat.', 4693),
  H('Underground (lesser known)', 'mradermacher/Qwen2.5-7B-Instruct-abliterated-i1-GGUF', 'Q4_K_M', 'Qwen2.5 7B Abliterated', 'The same strong 7B with its refusals removed: blunt answers and no lectures.', 4466),
  H('Underground (lesser known)', 'mradermacher/Hermes-2-Pro-Mistral-7B-i1-GGUF', 'Q4_K_M', 'Hermes 2 Pro 7B', 'Still one of the best small models at calling tools and writing clean JSON.', 4166),
  H('Underground (lesser known)', 'mradermacher/Griffin-3B-i1-GGUF', 'Q4_K_M', 'Griffin 3B', 'A tiny creative writer: short stories and poems on a laptop with no graphics card.', 2461),
  H('Underground (lesser known)', 'bartowski/Llama-3-8B-Instruct-Gradient-1048k-GGUF', 'Q4_K_M', 'Llama 3 8B (very long context)', 'An 8B built for enormous documents: whole manuals and transcripts in one prompt.', 4693),
  H('Underground (lesser known)', 'DavidAU/Llama-3.2-8X3B-MOE-Dark-Champion-Instruct-uncensored-abliterated-18.4B-GGUF', 'Q4_K_M', 'Dark Champion 18.4B (community merge)', 'A fan-built mixture-of-experts merge: strong storytelling at about 3B speed.', 10789),
  /* --- straight from the Ollama library, no Hugging Face needed --- */
  { id: 'qwen3.5:2b', name: 'Qwen3.5 2B (low-power)', desc: 'Light on battery and memory; supports pictures and tools', mb: 2700, group: 'Ollama library' },
  { id: 'qwen3.5:0.8b', name: 'Qwen3.5 0.8B (tiny)', desc: 'Smallest and fastest, much less capable', mb: 1200, group: 'Ollama library' },
  { id: 'qwen3.5:4b', name: 'Qwen3.5 4B (best of the small family)', desc: 'The sharpest small model; wants about 8 GB of memory', mb: 4900, group: 'Ollama library' },
];
/* ---------- the numbers for each model: size in parameters, how much text it can hold at once, and its licence ----------
   Kept beside the list (rather than inside every row) so the names, descriptions and sizes above stay easy to read. */
const STATS = {
  'bartowski/SmolLM2-135M-Instruct-GGUF': '135M parameters · 8K context · Apache-2.0',
  'bartowski/SmolLM2-360M-Instruct-GGUF': '360M parameters · 8K context · Apache-2.0',
  'bartowski/Qwen2.5-0.5B-Instruct-GGUF': '0.5B parameters · 32K context · Apache-2.0',
  'bartowski/SmolLM2-1.7B-Instruct-GGUF': '1.7B parameters · 8K context · Apache-2.0',
  'bartowski/Llama-3.2-1B-Instruct-GGUF': '1B parameters · 128K context · Llama 3.2 licence',
  'bartowski/Qwen2.5-1.5B-Instruct-GGUF': '1.5B parameters · 32K context · Apache-2.0',
  'bartowski/gemma-2-2b-it-GGUF': '2B parameters · 8K context · Gemma licence',
  'bartowski/Qwen2.5-3B-Instruct-GGUF': '3B parameters · 32K context · Qwen research licence (not for commercial use)',
  'unsloth/Llama-3.2-3B-Instruct-GGUF': '3B parameters · 128K context · Llama 3.2 licence',
  'bartowski/Phi-3.5-mini-instruct-GGUF': '3.8B parameters · 128K context · MIT',
  'unsloth/Phi-4-mini-instruct-GGUF': '3.8B parameters · 128K context · MIT',
  'unsloth/gemma-3-4b-it-GGUF': '4B parameters · 128K context · Gemma licence · 140+ languages',
  'Qwen/Qwen3-4B-GGUF': '4B parameters · 32K context (131K with YaRN) · Apache-2.0 · thinking mode',
  'bartowski/Mistral-7B-Instruct-v0.3-GGUF': '7B parameters · 32K context · Apache-2.0',
  'TheBloke/Mistral-7B-Instruct-v0.2-GGUF': '7B parameters · 32K context · Apache-2.0',
  'TheBloke/Llama-2-7B-Chat-GGUF': '7B parameters · 4K context · Llama 2 licence',
  'bartowski/Qwen2.5-7B-Instruct-GGUF': '7B parameters · 32K context · Apache-2.0',
  'bartowski/Starling-LM-7B-beta-GGUF': '7B parameters · 8K context · Apache-2.0',
  'bartowski/Meta-Llama-3.1-8B-Instruct-GGUF': '8B parameters · 128K context · Llama 3.1 licence',
  'bartowski/Hermes-3-Llama-3.1-8B-GGUF': '8B parameters · 128K context · Llama 3.1 licence',
  'bartowski/dolphin-2.9.4-llama3.1-8b-GGUF': '8B parameters · 128K context · Llama 3.1 licence',
  'bartowski/aya-expanse-8b-GGUF': '8B parameters · 8K context · CC-BY-NC 4.0 (not for commercial use) · 23 languages',
  'unsloth/Qwen3-8B-GGUF': '8B parameters · 32K context (131K with YaRN) · Apache-2.0 · thinking mode',
  'bartowski/gemma-2-9b-it-GGUF': '9B parameters · 8K context · Gemma licence',
  'bartowski/glm-4-9b-chat-GGUF': '9B parameters · 128K context · GLM-4 licence',
  'bartowski/Mistral-Nemo-Instruct-2407-GGUF': '12B parameters · 128K context · Apache-2.0',
  'bartowski/Qwen2.5-Coder-0.5B-Instruct-GGUF': '0.5B parameters · 32K context · Apache-2.0',
  'bartowski/Qwen2.5-Coder-1.5B-Instruct-GGUF': '1.5B parameters · 32K context · Apache-2.0',
  'bartowski/Qwen2.5-Coder-7B-Instruct-GGUF': '7B parameters · 32K context · Apache-2.0',
  'bartowski/Qwen2.5-Coder-14B-Instruct-GGUF': '14B parameters · 32K context · Apache-2.0',
  'bartowski/Qwen2.5-Coder-32B-Instruct-GGUF': '32B parameters · 32K context · Apache-2.0',
  'bartowski/DeepSeek-Coder-V2-Lite-Instruct-GGUF': '16B parameters, 2.4B used per word (mixture of experts) · 128K context · DeepSeek licence',
  'bartowski/DeepSeek-R1-Distill-Qwen-1.5B-GGUF': '1.5B parameters · 32K context · MIT · shows its reasoning',
  'bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF': '7B parameters · 32K context · MIT · shows its reasoning',
  'bartowski/DeepSeek-R1-Distill-Llama-8B-GGUF': '8B parameters · 128K context · MIT · shows its reasoning',
  'bartowski/Qwen2.5-Math-7B-Instruct-GGUF': '7B parameters · 4K context · Apache-2.0',
  'bartowski/DeepSeek-R1-Distill-Qwen-14B-GGUF': '14B parameters · 32K context · MIT · shows its reasoning',
  'bartowski/phi-4-GGUF': '14B parameters · 16K context · MIT',
  'bartowski/Qwen2-VL-2B-Instruct-GGUF': '2B parameters · 32K context · Apache-2.0 · reads pictures',
  'bartowski/Qwen2-VL-7B-Instruct-GGUF': '7B parameters · 32K context · Apache-2.0 · reads pictures',
  'nomic-ai/nomic-embed-text-v1.5-GGUF': '137M parameters · 8K tokens at a time · Apache-2.0 · search and memory',
  'CompendiumLabs/bge-small-en-v1.5-gguf': '33M parameters · 512 tokens at a time · MIT · search and memory',
  'CompendiumLabs/bge-large-en-v1.5-gguf': '335M parameters · 512 tokens at a time · MIT · search and memory',
  'second-state/All-MiniLM-L6-v2-Embedding-GGUF': '22M parameters · 256 tokens at a time · Apache-2.0 · search and memory',
  'bartowski/Mistral-Small-24B-Instruct-2501-GGUF': '24B parameters · 128K context · Apache-2.0',
  'bartowski/gemma-2-27b-it-GGUF': '27B parameters · 8K context · Gemma licence',
  'bartowski/Qwen2.5-32B-Instruct-GGUF': '32B parameters · 32K context · Apache-2.0',
  'bartowski/Meta-Llama-3.1-70B-Instruct-GGUF': '70B parameters · 128K context · Llama 3.1 licence',
  'bartowski/Llama-3.3-70B-Instruct-GGUF': '70B parameters · 128K context · Llama 3.3 licence',
  'bartowski/Qwen2.5-72B-Instruct-GGUF': '72B parameters · 32K context · Qwen licence',
  'bartowski/Mistral-Large-Instruct-2411-GGUF': '123B parameters · 128K context · Mistral research licence (not for commercial use)',
  'qwen3.5:2b': '2B parameters · pictures and tools · low-power model',
  'qwen3.5:0.8b': '0.8B parameters · the smallest option · low-power model',
  'qwen3.5:4b': '4B parameters · pictures and tools · the best of the small family',
  'unsloth/Qwen3-14B-GGUF': '14B parameters · 32K context (131K with YaRN) · Apache-2.0 · thinking mode',
  'unsloth/Qwen3-30B-A3B-GGUF': '30B parameters, 3B used per word (mixture of experts) · 32K context · Apache-2.0',
  'unsloth/gemma-3-12b-it-GGUF': '12B parameters · 128K context · Gemma licence · 140+ languages',
  'unsloth/gemma-3-27b-it-GGUF': '27B parameters · 128K context · Gemma licence · reads pictures',
  'unsloth/DeepSeek-R1-0528-Qwen3-8B-GGUF': '8B parameters · 128K context · MIT · shows its reasoning',
  'unsloth/Mistral-Small-3.1-24B-Instruct-2503-GGUF': '24B parameters · 128K context · Apache-2.0 · reads pictures',
  'unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF': '30B parameters, 3.3B used per word (mixture of experts) · 256K context · Apache-2.0',
  'unsloth/Llama-3.1-8B-Instruct-GGUF': '8B parameters · 128K context · Llama 3.1 licence',
  'bartowski/DeepSeek-R1-Distill-Qwen-32B-GGUF': '32B parameters · 32K context · MIT · shows its reasoning',
  'bartowski/Qwen2.5-14B-Instruct-1M-GGUF': '14B parameters · up to 1M context · Apache-2.0',
  'bartowski/granite-3.1-8b-instruct-GGUF': '8B parameters · 128K context · Apache-2.0 · tools and retrieval',
  'unsloth/Qwen3-4B-Instruct-2507-GGUF': '4B parameters · 262K context · Apache-2.0',
  'mradermacher/Cydonia-24B-v4.1-i1-GGUF': '24B parameters · 32K context · Apache-2.0 · creative writing',
  'mradermacher/NemoMix-Unleashed-12B-i1-GGUF': '12B parameters · 128K context · Apache-2.0 · creative writing',
  'mradermacher/Rocinante-12B-v1.1-i1-GGUF': '12B parameters · 128K context · Apache-2.0 · storytelling',
  'mradermacher/Chronos-Gold-12B-1.0-i1-GGUF': '12B parameters · 32K context · Apache-2.0 · chat and role-play',
  'mradermacher/Fimbulvetr-11B-v2-i1-GGUF': '11B parameters · 32K context · Apache-2.0 · prose and description',
  'mradermacher/Lumimaid-v0.2-8B-i1-GGUF': '8B parameters · 32K context · Llama 3 licence · chat',
  'mradermacher/L3-8B-Stheno-v3.2-i1-GGUF': '8B parameters · 8K context · Llama 3 licence · role-play',
  'mradermacher/Qwen2.5-7B-Instruct-abliterated-i1-GGUF': '7B parameters · 32K context · Apache-2.0 · answers without refusals',
  'mradermacher/Hermes-2-Pro-Mistral-7B-i1-GGUF': '7B parameters · 32K context · Apache-2.0 · tools and JSON',
  'mradermacher/Griffin-3B-i1-GGUF': '3B parameters · 32K context · Apache-2.0 · creative writing',
  'bartowski/Llama-3-8B-Instruct-Gradient-1048k-GGUF': '8B parameters · up to 1M-token context · Llama 3 licence · very long documents',
  'DavidAU/Llama-3.2-8X3B-MOE-Dark-Champion-Instruct-uncensored-abliterated-18.4B-GGUF': '18.4B parameters, 3B used per word (mixture of experts) · 128K context · Llama 3.2 licence · community merge',
};
MODELS.forEach(m => { const s = STATS[m.hf ? m.hf.repo : m.id]; if (s) m.st = s; });

/* ---------- the "New models" section: not a fixed list ----------
   The newest GGUF repos are read from huggingface.co (newest first) and kept in data/hf-new.json, so the section
   fills itself as models come out, and still shows what it last saw when the internet is not there. Each repo is
   looked up once so the row can show the real file size and which file would be taken. */
const NEWFILE = path.join(DATA, 'hf-new.json'), NEWAGE = 6 * 60 * 60 * 1000;
let newCache = null, newBusy = false;
function newRead() {
  if (!newCache) { const d = U.readJson(NEWFILE, null); newCache = d && Array.isArray(d.models) ? d : { at: 0, models: [] }; }
  return newCache;
}
const newName = repo => String(String(repo).split('/').pop() || repo).replace(/-GGUF$/i, '').replace(/[-_]+/g, ' ').trim().slice(0, 80);
const newDay = ms => { const d = new Date(ms || 0); return isNaN(d.getTime()) || !ms ? '' : d.toISOString().slice(0, 10); };
async function refreshNew() {
  if (newBusy) return { ok: false, error: 'already checking' };
  newBusy = true;
  try {
    const r = await hf.newest(120);
    if (!r.ok) return r;
    const seen = new Set(MODELS.filter(m => m.hf).map(m => m.hf.repo.toLowerCase()));
    const want = [];
    for (const x of r.results) { const k = x.repo.toLowerCase(); if (!x.gated && !seen.has(k)) { seen.add(k); want.push(x); } }
    const out = []; let at = 0;
    const worker = async () => {
      while (at < want.length) {
        const x = want[at++];
        const f = await hf.list(x.repo);
        if (!f.ok) continue;
        /* only real model weights: no imatrix files, projectors, draft models or LoRAs, and nothing too small to be useful */
        const usable = f.files.filter(y => !/imatrix|mmproj|eagle|lora|vocab/i.test(y.base) && (y.size || 0) >= 100 * 1048576);
        const pick = hf.best(usable, 'Q4_K_M');
        if (!pick) continue;
        const mb = Math.round((pick.size || 0) / 1048576);
        if (mb > 45000) continue;                       // bigger than any PC this app runs on
        out.push({
          group: 'New models', id: hf.nameOf(x.repo, pick.quant), hf: { repo: x.repo, quant: pick.quant || '' },
          name: newName(x.repo),
          desc: 'New on Hugging Face' + (x.task ? ' · made for ' + String(x.task).replace(/-/g, ' ') : '') + '. Downloaded as one GGUF file and ready for Chat the moment it finishes.',
          mb,
          st: (x.downloads ? Number(x.downloads).toLocaleString() + ' downloads · ' : 'brand new · ')
            + (x.likes ? x.likes + ' likes · ' : '') + 'added ' + (newDay(x.created) || 'recently') + ' · ' + pick.base,
          created: x.created || 0,
        });
      }
    };
    await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
    out.sort((a, b) => (b.created || 0) - (a.created || 0));
    const seenId = new Set();
    const keep = out.filter(m => (seenId.has(m.id) ? false : (seenId.add(m.id), true)));
    newCache = { at: Date.now(), models: keep.slice(0, 80) };
    U.writeJson(NEWFILE, newCache);
    return { ok: true, count: newCache.models.length };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
  finally { newBusy = false; }
}
/* what the page asks for: the kept list straight away, and a quiet check in the background when it is old */
function newInfo(force) {
  const c = newRead(), stale = Date.now() - (c.at || 0) > NEWAGE;
  if (!newBusy && (force || stale || !c.models.length)) refreshNew().catch(() => { });
  return { models: c.models, at: c.at || 0, stale, busy: newBusy };
}
const stem = f => f.replace(/\.zim$/i, '').replace(/_\d{4}-\d{2}$/, '');
const fname = u => u.split('/').pop();

/* ---------- the chess engine: the one download that is not a book ----------
   Able to fetch Stockfish on demand, so a fresh or repaired copy of Moundshroud can get it back in one click,
   and it is refused unless the file matches the size and SHA-256 published with the official release. */
const ENGDIR = path.join(ROOT, 'engines', 'stockfish'), ENGDUMP = path.join(ROOT, 'nomad', 'dl-engines');
const ENGINES = [
  {
    id: 'stockfish', group: 'Chess engine', name: 'Stockfish 19 (full-strength chess engine)',
    desc: 'About 3500 Elo. Plays the top chess levels, analyses your games and studies in the background. 78 MB, straight from the official Stockfish release; Moundshroud checks it against the published fingerprint before installing.',
    url: 'https://github.com/official-stockfish/Stockfish/releases/download/sf_19/stockfish-windows-x86-64-universal.zip',
    mb: 78, bytes: 81431614, sha256: '3c8bf1f9ea66a09350a40df4f632288285ac206d99f33ab5842c408fc30b48a7',
    exe: path.join(ENGDIR, 'stockfish.exe')
  },
];
let engBusy = false, engNote = '';
const engJob = e => 'MOUNDSHROUD ENGINE ' + e.id;
const engineInstalled = (e = ENGINES[0]) => { try { return fs.existsSync(e.exe) && fs.statSync(e.exe).size > 1048576; } catch (x) { return false; } };
async function getEngine(id) {
  const e = ENGINES.find(x => x.id === id); if (!e) return { error: 'unknown item' };
  if (engineInstalled(e)) return { ok: true, status: 'installed' };
  const jobs = await bits(); if (jobs.some(j => j.DisplayName === engJob(e))) return { ok: true, status: 'downloading' };
  fs.mkdirSync(ENGDUMP, { recursive: true }); engNote = '';
  await ps("Start-BitsTransfer -Source '" + e.url + "' -Destination '" + path.join(ENGDUMP, fname(e.url)).replace(/'/g, "''") + "' -Asynchronous -DisplayName '" + engJob(e) + "' -Priority Normal | Out-Null", 60000);
  return { ok: true, status: 'downloading', mb: e.mb };
}
/* finishes a transferred engine download: checks it, unpacks it and puts the program where the chess pages look for it */
async function finishEngine() {
  const e = ENGINES[0];
  /* only called once the transfer is finished: BITS keeps the bytes in a temporary file until the job is completed,
     so completing it first is what puts stockfish-...zip at its destination below */
  await ps("Get-BitsTransfer -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq '" + engJob(e) + "' -and $_.JobState -eq 'Transferred' } | Complete-BitsTransfer", 120000);
  const zip = path.join(ENGDUMP, fname(e.url));
  if (!fs.existsSync(zip)) { engNote = 'The engine download did not arrive. Try again.'; return { error: engNote }; }
  const size = fs.statSync(zip).size;
  if (size !== e.bytes) { try { fs.unlinkSync(zip); } catch (x) { } engNote = 'The engine download was the wrong size, so it was thrown away. Try again.'; return { error: engNote }; }
  const got = (await ps("(Get-FileHash -Algorithm SHA256 -LiteralPath '" + zip.replace(/'/g, "''") + "').Hash", 180000)).trim().toLowerCase();
  if (got !== e.sha256) { try { fs.unlinkSync(zip); } catch (x) { } engNote = 'The engine file did not match the fingerprint published with the release, so it was thrown away. Try again, or tell Moundshroud about this on the Guide page.'; return { error: engNote }; }
  const stage = path.join(ENGDUMP, 'unpack');
  fs.rmSync(stage, { recursive: true, force: true });
  await ps("Expand-Archive -LiteralPath '" + zip.replace(/'/g, "''") + "' -DestinationPath '" + stage.replace(/'/g, "''") + "' -Force", 300000);
  fs.mkdirSync(ENGDIR, { recursive: true });
  const out = await ps("$f = Get-ChildItem '" + stage.replace(/'/g, "''") + "' -Recurse -File; $exe = $f | Where-Object { $_.Name -eq 'stockfish.exe' } | Select-Object -First 1; if (-not $exe) { $exe = $f | Where-Object { $_.Extension -eq '.exe' } | Select-Object -First 1 }; if (-not $exe) { 'NOEXE' } else { Copy-Item $exe.FullName '" + e.exe.replace(/'/g, "''") + "' -Force; $f | Where-Object { $_.Extension -in '.nnue','.txt','.md' -or $_.Name -eq 'AUTHORS' } | ForEach-Object { Copy-Item $_.FullName (Join-Path '" + ENGDIR.replace(/'/g, "''") + "' $_.Name) -Force }; 'OK' }", 180000);
  try { fs.rmSync(stage, { recursive: true, force: true }); fs.unlinkSync(zip); } catch (x) { }
  if (!/OK/.test(out) || !engineInstalled(e)) { engNote = 'The download arrived but the engine program was not inside it.'; return { error: engNote }; }
  try {
    fs.writeFileSync(path.join(ENGDIR, 'ENGINE-SOURCE.txt'), 'Stockfish, installed by Moundshroud (Prepare > Stock up).\n\nSource: ' + e.url + '\nSize: ' + size + ' bytes\nSHA-256 (matched before unpacking): ' + e.sha256 + '\nInstalled: ' + new Date().toISOString() + '\n\nStockfish is free software under the GPL-3.0; the licence is beside the program (Copying.txt).\n');
  } catch (x) { }
  engNote = '';
  return { ok: true, installed: true };
}
const installedFor = item => { try { return fs.readdirSync(LIB).some(f => /\.zim$/i.test(f) && stem(f) === stem(fname(item.url))); } catch (e) { return false; } };

async function bits() {
  const o = await ps("Get-BitsTransfer -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like 'KIWIX *' -or $_.DisplayName -like 'MOUNDSHROUD ENGINE *' } | Select-Object DisplayName,@{n='JobState';e={[string]$_.JobState}},BytesTransferred,BytesTotal | ConvertTo-Json -Compress");
  try { const j = JSON.parse(o); return (Array.isArray(j) ? j : [j]).filter(Boolean); } catch (e) { return []; }
}
/* finishes completed transfers (BITS keeps them as temp files until told to complete) - returns true if a book was added */
async function finishBits() {
  const jobs = await bits(); const done = jobs.filter(j => j.JobState === 'Transferred');
  if (done.length) await ps("Get-BitsTransfer -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like 'KIWIX *' -and $_.JobState -eq 'Transferred' } | Complete-BitsTransfer");
  const bad = jobs.filter(j => /Error|TransientError|Suspended/.test(j.JobState));
  if (bad.length) await ps("Get-BitsTransfer -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like 'KIWIX *' -and $_.JobState -match 'TransientError|Suspended' } | Resume-BitsTransfer -Asynchronous");
  return done.length > 0;
}
async function stock() {
  let jobs = await bits(), added = false;
  if (jobs.some(j => j.JobState === 'Transferred' && /^KIWIX /.test(j.DisplayName))) { added = await finishBits(); jobs = await bits(); }
  else if (jobs.some(j => /TransientError|Suspended/.test(j.JobState))) await finishBits();
  /* a finished engine download is completed, checked and unpacked quietly in the background, so the page keeps answering */
  const ejobs = jobs.filter(j => j.DisplayName === engJob(ENGINES[0]));
  if (!engBusy && ejobs.some(j => /TransientError|Suspended/.test(j.JobState))) {
    /* a stalled transfer is nudged along; no install is attempted, because the file is not there yet */
    ps("Get-BitsTransfer -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq '" + engJob(ENGINES[0]) + "' -and $_.JobState -match 'TransientError|Suspended' } | Resume-BitsTransfer -Asynchronous", 60000).catch(() => { });
  }
  if (!engBusy && ejobs.some(j => j.JobState === 'Transferred')) {
    engBusy = true; finishEngine().catch(() => { }).then(() => { engBusy = false; });
  }
  let disk = null; try { const s = fs.statfsSync('C:\\'); disk = { freeGB: Math.round(s.bavail * s.bsize / 1073741824), pct: Math.round(s.bavail / s.blocks * 1000) / 10 }; } catch (e) {}
  const items = CATALOG.map(c => {
    const j = jobs.find(x => x.DisplayName === 'KIWIX ' + fname(c.url)); const inst = installedFor(c);
    return { id: c.id, group: c.group, name: c.name, desc: c.desc, mb: c.mb, optional: !!c.optional, status: inst ? 'installed' : j ? (j.JobState === 'Error' ? 'error' : 'downloading') : 'available', pct: j && j.BytesTotal > 0 ? Math.round(j.BytesTransferred / j.BytesTotal * 100) : 0 };
  });
  const engines = ENGINES.map(e => {
    const inst = engineInstalled(e), j = jobs.find(x => x.DisplayName === engJob(e)), active = inst ? 'installed' : engBusy ? 'installing' : j ? (j.JobState === 'Error' ? 'error' : 'downloading') : 'available';
    const note = active === 'installing' ? 'Checking the fingerprint and unpacking it now...' : (active === 'available' && engNote ? engNote : e.desc);
    return { id: e.id, group: e.group, name: e.name, desc: note, mb: e.mb, optional: false, needed: !inst, status: active, pct: j && j.BytesTotal > 0 ? Math.round(j.BytesTransferred / j.BytesTotal * 100) : 0 };
  });
  return { items, engines, added, disk };
}
/* one entry point for the Download button: books go to the library, the chess engine goes to engines\stockfish */
async function getStock(id) {
  if (ENGINES.some(e => e.id === id)) return getEngine(id);
  return getBook(id);
}
async function getBook(id) {
  const c = CATALOG.find(x => x.id === id); if (!c) return { error: 'unknown item' }; if (installedFor(c)) return { ok: true, status: 'installed' };
  const jobs = await bits(); if (jobs.some(j => j.DisplayName === 'KIWIX ' + fname(c.url))) return { ok: true, status: 'downloading' };
  fs.mkdirSync(LIB, { recursive: true }); const dest = path.join(LIB, fname(c.url));
  await ps("Start-BitsTransfer -Source '" + c.url + "' -Destination '" + dest.replace(/'/g, "''") + "' -Asynchronous -DisplayName 'KIWIX " + fname(c.url) + "' -Priority Low | Out-Null", 60000);
  return { ok: true, status: 'downloading' };
}

/* ---------- model pulls (through Ollama) ---------- */
let pull = null;
function ollamaJson(OLL, pth, body, onLine) {
  return new Promise(resolve => {
    const p = JSON.stringify(body); const r = http.request({ ...OLL, path: pth, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(p) } }, res => {
      let buf = ''; res.on('data', c => { buf += c; let i; while ((i = buf.indexOf('\n')) >= 0) { const ln = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (ln) { try { onLine(JSON.parse(ln)); } catch (e) {} } } }); res.on('end', () => resolve(true));
    }); r.on('error', () => resolve(false)); r.end(p);
  });
}
function startPull(OLL, id) {
  let m = MODELS.find(x => x.id === id);
  /* any Hugging Face repo by its address too: owner/name, or owner/name:Q4_K_M */
  if (!m) { const t = hf.parse(id); if (t) m = { id: String(id), hf: { repo: t.repo, quant: t.quant }, name: t.repo, desc: 'From Hugging Face, by its address', mb: 0 }; }
  if (!m) return { error: 'unknown model' };
  if (pull && pull.model === id && pull.running) return { ok: true };
  /* Hugging Face: one GGUF file, downloaded and given to Ollama, which makes the model straight away */
  if (m.hf) {
    pull = { model: id, running: true, status: 'looking on Hugging Face for the files', pct: 0, error: '' };
    hf.pull({ repo: m.hf.repo, quant: m.hf.quant }, {
      onNote: t => { pull.status = t; },
      onPct: (got, total) => { if (total) { pull.pct = Math.round(got / total * 100); pull.status = 'downloading: ' + pull.pct + '%'; } }
    }).then(r => {
      pull.running = false;
      if (!r || !r.ok) { pull.error = (r && r.error) || 'The download failed.'; return; }
      pull.status = 'ready: ' + r.name + ' is in Chat now'; pull.pct = 100;
      /* the size Ollama actually made may differ from the one asked for: keep the list in step so it reads as installed */
      if (r.name && m.id !== r.name) m.id = r.name;
    }).catch(e => { pull.running = false; pull.error = String((e && e.message) || e); });
    return { ok: true };
  }
  pull = { model: id, running: true, status: 'starting', pct: 0, error: '' };
  ollamaJson(OLL, '/api/pull', { model: id, stream: true }, j => { if (j.error) pull.error = j.error; if (j.status) pull.status = j.status; if (j.total) pull.pct = Math.round((j.completed || 0) / j.total * 100); }).then(ok => { pull.running = false; if (!ok && !pull.error) pull.error = 'The AI engine did not respond'; if (!pull.error) { pull.status = 'success'; pull.pct = 100; try { require('./lmstudio-sync').syncAll(); } catch (e) { } } });
  return { ok: true };
}
const pullStatus = () => pull || { running: false };

/* ---------- readiness ---------- */
const run = (exe, args, ms = 8000) => new Promise(res => cp.execFile(exe, args, { windowsHide: true, timeout: ms }, (e, out) => res(e ? '' : String(out))));
async function health(ctx) {
  const [tray, auto] = await Promise.all([run('tasklist', ['/FI', 'IMAGENAME eq assistant-listener.exe', '/NH']), run('reg', ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', '/v', 'OfflineAssistant'])]);
  let disk = null; try { const s = fs.statfsSync('C:\\'); disk = { freeGB: Math.round(s.bavail * s.bsize / 1073741824), totalGB: Math.round(s.blocks * s.bsize / 1073741824) }; if (disk) disk.pct = Math.round(disk.freeGB / disk.totalGB * 1000) / 10; } catch (e) {}
  const lb = U.readJson(BACKUP, null); const d = load();
  return {
    ollama: ctx.ollama, models: ctx.models || [], lowModel: (ctx.models || []).some(n => /qwen3\.5:(0\.8|2)b/i.test(n) || /:(1|2|3)b\b/i.test(n)),
    books: ctx.books || [], disk, office: ctx.office, voice: ctx.voice, ocr: fs.existsSync(path.join(ROOT, 'ocr.ps1')), cyberchef: ctx.chef, stockfish: engineInstalled(),
    tray: /assistant-listener/i.test(tray), autostart: /OfflineAssistant/i.test(auto), lastBackup: lb ? lb.at : 0, safety: ctx.safety || null,
    household: { people: d.people.length, contacts: d.contacts.length, supplies: d.supplies.length, haveSupplies: d.supplies.filter(s => s.have).length, profile: !!(d.profile && (d.profile.adults || d.profile.children)), places: !!(d.places.meet1 || d.places.outOfArea) }
  };
}

module.exports = { load, save, noteBackup, stock, getBook, getStock, getEngine, finishBits, finishEngine, engineInstalled, ENGINES, MODELS, startPull, pullStatus, health, CATALOG, newInfo, refreshNew, newModels: () => newRead().models };
