// Terminal lore content banks: the prose the deep disk layer draws from. Every essay, sealed file, memo, joke and
// mail here is invented fiction written for practice on a simulated machine. No real person, company or agency appears.
(function () {
  const C = window.TerminalLoreContent = window.TerminalLoreContent || {};

  C.ESSAYS = [
    {
      slug: 'the-mound', title: 'The Mound: a short history of things buried and not finished', tag: 'House lore · circulated as a PDF nobody admits printing',
      paras: [
        "Before it was a program, Moundshroud was a place. The municipal record calls it Cell 14 of the Eastgate reclamation site; the people who worked there called it the mound, because that is what it was: a hill that grew a metre a year out of what a city could not sell, could not burn and could not admit to producing.",
        "The landfill closed in the spring of {date}. The trucks stopped. The gulls did not. For eleven years the mound sat under a green mesh and a sign that said the site was monitored, which was true in the sense that somebody drove past it twice a year and wrote the same sentence in a notebook.",
        "The first person to climb it for a reason other than vandalism was a records clerk named {name}, who had been sent to find a box. The box was not there. What was there, under a torn membrane, was a filing cabinet that had been dumped whole, drawers and all, with water in the bottom drawer and a municipal stamp still legible on the side.",
        "She photographed it. She wrote the date on the back of the photograph in pencil, because pencil survives water. That photograph is the first object in what the project now calls the archive, and the pencil note is the reason the project has a rule about writing things down twice.",
        "The mound is not a metaphor for data. It is a metaphor for the specific way an organisation relates to its own memory: not as a library but as a landfill with a monitoring contract. Everything is kept. Nothing is indexed. The thing you need is under the thing you were told to forget.",
        "Moundshroud began as an attempt to read one cabinet. It became a program because one cabinet is never one cabinet: the drawer references a file, the file references a meeting, the meeting references a decision that was never written down and therefore exists only in four people's recollection and one hotel receipt.",
        "The receipt is in the archive too. It is for two rooms and a bar tab in {city}, and it is the only surviving evidence that a particular contract was discussed at all. The project treats it with the seriousness usually reserved for treaties.",
        "There is a tradition, on the anniversary of the closure, of walking to the top of the mound and reading out one document that was found there. The reading is short. It is not a ceremony; it is a reminder that the material was real, that it was abandoned, and that somebody eventually looked.",
        "The program inherited the walk. The terminal sandboxes are the same gesture at a smaller scale: a disk full of ordinary paperwork with something buried in it, and a person at a keyboard deciding whether to look properly or to type ls once and give up.",
        "The reason the sandboxes say plainly that they are fictional is not legal caution. It is the same reason the landfill has a sign: a person should always know what kind of ground they are standing on.",
        "The mound has a smell in the memory of everyone who worked near it, and every one of them describes it differently: wet cardboard, diesel, cut grass, cold metal. The archive records all four descriptions without choosing between them, because the project's first principle is that a witness is not a camera.",
        "In {month} the council voted to cap the site permanently. The archive requested the monitoring reports and received eleven years of the same sentence. It filed them anyway. The project is, in the end, an argument that filing the boring thing is the whole job.",
        "The last page of the original notebook is a list of things {name} intended to look for next. There are nineteen items. Fourteen were found. Five are still listed, in the same handwriting, in every version of the archive since.",
        "People ask why the software is called Moundshroud and not something with a cloud in it. The honest answer is that the software is about the ground, not the sky: about what accumulates under your feet while you are busy, and who is willing to dig.",
        "The walk to the top takes nine minutes. The reading takes two. The rest of the afternoon is spent in the car park arguing about what the document means, which is, according to the project, the actual work."
      ]
    },
    {
      slug: 'the-archivist', title: '{name}, the archivist, and the house that would not stay quiet', tag: 'House lore · biography, unapproved',
      paras: [
        "There are three versions of {name}'s early life and all of them are defended by somebody. The version in the personnel file says a quiet childhood, a technical college, a job in records. The version told at the {city} meetup says a printer repair business and a year of night shifts. The version {first} tells, when {first} tells it, is shorter and better and probably not true.",
        "What is not in dispute is the flat. Two rooms above a locksmith, a kitchen with one working ring, and, by the end, thirty-one hard drives in cardboard boxes because the shelves had given up.",
        "The drives were not a hoard. They were a queue. Each one held a copy of something that had been deleted somewhere else: a company's intranet from before a merger, a school's photographs, a shipping manifest, a family's entire digital life bought at an auction in {city} for the price of a takeaway.",
        "The rule in the flat was that nothing was opened until it could be described on an index card. The card said what the disk was, where it came from, and what question it might answer. The index cards are the direct ancestor of the file tree in the sandbox.",
        "The neighbours complained twice, once about the noise of a fan and once about a smell that turned out to be a failed capacitor. The second complaint is the reason the project has a rule about not running old hardware unattended overnight.",
        "{first} did not describe the work as recovery. Recovery implies a previous state worth returning to. The word {first} used was reading, and the distinction matters: you do not restore a landfill, you read it and you write down what you find.",
        "The first public release was a single HTML file and a text document. It had no installer, no account, no update check. It ran from a folder. It is still possible to run that version, and a small number of people do, out of stubbornness or sentiment.",
        "There is a famous argument, recorded in an IRC log that has been passed around for years, in which {first} refused to add a feature because it would have required a network call. The other party called this unreasonable. The log ends with {first} typing a single line and disconnecting: the machine is the point.",
        "The project has never had a company. It has had a bank account, twice, and both times the account was closed by the bank for reasons that were never explained in writing. The second closure is the origin of the standing joke about field six, which is not actually about a bank.",
        "In the flat there was a wall with a sentence written on it in pencil, above the desk, at the height of a person sitting down: nothing here is finished, everything here is readable. Visitors assumed it was a motto. It was a note to self about the queue.",
        "The archive now lives in a room with a door that closes and a dehumidifier that runs all night. The drives are labelled. The index cards are photographed and transcribed. The queue is shorter than it was, which is the only progress {first} ever claimed.",
        "People send things. A box of floppies from a dissolved charity, a laptop from an estate, a phone that will not turn on. The project accepts these the way a lighthouse accepts weather: not because it can help, but because refusing would be a kind of lying about what the building is for.",
        "The essay you are reading was written by somebody who never met {first}, using the archive, which is exactly the arrangement {first} designed: the material should be able to speak without the person who collected it standing in front of it.",
        "There is one photograph of {first} in the archive. It is out of focus and taken from too far away, at the {city} meetup, mid-sentence. The archive keeps it because a blurred photograph is a truthful record of a person who did not want to be photographed.",
        "The last entry in the working notebook is not a plan. It is a question: what would this look like if it were thirty times bigger and still readable. The project has been answering that question, badly and then better, ever since."
      ]
    },
    {
      slug: 'field-six', title: 'Field Six: how a column index became a superstition', tag: 'House lore · engineering folklore',
      paras: [
        "In the beginning there was a CSV. It had six columns: timestamp, level, environment, service, status, payload. The payload was the interesting one and the payload was last, so the instruction said the same thing every time: extract field six.",
        "The instruction was correct. The instruction was also, in a way that nobody noticed for two years, a kind of lie: it implied that six was the number, when six was only where the interesting thing happened to have been put on the day the exercise was written.",
        "The first person to complain was a learner in {city} who had been given a table with eight columns and told to extract field six. They did exactly that. They got a column of booleans. They wrote a very patient bug report that ended with the sentence: your field six is my field four.",
        "The bug report was not fixed for eleven months. During those eleven months the phrase extract field six was printed in front of more than forty thousand people, and a folklore grew: field six is the answer, field six is always the payload, field six is the column where the secret lives.",
        "The fix, when it came, was not a single column number. It was a schema. Each table now declares its columns, the exercise names the column it wants by name and by position, and the position is generated fresh for every case: sometimes three, sometimes eight, occasionally ten when the exercise is being difficult.",
        "There is still a file in the repository called field-six.md. It is empty except for one line: the number is not the point, the label is. It is kept because deleting it felt like pretending the mistake had not happened.",
        "The superstition survives in the jokes. Any column that is hard to explain is field six. Any requirement that changes every sprint is field six. A person who insists on a number instead of a name is doing a field six.",
        "The adult humour file makes the obvious joke, and then four more, and the project has decided not to be embarrassed about it, because a piece of software that has been used by this many people for this long will accumulate exactly this kind of humour whether or not anybody writes it down.",
        "What the mistake actually taught was a lesson about instructions in general. An instruction that works is not the same as an instruction that is correct. A correct instruction names the thing; it does not point at where the thing was standing when you last looked.",
        "Every generator in the terminal now prints the column it wants twice: once as a number for the command, once as a name for the human. This is called, internally, the field six rule, which is confusing, and which everyone has agreed not to rename.",
        "The learner from {city} was sent a shirt. They did not ask for a shirt. The archive has the postal receipt, because of course it does.",
        "There is a second, quieter consequence. Because the exercises no longer assume a fixed shape, the tables can get wider: eight columns, twelve, a log line with more fields than a person can hold in their head. The difficulty went up, and it went up in the useful direction.",
        "If you are ever asked to extract field six and the file has seven columns, the correct response is not to guess. It is to read the header, find the label, and then decide. That is the whole essay, and it took the project eleven months and a shirt to write it.",
        "The joke file says field six is what you call it when you are not allowed to say the real name of the thing. This is funnier if you have worked in an office. It is also, in the specific case of this repository, literally true.",
        "The current build numbers its generated columns from one and its array indices from zero, which means that for several hours in {month} there were two field sixes and neither of them was the sixth field. This is recorded here so that nobody repeats it."
      ]
    },
    {
      slug: 'the-quiet-protocol', title: 'The Quiet Protocol: a defence of software that does not call home', tag: 'House lore · manifesto, revised',
      paras: [
        "Every program that talks to a server is a program with two authors: the one who wrote it and the one who runs the server. Moundshroud has exactly one author at a time and a rule that the second author does not exist.",
        "This is not a moral position about surveillance, although it is compatible with several. It is a practical position about failure. A program that needs a server fails when the server does, when the network does, when the certificate expires, when the company is acquired, when the billing dispute goes unresolved for a week in {month}.",
        "The rule has costs and the project pays them. There is no sync. There is no shared corpus. There is no telemetry telling us which exercise people abandon, so we find out by reading mail from the four people who bother to write, and by arguing about it.",
        "The rule also produces a specific kind of quality: because the machine has to do everything itself, every feature is designed as if it will be used on a train, in a basement, in a country where the connection drops at nine in the evening and does not come back until morning.",
        "The terminal sandboxes are the clearest expression of it. A simulated network, a simulated company, a simulated crime, all of it in one page, none of it leaving. A learner can spend six hours inside the range and the only thing that changes in the world is their own understanding.",
        "Critics say the simulation is not realistic because nothing is at stake. The answer is that something is at stake, but it is the learner's dignity: the range will let you fail in front of nobody, which is the only way most people learn anything difficult.",
        "The name for this in the design notes is the quiet protocol. It has three clauses. Nothing leaves without a click. Every simulation says it is a simulation. The interesting material is invented, and the boring material is invented too, because a simulation that is only interesting is a quiz.",
        "Clause three is the one that produced the essays. A disk with four suspicious files and nothing else teaches a person to look for suspicious files. A disk with six hundred ordinary ones teaches them to read.",
        "There is a version of the software that runs with no filesystem at all, straight from a USB stick, and it is the version {first} used for the year in {city}. It has no settings screen because there was nowhere to save settings, which is either a limitation or the purest form of the design.",
        "The quiet protocol has an enemy and the enemy is not a government. It is convenience, which arrives politely, wearing a progress bar, offering to make things faster by sending them somewhere else.",
        "The project has lost this fight twice and both times it was a dependency rather than a decision: a library that phoned home for fonts, a build tool that uploaded a hash, an analytics snippet that came with a template. All three were removed. One was removed twice.",
        "What is left is a program that can be audited by one person in an afternoon, provided the person is patient and does not mind reading minified code. That is the standard. It is a low standard and it is higher than most software manages.",
        "The sandbox ranges carry one more sentence in every file that describes them: only ever point these techniques at a machine you own or are allowed to test. It is not boilerplate. It is clause zero, and it was written before the other three.",
        "If the network comes back tomorrow and stays, the quiet protocol will still be the design, for the same reason a paper notebook survives a power cut. The point was never to be offline out of fear. The point was to be legible when everything else is not."
      ]
    },
    {
      slug: 'thirty-times', title: 'Thirty Times: what happened when somebody asked for more', tag: 'House lore · postmortem, affectionate',
      paras: [
        "The request arrived on a Tuesday and it was four words long, one of which was a number. Make it thirty times bigger. There was no specification, no acceptance criteria, and no indication of what bigger meant: more files, longer files, more secrets, more jokes, or all of it at once.",
        "The first attempt multiplied the file count and produced a disk that was large and stupid: four hundred copies of the same memo with different numbers. It was, in the phrase used in the review, technically thirty times bigger and not one bit deeper.",
        "The second attempt multiplied the prose and produced a disk on which every file was an essay, which is beautiful and useless, because a person reading a seized laptop needs the tax return next to the diary next to the invoice, not three hundred pages of memoir.",
        "The third attempt is the one that shipped, and its principle is simple enough to write on an index card: a real computer is mostly boring, occasionally devastating, and always badly organised. Everything after that is arithmetic.",
        "The boring part is generated: cache entries, update manifests, crash dumps, browser history, thumbnails, logs with retry counts. Nobody reads them and everybody recognises them. They are what makes the interesting file feel hidden rather than presented.",
        "The devastating part is authored: a settlement, a sealed directive, a letter that was never sent, a photograph with a date on the back. There are enough of these now that a person can play for weeks and still find one they have not seen.",
        "The badly organised part is the hardest and the most important. Real disks have a folder called new folder (2). They have the same document in three places with three different dates. They have a backup of a backup of something that was deleted on purpose.",
        "There is a running argument about how many files is too many. The number in the code is fourteen hundred for the largest setting. The number in the argument is always lower, and it is always proposed by somebody who has just tried to open the editor on a seized machine and watched the tab struggle.",
        "The compromise is that the deep setting is fast because most of it is small: a cache entry is a line, a manifest is five. The essays are the expensive part and there are between two and twenty-four of them, which is a number a browser can carry.",
        "What the request actually taught was that people do not want more content, they want more world. Thirty times the files with the same four secrets is a phone book. Thirty times the world is a place where the secret might be anywhere, which is exactly the feeling the project exists to teach.",
        "The joke file has an entry about the request. It is crude and it is affectionate and it is the most forwarded line in the repository, and the person who asked for thirty times bigger has been sent it at least a dozen times by people who do not know they were the reason.",
        "The postmortem has one recommendation: when somebody asks for more, ask what they are trying to feel. The answer here was not volume. It was the specific vertigo of opening a stranger's computer and realising the life on it is larger than the investigation.",
        "That vertigo is now a setting. It is called seized machine, it produces fourteen hundred files, and the first thing most people type is ls, followed by a pause, followed by ls again in a different folder, which is the correct response to a life.",
        "The number thirty survives in the changelog, in the joke file, in one comment above the profiler, and in the name of a branch that was never merged. It has become the project's unit of ambition: one thirty is roughly one world."
      ]
    },
    {
      slug: 'small-doors', title: 'The Committee of Small Doors', tag: 'House lore · institutional satire, sealed',
      paras: [
        "The Committee meets on the fourth Thursday in a room with nine doors and no windows. The doors are a security feature and also, according to the minutes of {date}, a metaphor that the chair asked not to be recorded.",
        "Its business is the classification of documents that have already been classified, on the theory that a second classification is cheaper than a first decision. A file that arrives marked restricted leaves marked sealed, and everybody signs the sheet, and the sheet is itself restricted.",
        "In {month} a junior clerk named {name} asked a question that had not been asked in eleven years: what are we protecting. The minutes record the question, the date, the time, and then a gap of forty minutes before the next item.",
        "The gap is the most interesting document in the archive. Something was said for forty minutes and nothing of it was written down, which under the committee's own rules makes it, technically, unclassified.",
        "The clerk requested the gap. The request was denied on the grounds that no such record exists. The clerk then pointed out that the denial was itself a record, which is the kind of argument that gets a person transferred to a building with fewer doors.",
        "The committee's real function is not secrecy. It is delay. A document that is sealed is not wrong, it is pending; a question that is restricted is not answered, it is scheduled. Delay is the cheapest form of denial ever invented and it requires no decision at all.",
        "The project treats the committee as a case study rather than a villain. Villainy implies intent, and the committee's defining feature is the absence of intent: nine reasonable people doing a reasonable process in a room that makes reason impossible.",
        "There is a version of the committee in every sandbox. It appears as a folder called legal, a file called do-not-forward.txt, a memo whose second page is missing. The learner is not told what it means. The learner is expected to notice the shape.",
        "The nine doors are real, by the way. They were installed in {date} after an audit recommended reducing egress points. Nine was the number of egress points at the time. Nobody has counted since.",
        "The clerk now works in records, which is where the archive found the request and the denial and the transfer notice in the same box, in that order, with a rubber band around them. The rubber band is mentioned in the finding aid. The finding aid is thorough.",
        "A sealed file is not a locked file. It is a file with a story about why it should not be opened, and stories about why a thing should not be opened are, in the archive's experience, the most reliable sign that it should be.",
        "The essay was written to be read alongside the sealed documents in the intel folder of any deep disk. It is not evidence of anything. It is a training aid for the specific skill of reading a bureaucracy's shape instead of its words.",
        "The committee has never been dissolved. It has been renamed twice. The second renaming produced a document that is, unavoidably, about the first renaming, and that document is sealed."
      ]
    },
    {
      slug: 'the-sandbox-house', title: 'The House of Sand: why the ranges are rooms', tag: 'House lore · design note',
      paras: [
        "A sandbox is not a small computer. It is a room in a house that has agreed to be searched. The agreement is what makes it a room rather than a puzzle: a puzzle has a solution, and a room has a history.",
        "The house has a kitchen, which is the shell: knives, a bin, a drawer of things that do not go together. It has a study, which is the puzzle rooms: paper everywhere, a lamp, one drawer that sticks. It has a cellar, which is the pentest range: the pipes, the fuse box, the thing you were told not to touch.",
        "And it has an attic, which is the remote range: somebody else's house, seen through a window, with their life laid out in folders whose names you do not recognise because they are not your names for things.",
        "The attic is the uncomfortable room, and it is the one that teaches the most. A person searching a strange machine learns quickly that the techniques are the easy part and the interpretation is the work: which file matters, which one is a decoy, which one is a person having a bad year.",
        "The ranges differ in difficulty for a reason that is not about skill. A small laptop with three secrets is a lesson. A seized machine with fourteen hundred files and thirty secrets is an argument about attention, and attention is the actual subject of the whole app.",
        "Every room is furnished by the same engine, which is why a file found in the pentest range has the same smell as a file found in the shell sandbox: invented, plausible, slightly too specific, and marked somewhere with the word fictional so that nobody mistakes the furniture for evidence.",
        "The furniture matters more than the locks. A range with a perfect exploit chain and an empty desk teaches nothing about investigation. A range with a boring desk and a letter in the second drawer teaches the only skill that transfers.",
        "The house has a rule about the truth: it never lies about being a house. There is no moment in any room where the app pretends the data is real. The pretence would be easy and it would poison the exercise, because the exercise is about judgement, and judgement requires knowing what you are judging.",
        "The rooms are also re-furnished on every visit. The engine reseeds, the names change, the essay you read last week is on a different disk under a different title. This is deliberate: a person who memorises a room has learned the room, not the searching.",
        "The dining room is missing. It was proposed, argued about for a month, and dropped, because a shared table implies a shared case and the design is stubbornly single-player: one machine, one person, one quiet afternoon.",
        "There is a corridor between the rooms that the documentation calls the terminal. It is not a place. It is the act of walking from one to the next with your hands in your pockets, deciding which door to open, which is, if you think about it, the whole of the job.",
        "The deepest disk has a room that is only essays: a folder of long documents that nobody would put on a work laptop and that somebody absolutely did. It is the attic's attic, and finding it is the reward for reading the boring files first."
      ]
    },
    // @more-essays
  ];

  /* ---------- sealed material: government-shaped paperwork, all of it invented ---------- */
  C.SEALED = [
    "DIRECTIVE {num}/26 — The annex at {city} is to remain unacknowledged in correspondence with the oversight board. Refer any enquiry to the liaison office, which does not exist under that name. The liaison office will decline, in writing, and the written refusal is the only document that may be retained.",
    "FINDING — The review found no evidence that the programme exceeded its authority. The review was scoped to exclude authority. This exclusion was proposed by the office under review and accepted without discussion.",
    "SEALED ORDER — The transcript of the {date} session is to be held by the clerk of the court and released only to a party who can demonstrate a prior knowledge of the third agenda item. Prior knowledge is defined as having been present.",
    "ASSESSMENT — The contractor's account of the {month} incident is internally consistent and externally unverifiable. We recommend accepting it, noting the consistency, and never referring to it again in a document that could be produced.",
    "TRANSCRIPT (redacted) — CHAIR: we are not deciding that. MEMBER: we decided it in {month}. CHAIR: we decided something else in {month}. MEMBER: the minute says otherwise. CHAIR: the minute is wrong. [REDACTED 104 chars] The meeting moved to item four.",
    "MEMO — The site at {city} has been reclassified from storage to disposal and back to storage twice in eighteen months. Each reclassification generated a certificate. The certificates conflict. The conflict has been resolved by keeping all three and not consulting them.",
    "BUDGET — Line 6, described as field support, has no counterpart in the programme plan. Line 6 has been funded every year since {date}. Nobody who funded it remembers the discussion, and two people claim to have been on holiday.",
    "LIAISON NOTE — The foreign delegation asked about the annex. We said there was no annex. They asked about the annex by its local name, which we had not used in the meeting. The meeting concluded on schedule.",
    "LEGAL HOLD — All material relating to the {month} shipment is to be preserved and not reviewed. Preservation without review is the office's preferred posture: it satisfies the obligation and produces nothing.",
    "INCIDENT — At 04:12 the monitoring system reported the site as offline. The site was not offline. The monitoring system was reporting on a different site, which had been decommissioned in {date} and never removed from the register.",
    "SEALED — The names of the four assessors are withheld from this document. They are withheld from each other as well, a measure described in the covering note as protective and in the margin as administrative convenience.",
    "DIRECTIVE — No written record is to be made of the decision to proceed. This directive is the written record. It is retained under the archive's standing exception for directives that forbid themselves.",
    "FINDING — The equipment was purchased, delivered, and never installed. The invoices are complete. The installation report is complete. The equipment does not appear in any inventory, which the audit describes as a reconciliation difference rather than a loss.",
    "ASSESSMENT — The public account and the internal account differ in three places. Two of the differences are trivial. The third is the date, and the date is the only fact either account agrees is important.",
    "TRANSCRIPT — [REDACTED 212 chars] OPERATOR: it is reading the whole disk. SUPERVISOR: let it. OPERATOR: it is reading the whole disk. SUPERVISOR: I heard you the first time.",
    "MEMO — The word incident has been replaced throughout this file with the word event. The replacement was made for clarity and has had the opposite effect, which the committee has decided not to revisit."
  ];

  C.CORP = [
    "The board noted the {month} variance and accepted the explanation that it was timing. The explanation was provided by the person responsible for the timing. No further questions were recorded.",
    "We are pleased to confirm that the restructuring is complete. The remaining staff have been informed. The phrase remaining staff was chosen by committee and is used in all external communication.",
    "The audit identified fourteen control weaknesses. Twelve have been remediated. Two have been reclassified as accepted risks, a category created in {month} for this purpose.",
    "Following legal advice, the company will not be commenting on the {city} matter. The advice is attached. The attachment is a single sentence long and is billed at {money}.",
    "The pilot was a success on the metrics we chose after the pilot. The earlier metrics have been withdrawn from the dashboard and are retained in the archive for completeness.",
    "Staff are reminded that expense claims must be submitted within 30 days. Claims submitted after 30 days will be reviewed by a committee that meets quarterly, which is a policy and not a punishment.",
    "The supplier relationship has been terminated following a review. The review found no fault. Termination without fault is permitted under clause 14, which was added in {date} and has been used four times.",
    "Quarterly communication: we are making good progress against a challenging backdrop. The backdrop has been challenging for eleven consecutive quarters and is now described as the operating environment.",
    "The {month} offsite will focus on trust. Attendance is mandatory. The venue has been changed to a location without mobile reception, which the organiser describes as a coincidence.",
    "We have agreed a settlement with the claimant. The terms are confidential. The confidentiality clause is mutual, which means neither party may say what it was about, including to the people it was about.",
    "The new policy takes effect immediately. A copy has been placed in the shared drive. The shared drive is read-only. Requests for a printed copy should go to a person who left in {month}.",
    "Customer data was not affected. Some customer data was affected. The affected data was limited to fields that are not considered sensitive, a definition that was updated on the same day as the notification.",
    "The internal investigation has concluded that the concern was raised in good faith and that no further action is required. The person who raised it has been offered support and a different role.",
    "Expenses for the {city} trip included a dinner for eleven at {money}. The dinner is recorded as a client development event. No client attended. This is noted in the file and has never been queried.",
    "We are committed to transparency. This document has been prepared to demonstrate that commitment. Portions have been withheld for commercial reasons, which is itself disclosed at the bottom of the page in small type."
  ];

  /* ---------- personal and embarrassing: the reason a seized laptop is never boring ---------- */
  C.PERSONAL = [
    "I have started writing this down because I keep forgetting which version of the story I told to whom, and one day that will matter.",
    "The money is not missing. It is in the account I do not use, which I opened for the refund and then forgot about for two years, which is why the statement looks the way it does.",
    "I told {name} I was at a conference. I was in {city}. The receipts are in the folder called old receipts, which I should probably delete and never will.",
    "If anyone reads this: the thing with the invoice was not fraud, it was incompetence with a paper trail, and the difference matters to me even if it does not matter to the audit.",
    "I have drafted the message to {name} nine times. The ninth is the shortest and the least honest. I will send the ninth.",
    "The reason I do not use the shared drive is not security. It is that I do not want to see the folder with my name on it from 2019.",
    "My manager knows about the second job. My manager has known since {month} and has said nothing, which is either kindness or leverage and I have stopped trying to work out which.",
    "I keep a copy of the old contract because the version in the system is not the version I signed, and nobody believes that, and I have stopped saying it.",
    "The flat is a mess. The flat has been a mess since {date}. This is not a crisis, it is a filing system with a different logic.",
    "I am not proud of the {month} email. I was tired and I was right and I said it badly and now it is in the archive forever, which is the same as being wrong.",
    "There is a photograph on this machine I have not opened in four years. I know the filename. I have typed the path into the address bar and deleted it more than once.",
    "The will is in the blue folder. If something happens, the blue folder, not the one marked important, which is where I put everything I was avoiding.",
    "I have been applying for other jobs for eight months. The spreadsheet is named budget-2026.xlsx because I am not an idiot, I am just tired.",
    "The complaint I filed was true and I withdrew it because the process was worse than the problem. I keep the draft because I want to remember that I was not imagining it.",
    "My brother owes me {money} and I have decided not to care, which is a decision I make roughly once a week.",
    "If you are reading this on my machine, the password is in the file called passwords, and yes, I know. I know.",
    "I did not lose the keys. I put them in the drawer with the batteries and then moved the batteries, which is a different failure and a better story.",
    "The doctor said the results were normal and I have been thinking about the word normal for eleven days.",
    "I have been sleeping badly since {month}. I told work it was the commute. The commute is fine.",
    "The old laptop still has the photographs from before the split. I have not wiped it because wiping it feels like agreeing that it is over, and I am not ready to agree in writing.",
    "I lied on the CV about the {month} gap. The truth is duller and I have never been able to make it sound like anything.",
    "The plan was to leave in {month}. The plan is still the plan. The plan has been the plan for two years and the only thing that changes is the month.",
    "I keep the receipts for the therapy in a folder called car. Nobody has ever asked.",
    "I forwarded the confidential deck to my personal address so I could read it on the train. I have been waiting to be caught for eight months and the waiting is worse than the catching would be.",
    "The dog died in {month}. I am writing it here because I could not say it out loud at work and I need it to be somewhere.",
    "Everything in this folder is a draft. Nothing in this folder was ever sent. That is the whole file, really."
  ];

  /* ---------- the app's own jokes: adult, affectionate, never about a real person ---------- */
  C.JOKES = [
    "The assistant has a very long context and still forgets what I asked it two messages ago. Make of that what you will.",
    "Field six is not a column, it is a lifestyle. Mostly a bottom kind of lifestyle.",
    "They asked for thirty times more content. I gave them thirty times more content. Now nobody can find the thing they wanted and honestly, that is on them.",
    "The sandbox has fourteen hundred files. It is the only relationship I have where being ignored is the correct response.",
    "I typed extend and the tab took a breath. We have all been there.",
    "The mound is what you call it when the folder gets so big you have to climb it to see the light.",
    "Everybody wants a deeper insertion until it is their disk being penetrated.",
    "The joke file is the only part of the codebase that gets reviewed by everybody, immediately, at length, with suggestions.",
    "Our agent is very good at coming home with something. Whether it is the right something is a separate conversation.",
    "The app will happily go all night. The fan will let the neighbours know.",
    "I asked it to find the secret and it found six. Six is not a number, it is a cry for help.",
    "The privacy policy is one line long: it is your machine, you absolute freak, do what you like.",
    "Every time somebody says the word cloud in a design meeting, a hard drive spins up somewhere in {city} out of spite.",
    "The offline mode is not a feature. It is a personality.",
    "Thirty times bigger and it still will not tell me where the tax return is. That is not a bug, that is marriage.",
    "The sealed folder is sealed. I checked. Twice. With enthusiasm.",
    "Terminal range, deep setting, one person, one lamp. It is basically a date except the other party cannot leave.",
    "We do not have a field six. We have a field six situation.",
    "The assistant said it would remember. The assistant remembers everything except the one thing.",
    "Somebody asked for a longer essay. Somebody got a longer essay. Somebody is now reading a longer essay instead of working, and I respect it.",
    "The shell sandbox is a safe space in the sense that nothing you do matters and everything you do is logged in your own memory.",
    "I put the joke about the mound in the manual. The manual is now the most-read document in the project. Nobody has read the manual.",
    "You can tell a lot about a person by which folder they open first. Mostly that they are in a hurry.",
    "The generator does not judge. The generator has seen your downloads folder.",
    "If it says fictional, it is fictional. If it says sealed, it is also fictional but with better stationery.",
    "The only thing harder than finding the file is admitting you were looking in the wrong folder for an hour, which is the actual lesson.",
    "The terminal is a consenting environment. The range asked for it. The range signed a form.",
    "A short context is a skill issue. A long context is a storage issue. Either way, it is your problem now.",
    "The deep disk setting exists because somebody said make it bigger in a meeting where nobody was allowed to say no.",
    "The joke file was supposed to be three lines. It is now a document. This is how everything in this project happens."
  ];

  /* ---------- manual chapters, mail, chat, HR ---------- */
  C.MANUAL = [
    { title: 'Chapter: reading a disk', text: 'Start at the top and go down. Read the folder names before the files: a person names folders for the thing they were avoiding. Open the boring file first, because the boring file tells you what normal looked like on this machine, and normal is the only baseline you will ever have.' },
    { title: 'Chapter: what a file is hiding', text: 'A file hides in three places: in its name, in its neighbours, and in its date. The contents are the last place to look, which is why beginners look there first. A file called notes-final-final-2.txt dated on a Sunday tells you more than the notes.' },
    { title: 'Chapter: the terminal is not a magic trick', text: 'Every command in the ranges is simulated and honest about it. ls lists, cat prints, grep searches. Nothing reaches the network, nothing installs itself, nothing survives the page reload. The pleasure of the terminal is that it tells you exactly what it did, which is more than most software manages.' },
    { title: 'Chapter: on difficulty', text: 'Difficulty is not the number of locks. It is the amount of ordinary life standing between you and the lock. A strong door in an empty room is easy. A weak door in a house is hard, because you have to live there first.' },
    { title: 'Chapter: nothing here is evidence', text: 'Everything in the ranges is invented. Every name, every ledger, every sealed directive, every embarrassing email. If a file upsets you, it was written to do that, by somebody who does not exist, about people who do not exist. The techniques are real. The victim is a paragraph.' },
    { title: 'Chapter: the sealed folder', text: 'Sealed means labelled, not protected. In this app the sealed files are placed where a careful reader will find them, because the lesson is not that secrets are impossible to reach but that they are usually reachable by the person who reads the paperwork in order.' },
    { title: 'Chapter: essays as terrain', text: 'The essays exist because a disk without long documents is a quiz. A person who has read four thousand words of somebody else\'s institutional prose reads the fifth document differently. That is the entire pedagogical theory of this folder and it is defenceless in a meeting.' },
    { title: 'Chapter: the joke file', text: 'The jokes are about the software. They are crude on purpose: a tool used by adults for long enough gets a humour file, and pretending otherwise produces a sterile app and a team that makes the same jokes badly in chat. Keep them about the app. The moment they are about a person, they are not jokes any more.' },
    { title: 'Chapter: thirty times bigger', text: 'When the request says make it bigger, ask what should be bigger. Volume is easy and cheap and reads as noise. World is expensive and reads as place. The deep disk setting is mostly world: mail, tax returns, cache files, bad drafts, one devastating letter.' },
    { title: 'Chapter: leaving a machine as you found it', text: 'Close what you opened. Read the file and put it back. A good investigator leaves no trace on the machine and a full page of notes in their own. The range enforces the first; the second is your business.' }
  ];

  C.MAIL = [
    'Re: the {month} numbers — I am not going to put that in writing, so call me',
    'FW: FW: do not forward this',
    'Agenda for Thursday (13 items, 30 minutes)',
    'Your expense claim has been rejected: reason code 6',
    'Re: the annex — no annex exists, please stop asking',
    'Draft — not for circulation — but read it before the meeting',
    'Invitation: trust workshop, offsite, no phones',
    'RE: RE: RE: the thing we discussed',
    'Records request — acknowledge within 2 working days',
    'Payslip available in the portal',
    'Re: your application — unfortunately, on this occasion',
    'Lunch? I need to tell you something and not in the chat',
    'IT: mandatory password reset (this is real, unlike the last one)',
    'The contract is signed, ignore the earlier version',
    'Re: the {city} trip receipts — you were not there',
    'Final reminder: complete the compliance module'
  ];

  C.CHAT = [
    'did you see the thing on the shared drive',
    'which thing',
    'the thing. the folder with the wrong date on it',
    'oh THAT thing. no. no no no',
    'I am not opening it on my machine',
    'you are literally the person who has to open it',
    'I have a meeting',
    'you have a meeting in four hours',
    'it is a long meeting',
    'did you send the email or draft it',
    'draft',
    'draft is better',
    'draft is worse, it means it is still true',
    'I am going to pretend I did not see this chat',
    'he is offline again',
    'third time this week',
    'the fan on that laptop sounds like a hairdryer',
    'it is doing something with the files',
    'what files',
    'all of them',
    'I told you not to run that on a work machine',
    'it is fine, it does not connect to anything',
    'that is not the reassuring thing you think it is',
    'the audit is Thursday',
    'the audit is always Thursday',
    'the audit has been Thursday for six weeks',
    'they keep moving it because they keep finding things',
    'are we still doing the thing on Friday',
    'what thing',
    'you know what thing',
    'I am not saying the thing in a chat that gets exported',
    'everything gets exported',
    'then we are both being very brave',
    'can you send me the password',
    'no',
    'it is the same password as everything',
    'yes',
    'then just use it',
    'I did, it did not work, which is either worrying or normal',
    'how much did the dinner cost',
    'do not look at the receipts',
    'I am looking at the receipts',
    'the receipts are a work of fiction',
    'this entire office is a work of fiction'
  ];

  C.HR = [
    'The complaint was raised in good faith and investigated promptly. The investigation concluded that the conduct did not meet the threshold. The threshold was reviewed after the investigation and adjusted.',
    'The grievance is not upheld. The panel noted the complainant\'s account was consistent and preferred the account given by two managers, which was also consistent.',
    'Settlement agreed: {money}. Terms include mutual non-disparagement, withdrawal of the grievance, and a reference limited to dates of employment. The reference will say the employee was \'valuable\'.',
    'A reference request was received. We confirm dates of employment only. The reason for this policy is recorded in a memo that cannot be located.',
    'The employee was offered support and a change of role. The employee declined the change of role and accepted the support, which the file records as a positive outcome.',
    'An informal conversation took place. No minutes were taken. The file notes only that the conversation was constructive, a word used in this office to mean that it ended.',
    'The investigation found that the message was sent in error to the wrong distribution list. The list is not recorded. The message is not retained. The error is not disputed.',
    'Following the restructure, the role was placed at risk. The process was fair and is documented. The documentation was completed after the decision, which the auditor noted and accepted.',
    'The employee raised a concern about the {month} shipment. The concern was acknowledged and referred to legal, which advised that no further action was required. The employee was informed of the outcome in a two-line email.',
    'A disciplinary meeting was held. No disciplinary action was taken. The file is retained for six years in case the matter returns, a phrase that does not appear in any policy.'
  ];

  C.APP = {
    release: 'RELEASE PLAN\n\n1. Ship the deep disk layout to everyone. Nobody asked for a setting; everybody asked for more files.\n2. Keep the difficulty names honest: small laptop, workstation, full PC, seized machine.\n3. The jokes ship with the app, in the app, about the app. Review once, then leave them alone.\n4. The essays are content, not documentation. Do not index them. Let people find them in a folder at 1am.\n5. If a range claims to be fictional, it must actually be fictional, including the boring parts.'
  };

  /* Juicy but harmless: the things people leave on a work machine that they would not read out in a meeting.
     Every line is invented for practice and describes nobody real. */
  C.SECRETS = [
    'I have been telling everyone the delay was the vendor. The delay was me. I lost the file for nine days and then found it in the folder I had already searched twice.',
    'I do not know what the third column in the weekly report means. I have been copying it from the previous week for eleven months. Nobody has ever asked.',
    'The password on the shared drive is the name of my old dog plus the year I left home. I have been told to change it four times. I have changed the number at the end four times.',
    'I approved my own expenses twice last quarter. Both times the system let me. I have not told finance and I have not spent the money.',
    'I told the team the meeting was cancelled. It was not cancelled. I just could not face it and I have been avoiding the follow-up email for a fortnight.',
    'I wrote the policy that says nobody may work from the coffee shop. I work from the coffee shop on Thursdays.',
    'The reason the printer jams is that I put the wrong paper in it in March and I have been blaming the machine ever since.',
    'I have a folder called "final" and a folder called "final real" and a folder called "final real actual". None of them is the final one. The final one is on the desktop and has my name misspelled.',
    'I accidentally sent the salary spreadsheet to the whole company. I recalled it. Forty people had already opened it. Nobody ever mentioned it and I think about it every day.',
    'The incident report says the outage lasted eight minutes. It lasted forty. I rounded down because the first thirty-two were my fault and I panicked.',
    'I have been claiming the gym membership as a business expense. It is not a business expense. I have decided that if anyone asks I will say it was for the team away day.',
    'The client liked the first draft better. I sent the third draft. I have been quietly terrified that they will compare notes for two years.',
    'I told the auditor the backup ran nightly. It ran nightly in the sense that it was scheduled nightly. It last completed in November.',
    'There is a spreadsheet of everyone\'s birthdays and next to mine I have written "do not make a fuss". Every year somebody makes a fuss. I have never worked out which of them read the spreadsheet.',
    'I have been using the admin account for everything because I lost my own password in a browser update and I am too embarrassed to ask for a reset again.',
    'The reason I left early on the day the deploy failed is that I was on a date. It went badly. The deploy went worse. I have never told anyone which I regret more.',
    'I promised the customer a call back before five. I went to lunch and forgot. I then told them the phone system was down. The phone system was fine.',
    'I have two versions of the truth about the {month} budget and the one in the shared folder is the one I wrote after the meeting, not before it.',
    'I keep a note of every time somebody interrupts me. It is twelve pages long. I have never shown it to anyone and I never will, but writing it helps.',
    'I deleted the old invoices to free up space. I told IT the archive corruption did it. IT believed me because the archive corruption is also real.',
    'I have never once read the terms of the software we pay for. I signed it off. The invoice is six figures and I choose not to think about it.',
    'The password hint on my account is "the usual". There are four usual ones. The account locked twice last month and both times I had to ring the helpdesk and both times I lied about why.',
    'I have been coming in early so I can use the good chair before anyone else takes it. The chair has my name on a sticky note that I move back every evening.',
    'The reason the report is always late is that I do the difficult half on the day it is due and the easy half a week early so it looks like I have started.',
    'I told my manager the database was migrated. It was copied. The old one is still live and still taking writes. I have been copying changes across by hand each Friday.',
    'I wrote the joke in the changelog. I did not think it would ship. I have been living with it for eleven releases and I still get a message about it every time somebody new joins.',
    'I have been reversing my own name for the folder I do not want indexed. It is not hidden. It is in the top level. I have convinced myself it is hidden.',
    'The estimate I gave was three days and I knew it was three weeks. I said three days because I wanted the project. I was right about the three weeks.',
    'I have a document called "things to say in the interview" and it is mostly true. The part about leading the migration is true in the sense that I was in the room.',
    'I spilled coffee on the laptop in February and told everyone it was the power supply. The power supply was replaced. The laptop still smells of coffee when it gets warm.',
    'I have been submitting the same training certificate to three different systems for two years. All three accept it. None of them checks the date.',
    'The reason the meeting room is always booked is that I book it for an hour every morning so I can sit in it alone and answer email. It is the only room with a door that shuts.',
    'I told the new starter the wiki was up to date. The wiki was last edited before they were born. They found out in week two and have been polite about it ever since.',
    'I once fixed a production bug by restarting a service I was not supposed to touch. I put a note in the incident log saying the service recovered on its own. It has not come up since.',
    'The shared inbox has 4,000 unread messages. I marked them all read one Sunday and told the team we had caught up. We had not caught up. We had hidden.',
    'I keep the old printer driver installed because the new one broke my layout and I never told anyone. Every time it prints wrong I blame the driver. This is, in fairness, accurate.',
    'I told the customer the feature was on the roadmap. It was on a list I keep in my head. I have since put it on a list on paper. It is not on the roadmap.',
    'My timesheet says eight hours every day. Some weeks that is true. Some weeks it is a short story.'
  ];

  /* App-flavoured detail: the sort of note the people who build Moundshroud would leave in their own repo. */
  C.APP_NOTES = [
    'The Edit the app terminal loads every text file through the same allow-list as the editor. If you add a folder at the top level, you have to add it in three places: list(), shell() and the tests. I have forgotten the tests twice.',
    'The mcode note is not a password manager. It is a learning exercise wearing a password-manager coat. Every payload is one or more encodings with a clue for each, and the passphrase only opens the door to the read-only helper.',
    'If the terminal ever looks empty, type a command that asks for hidden entries. Half of what people call missing is a dot at the start of a folder name.',
    'The sandbox disks are fiction on purpose. Every name, company and agency in here was invented for practice. If a file claims to be from a real organisation, it is a bug and should be fixed.',
    'Do not add a level just because somebody wants more files. Add another shape to the generator and let the seed choose. Two machines of the same size should never look the same.',
    'The app shell saves through the same endpoints as the editor, so a stray bracket in JavaScript is refused before it lands on disk. This has saved me more than once.',
    'Somebody asked for a feature that says whether a file changed while the shell was open. The shell now polls the file list and pulls in anything new. If it is ever slow, the poll is the first thing to look at.',
    'The essays are meant to be found, not listed. If they start appearing in menus, the spell is broken.',
    'The difficulty labels are honest: a small laptop really is a small laptop, and a seized machine really is a whole life. Do not call something insane because the number is bigger.',
    'We keep the previous version of every edited file under data/app-edits. The backups are boring right up until the moment they are the most important thing in the app.',
    'The flag in a mission is the thing the note protects. It does not have to be a password. It can be a confession, a number, a name, or something somebody wrote down at 1am and regretted in the morning.',
    'If you are reading this in the middle of a job, the answer is almost always in the file you skipped because it looked like a README.',
    'The terminal playground has ten shells and they all share the same file engine. When a command works in one, it is supposed to work in all of them. When it does not, that is a real bug and worth a test.',
    'The mcode helper reads the workspace it is opened in. It does not have a disk of its own, which is why it can tell you what to look at but not look for you.',
    'The cleanest bug report we ever got was "the terminal answers differently depending on which tab I am in". It was true. It was four bugs.',
    'Never store a real credential in a fictional disk. If a scan finds something that looks like a real key, it goes in the tests as a refusal, not in the content bank.'
  ];

  /* Short note leads, for the hidden maintenance notes the sandboxes hide. Each one frames the same find differently. */
  C.NOTES = [
    'Maintenance note — left here by whoever had the badge before me.',
    'IT ticket follow-up. There is no ticket number. There is only this.',
    'Password rotation sheet. I was told to print it and destroy it. I printed it twice.',
    'Note to self, filed under a folder with a dot so the family share does not pick it up.',
    'Handover notes, unfinished. The top line was the important one and I wrote it last.',
    'Backup of the sticky note on my monitor. The monitor is gone. The note survives.',
    'From the floor walkthrough. Do not show this to the auditors.',
    'For whoever finds this: the passphrase is for the account with the embarrassing purchase history, not the work one.',
    'Recovered from the printer queue after the incident. It was still in the spool a week later.',
    'The one thing I did not put in the shared folder, because the shared folder has a version history.'
  ];

  // @more-banks
})();
