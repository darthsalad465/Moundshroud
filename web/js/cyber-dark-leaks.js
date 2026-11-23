// The archive behind GHOST COLLECTIVE, the Fake Dark Web's leak site.
// A leak site is not one document: it is a pile of unrelated disclosures — an unreleased game build, the source of
// a CMS, a cabinet briefing, a party's swing-seat plan, a trading model, a carrier's SS7 configuration, a police
// surveillance toolkit, trial data, a grid's SCADA credentials. Each entry here has its own files, and every file is
// served at its own address, so `curl`, `wget`, `browser read`, `gobuster` and `paths` work on it like any other
// page. Everything is invented for the simulation: no real organisation, document, key or person is described.
const CyberDarkLeaks = (function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtSize = n => n >= 1024 ? (n / 1024).toFixed(n >= 10240 ? 0 : 1) + ' KB' : n + ' B';
  const L = (id, slug, cat, title, org, country, at, size, count, status, tags, summary, why, docs) =>
    ({ id, slug, cat, title, org, country, at, size, count, status, tags, summary, why, docs });

  /* ---------------------------------------------------------------- the archive */
  const ARCHIVE = [

    L(1, 'petrichor-build', 'Games', 'Petrichor — unreleased build, engine source and design docs',
      'Hollow Pine Studio', 'SE', '2026-10-28', '48.2 GB', 41207, 'published', ['games', 'source code', 'unreleased', 'leak'],
      'The full repository of a survival game that has not been announced. Engine, editor tooling, the build pipeline, the asset manifest and the internal roadmap. The build is playable; the interesting part is what the roadmap says about the publisher.',
      'A cancelled-in-secret project is the clearest kind of leak: the code shows what was built, and the roadmap shows what was promised to whom.',
      [
        { path: 'src/engine.c', text: [
          '/* petrichor — terrain streaming core (build 0.7.3-alpha) */',
          '#include "engine.h"',
          '#include "tilecache.h"',
          '',
          'static struct tile_cache g_cache;',
          'static uint32_t g_seed = 0x9E3779B9u;',
          '',
          'int engine_init(const struct engine_cfg *cfg) {',
          '    if (!cfg || cfg->tile_budget < 64) return E_INVAL;',
          '    if (tilecache_open(&g_cache, cfg->cache_dir, cfg->tile_budget) != 0)',
          '        return E_IO;',
          '    g_seed = cfg->world_seed ? cfg->world_seed : g_seed;',
          '    log_info("petrichor engine %s tiles=%u seed=%08x", ENGINE_VERSION, cfg->tile_budget, g_seed);',
          '    return E_OK;',
          '}',
          '',
          'void engine_tick(float dt) {',
          '    /* stream two rings ahead of the camera; the third ring is prefetch only */',
          '    tilecache_pump(&g_cache, camera_position(), dt);',
          '    weather_step(dt);',
          '    if (g_cache.evicted > EVICT_WARN) log_warn("evictions %u this frame", g_cache.evicted);',
          '}'
        ].join('\n') },
        { path: 'tools/level_editor.lua', text: [
          '-- level_editor.lua — the tool the designers actually used',
          'local editor = require("editor.core")',
          'local brush = require("editor.brush")',
          '',
          'local palette = {',
          '  { name = "wet_grass", layer = 3, cost = 1 },',
          '  { name = "flooded_road", layer = 2, cost = 3 },',
          '  { name = "silt", layer = 1, cost = 1 },',
          '}',
          '',
          'function editor.on_paint(cell, tool)',
          '  if tool == "water" then',
          '    brush.set_layer(cell, 2, "flooded_road")',
          '    brush.raise(cell, -0.15)   -- TODO: this makes cliffs at map edge, see PET-1142',
          '  elseif tool == "ruin" then',
          '    local piece = palette[math.random(#palette)]',
          '    brush.stamp(cell, "ruin_" .. piece.name)',
          '  end',
          'end',
          '',
          '-- shipped alpha maps were painted with this and never re-exported; the CLI does it in CI now'
        ].join('\n') },
        { path: 'docs/roadmap-internal.md', text: [
          '# PETRICHOR — internal roadmap (do not circulate)',
          '',
          '## What the publisher was told',
          '- "Co-op survival with a strong narrative spine", 12-month scope, launch on two platforms.',
          '- Milestone M3 paid on 2026-06-30. It was paid on the vertical slice, not on the systems.',
          '',
          '## What is actually true',
          '- Co-op has never worked above two players. The netcode is a lockstep prototype from 2024.',
          '- The narrative spine is five scripted rooms and a narrator who reads the roadmap out loud.',
          '- Console certification has not been started. The build does not boot on the devkit without a patch.',
          '',
          '## The plan for the announcement',
          '1. Announce at the winter show with the vertical-slice trailer.',
          '2. Ship "early access" in March regardless of state.',
          '3. If it reviews badly, blame the community for "expectations".',
          '',
          'M. says if we delay again the studio closes. He is probably right, which is why this file exists.'
        ].join('\n') },
        { path: 'assets/manifest.json', text: JSON.stringify({
          build: '0.7.3-alpha+20261026', engine: 'petrichor-native', assets: 41207,
          bytes: 51740811264, textures: { authored: 8821, imported: 11402, missing_source: 311 },
          audio: { stems: 402, unlicensed_temp_tracks: ['temp_theme_01.ogg', 'temp_rain_loop.ogg'] },
          note: 'temp tracks are commercial and must be replaced before any public build'
        }, null, 2) },
        { path: 'build.gradle', text: [
          'plugins { id "com.android.application"; id "org.jetbrains.kotlin.android" }',
          'android {',
          '    namespace "se.hollowpine.petrichor"',
          '    compileSdk 35',
          '    defaultConfig { applicationId "se.hollowpine.petrichor"; minSdk 26; targetSdk 35 }',
          '    buildTypes { release { minifyEnabled true; signingConfig signingConfigs.release } }',
          '}',
          '// signing keystore password lives in CI, not here — except it did, in commit 4b1c9e2, until 2026-09'
        ].join('\n') }
      ]),

    L(2, 'veyra-cms', 'Source code', 'Veyra CMS 4.2 — full source, schema and 240k customer rows',
      'Veyra Software GmbH', 'DE', '2026-11-02', '6.1 GB', 241904, 'published', ['source code', 'customers', 'saas'],
      'A commercial CMS in use by about nine hundred mid-sized sites, taken from the vendor\'s own build server. The source, the migrations, the production environment file, and a customer export that was sitting next to it.',
      'Read the auth class and you understand every site running it: the session cookie is signed with a constant that shipped in the source.',
      [
        { path: 'src/Auth.php', text: [
          '<?php',
          'namespace Veyra\\Core;',
          '',
          'class Auth {',
          '    // do not change: existing sessions break (see ticket VEY-4411)',
          '    const COOKIE_KEY = "v3yr4-cms-session-2021";',
          '',
          '    public static function login(string $email, string $password): ?array {',
          '        $db = Database::get();',
          '        $row = $db->query("SELECT id,email,pass,role FROM users WHERE email = :e LIMIT 1", ["e" => $email]);',
          '        $user = $row->fetch();',
          '        if (!$user) return null;',
          '        if (!password_verify($password, $user["pass"])) return null;',
          '        return self::session($user);',
          '    }',
          '',
          '    public static function session(array $user): array {',
          '        $cookie = base64_encode($user["id"] . "|" . $user["role"] . "|" . hash_hmac("sha256", $user["id"], self::COOKIE_KEY));',
          '        setcookie("veyra_session", $cookie, time() + 604800, "/", "", false, false);',
          '        return $user;',
          '    }',
          '}'
        ].join('\n') },
        { path: 'db/schema.sql', text: [
          'CREATE TABLE users (',
          '  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,',
          '  email VARCHAR(190) NOT NULL UNIQUE,',
          '  pass VARCHAR(255) NOT NULL,           -- bcrypt cost 10',
          '  role ENUM("admin","editor","viewer") DEFAULT "viewer",',
          '  mfa_secret VARCHAR(64) NULL,',
          '  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
          ');',
          'CREATE TABLE api_tokens (',
          '  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,',
          '  user_id BIGINT UNSIGNED NOT NULL,',
          '  token CHAR(40) NOT NULL,             -- 40 hex chars, never rotated',
          '  scope VARCHAR(255) DEFAULT "content:write",',
          '  INDEX (user_id)',
          ');',
          'CREATE TABLE audit_log (id BIGINT PRIMARY KEY AUTO_INCREMENT, actor VARCHAR(190), action VARCHAR(80), at TIMESTAMP);',
          '-- the audit log is written but nothing reads it'
        ].join('\n') },
        { path: 'src/Billing.php', text: [
          '<?php',
          '// billing is "temporary" since 2022',
          'class Billing {',
          '    public static function charge(int $customerId, int $cents): array {',
          '        $key = Settings::get("stripe_secret");',
          '        $ch = curl_init("https://api.example-processor.com/v1/charges");',
          '        curl_setopt_array($ch, [',
          '            CURLOPT_POST => true,',
          '            CURLOPT_RETURNTRANSFER => true,',
          '            CURLOPT_HTTPHEADER => ["Authorization: Bearer " . $key],',
          '            CURLOPT_POSTFIELDS => http_build_query(["amount" => $cents, "currency" => "eur", "customer" => $customerId]),',
          '        ]);',
          '        $out = json_decode(curl_exec($ch), true);',
          '        Reports::log($customerId, $out);   // logs the full response, including the card fingerprint',
          '        return $out;',
          '    }',
          '}'
        ].join('\n') },
        { path: '.env.production', text: [
          'APP_ENV=production',
          'APP_KEY=base64:8pQ2vK1sT0mZ9yR4wN6bH3cJ5dF7gL1a',
          'DB_HOST=db-01.veyra.internal',
          'DB_DATABASE=veyra_prod',
          'DB_USERNAME=veyra_app',
          'DB_PASSWORD=Lindwurm-244!',
          'STRIPE_SECRET=<rotated by ops on 2026-10-30, not included in this dump>',
          'S3_KEY=<revoked 2026-10-30>',
          'S3_SECRET=<revoked 2026-10-30>',
          'MAIL_PASSWORD=Postfach#2026'
        ].join('\n') },
        { path: 'customers-export.csv', text: [
          'id,company,email,country,plan,mrr_eur,last_login,admin_user',
          '1001,Bracken & Co,ops@bracken.example,GB,business,249,2026-10-30,bracken_admin',
          '1002,Vellichor Retail,it@vellichor.example,NL,business,249,2026-10-29,vellichor_it',
          '1003,Halden Logistics,web@halden.example,DE,enterprise,890,2026-11-01,halden_web',
          '1004,Perrin Clinic,admin@perrin.example,FR,starter,49,2026-10-12,perrin_admin',
          '1005,Wexford Media,digital@wexford.example,IE,business,249,2026-10-31,wexford_digital',
          '... 241899 more rows in the full export ...'
        ].join('\n') }
      ]),

    L(3, 'kestrel-brief', 'Government', 'Cabinet briefing — Project KESTREL and the emergency-powers draft',
      'Ministry of the Interior (fictional)', 'GB', '2026-10-19', '412 MB', 618, 'published', ['government', 'policy', 'secrets'],
      'A cabinet briefing pack for a bill that has not been published, plus the legal annex that says the draft probably will not survive a court, and the distribution list showing who has read it.',
      'The gap between the legal advice and the public line is the story: the annex says the powers are unlawful, the briefing says announce them anyway.',
      [
        { path: 'briefing.md', text: [
          '# PROJECT KESTREL — cabinet briefing, 17 October',
          'Classification: SECRET — UK EYES ONLY (simulated)',
          '',
          '## Purpose',
          'To agree the announcement of a new emergency-powers framework before the winter recess.',
          '',
          '## The proposal',
          '1. A duty on network operators to suspend a service on ministerial direction, without prior judicial approval.',
          '2. A power to require retention of "metadata of interest" for 24 months, defined in regulations rather than statute.',
          '3. A criminal offence for disclosing the existence of a direction (see annex A, paragraph 9).',
          '',
          '## Communications',
          '- Announce as a counter-terrorism measure. The Home Office modelling does not support the terrorist-use figure.',
          '- Do not publish annex A. If asked, say the legal position is "settled".',
          '- Brief two friendly outlets the day before; the third will follow.',
          '',
          '## Decision sought',
          'Agreement to publish the draft bill on 12 November and to hold the legal annex.'
        ].join('\n') },
        { path: 'annex-a-legal.txt', text: [
          'ANNEX A — LEGAL ADVICE (privileged, do not circulate)',
          '',
          '9. The disclosure offence is likely to be incompatible with Article 10. A court would probably read in a',
          '   public-interest defence, which would defeat the purpose of the clause.',
          '',
          '11. Ministerial suspension without prior approval is exposed to challenge on proportionality. The',
          '    precedents cited in the briefing are not on point; the strongest authority goes the other way.',
          '',
          '14. The 24-month retention period exceeds what the Court has accepted in the last three judgments.',
          '    A challenge would probably succeed within eighteen months.',
          '',
          'RECOMMENDATION: do not proceed in this form. If the department proceeds regardless, the advice should be',
          'recorded as having been given, and the department should expect to lose the first judicial review.',
          '',
          '— Legal Adviser, 14 October'
        ].join('\n') },
        { path: 'distribution.csv', text: [
          'name,role,read_brief,read_annex,comments',
          'Secretary of State,Cabinet,yes,no,"wants announcement before recess"',
          'Permanent Secretary,Department,yes,yes,"asked for advice to be softened"',
          'Director KESTREL,Programme,yes,no,"says the modelling is being refreshed"',
          'Legal Adviser,Legal,yes,yes,"advice stands"',
          'Special Adviser,Comms,yes,no,"drafted the two friendly briefings"',
          'Private Secretary,Cabinet,yes,yes,"flagged the risk to the SoS in writing"'
        ].join('\n') }
      ]),

    L(4, 'party-2027', 'Politics', 'Party strategy 2027 — segmentation, wedge issues and the swing-seat buys',
      'National Unity Party (fictional)', 'GB', '2026-11-05', '88 MB', 214, 'published', ['politics', 'campaign', 'secrets'],
      'The internal plan for the next general election: which voters to frighten, which to ignore, what each message costs, and the seats where the money goes. Includes the "do not say out loud" page.',
      'Campaign documents are candid in a way press releases never are. The strategy is not a secret policy; it is a secret about the voters.',
      [
        { path: 'strategy.md', text: [
          '# 2027 — the plan (internal, v6)',
          '',
          '## Segmentation',
          '- **C1 "anxious owners"**: 45-64, mortgage, small business. Message: order, borders, parking. Do not mention the NHS',
          '  unless forced; our numbers there are worse than public polling.',
          '- **C2 "renters under 35"**: not persuadable in enough seats. Suppress turnout (see below), do not chase.',
          '- **C3 "civic professionals"**: reachable only through local press. Buy the local press.',
          '',
          '## Wedge issues, in order of tested effect',
          '1. Planning reform in the shire seats (+3.1 net).',
          '2. The transport levy in the northern marginals (-2.4 if we are not careful).',
          '3. School admissions (+1.6, but only in three seats — see buys.csv).',
          '',
          '## Do not say out loud',
          '- The levy is a tax on the people we are telling we are cutting taxes for.',
          '- C2 suppression is legal because it is just "not buying youth media".',
          '- The candidate in Ashcombe North has not been told about the boundary change.'
        ].join('\n') },
        { path: 'wedge-issues.csv', text: [
          'issue,segment,tested_net,seats,risk,line',
          'Planning reform,C1,+3.1,44,developer donations story,local homes for local people',
          'Transport levy,C1,-2.4,17,levy applies to the same voters,we will review the levy',
          'School admissions,C1,+1.6,3,legal challenge pending,schools for the children who live here',
          'Youth turnout,C2,-,12,suppression is visible in ad data,nothing: buy no youth media',
          'Local press,C3,+0.9,28,one editor is hostile,independent local journalism'
        ].join('\n') },
        { path: 'ad-buys.csv', text: [
          'seat,channel,spend_gbp,start,end,creative,note',
          'Ashcombe North,local press,42000,2026-11-15,2027-04-30,AN-04,"editor asked for the levy quote first"',
          'Ashcombe North,outdoor,18000,2026-12-01,2027-03-31,AN-07,',
          'Brackenford,radio,26000,2026-11-20,2027-04-15,BF-02,"presenter is a member"',
          'Carrow Vale,digital,31000,2026-12-05,2027-05-01,CV-01,"exclude under-30 interest groups"',
          'Dunmore,local press,12000,2027-01-10,2027-04-30,DM-03,"paid via the regional pool, not the national account"'
        ].join('\n') }
      ]),

    L(5, 'donor-ledger', 'Politics', 'Donor ledger — the intermediaries, the refunds and the invoices that do not exist',
      'National Unity Party (fictional)', 'GB', '2026-10-30', '24 MB', 96, 'published', ['politics', 'finance', 'secrets'],
      'The compliance ledger as it actually looked before the published version: donations routed through two intermediaries, four refunded after the audit letter, and a set of invoices from a company with no employees.',
      'The published register is not wrong, exactly. It is the same ledger after the interesting rows were refunded.',
      [
        { path: 'ledger.csv', text: [
          'date,donor,intermediary,amount_gbp,permissible,route,notes',
          '2025-11-04,Pellham Trust,Northgate Advisory Ltd,250000,yes,company,"director also runs the media buyer"',
          '2026-01-19,Pellham Trust,Northgate Advisory Ltd,180000,yes,company,',
          '2026-02-27,Cairn Holdings,Northgate Advisory Ltd,420000,no,company,"overseas beneficial owner — refunded after audit letter"',
          '2026-03-11,Dunmore Foundation,none,95000,yes,trust,',
          '2026-04-02,Cairn Holdings,Rowan & Partners,310000,no,company,"invoices for ""strategy services"" — company has no employees"',
          '2026-05-08,Pellham Trust,none,120000,yes,individual,',
          '2026-06-15,Cairn Holdings,Northgate Advisory Ltd,275000,no,company,"refunded 2026-07-01, after publication"'
        ].join('\n') },
        { path: 'memo.txt', text: [
          'From: Compliance',
          'To: Treasurer',
          'Re: the audit letter',
          '',
          'The Commission has asked about the Cairn donations and the Rowan invoices. Our position:',
          '1. The money was refunded, so the register is accurate as published.',
          '2. Rowan & Partners will confirm the services were advisory if asked; they have already agreed to that wording.',
          '3. We should not describe the refunds as "voluntary" in writing again.',
          '',
          'The Treasurer replied: "Fine. But we are not reopening the register."',
          '',
          '— forwarded to the strategy group, 3 July'
        ].join('\n') }
      ]),

    L(6, 'border-audit', 'Government', 'Border entry system audit — the findings that were quietly shelved',
      'Border Systems Directorate (fictional)', 'GB', '2026-09-14', '1.8 GB', 4402, 'published', ['government', 'audit', 'infrastructure'],
      'An external audit of the passport-gate software and its identity matching, including the section on false matches that was removed before the board saw it.',
      'The audit is not a leak of policy. It is a leak of a decision: the finding was written, then deleted from the version that went upstairs.',
      [
        { path: 'audit-findings.md', text: [
          '# Entry Gateway Programme — technical assurance review',
          'Reviewer: external, contract 4412. Date: 2026-08-30. Status: final draft.',
          '',
          '## Summary',
          'The matching service rejects valid travellers more often than the business case allows, and the rejection rate is',
          'uneven across document types. Of 12,000 sampled cases, 214 were false matches that a human had to clear.',
          '',
          '## Findings',
          '1. The name comparison strips diacritics before comparison and never restores them. Names that differ only by a',
          '   diacritic collapse into one record.',
          '2. The date-of-birth field is optional in the upstream feed. Missing dates match any date.',
          '3. There is no rate limit on the manual-clearance queue; during the summer peak the queue reached 9,400.',
          '4. Audit logs rotate every 24 hours and are not exported anywhere.',
          '',
          '## Removed before publication',
          'Section 5.3 (false-match profile by nationality) was cut at the request of the programme board. The data is in',
          'risk-register.csv and has not been reproduced anywhere else.'
        ].join('\n') },
        { path: 'risk-register.csv', text: [
          'id,risk,likelihood,impact,owner,status',
          'R-01,False match on a valid travel document,medium,high,Programme,accepted',
          'R-02,Queue exceeds 9,000 during peak,high,medium,Operations,open',
          'R-03,No retained audit trail,high,high,Security,"risk transferred to supplier"',
          'R-04,False-match rate uneven by document type,high,high,Programme,"not in board pack"',
          'R-05,Supplier has production database access,medium,critical,Commercial,accepted'
        ].join('\n') },
        { path: 'board-note.txt', text: [
          'Board note — 2 September',
          '',
          'The reviewer has asked to publish section 5.3. We are not going to do that.',
          'The section can be read as a finding about how the system treats particular passports, and the programme',
          'does not have the communications capacity to explain it before the winter timetable change.',
          '',
          'Action: tell the reviewer the section is out of scope for the final report. If pressed, say the sampling',
          'methodology was not agreed in advance.',
          '',
          'The queue finding stays in. It is technical and nobody will read it.'
        ].join('\n') }
      ]),

    L(7, 'drone-firmware', 'Defence', 'Kestrel-9 reconnaissance drone — firmware, telemetry keys and flight logs',
      'Meridian Unmanned Systems (fictional)', 'IL', '2026-10-08', '3.4 GB', 1180, 'published', ['defence', 'firmware', 'source code', 'secrets'],
      'Firmware for a reconnaissance drone sold to three governments, the shared telemetry key, the ground-station config and the test-flight logs that show the range figures were doubled.',
      'Firmware leaks are different from documents: once the signing key is out, every unit in the field can be made to accept a build the vendor did not write.',
      [
        { path: 'firmware/main.c', text: [
          '/* kestrel9 flight controller — build 4.11.2 */',
          '#include "link.h"',
          '#include "telemetry.h"',
          '',
          'static const uint8_t TELEM_KEY[16] = {0x4b,0x39,0x2a,0x91,0x00,0x7c,0xde,0x11,0x33,0x9f,0x02,0xab,0x58,0x6e,0xc4,0x21};',
          '',
          'int main(void) {',
          '    board_init();',
          '    link_open(LINK_SAT, 9600);',
          '    telemetry_set_key(TELEM_KEY);',
          '    /* the watchdog resets the link every 30 s if no ground station heartbeat arrives */',
          '    watchdog_arm(30000);',
          '    while (1) {',
          '        if (!link_heartbeat_seen()) { link_reopen(); }',
          '        flight_step();',
          '    }',
          '}',
          '',
          '/* TODO(k9-118): the key is shared across all units because rotation broke the fleet at scale. */'
        ].join('\n') },
        { path: 'firmware/keys.h', text: [
          '#define SIGNING_KEY_0  "K9FW-2024-A"',
          '#define SIGNING_KEY_1  "K9FW-2024-B"   /* current */',
          '#define FACTORY_PASS    "meridian!"',
          '#define GROUND_TOKEN    "gs-token-7712-acde"',
          '/* keys 2 and 3 were revoked but never removed from the bootloader allow-list */'
        ].join('\n') },
        { path: 'test-flights.csv', text: [
          'flight,date,endurance_min,range_km,payload_kg,notes',
          'TF-041,2026-05-11,182,64,2.1,"battery at 60% on landing"',
          'TF-042,2026-05-12,196,71,2.1,"winds aloft 18 kt"',
          'TF-043,2026-06-02,171,58,3.4,"payload overheating above 20 min"',
          'TF-044,2026-06-09,205,74,2.1,"best case, no wind"',
          'TF-045,2026-06-10,163,52,3.4,"aborted at 163 min, link loss"',
          '-- brochure claims 300 min and 120 km. The best flight was 205 min and 74 km in still air.'
        ].join('\n') }
      ]),

    L(8, 'merger-deck', 'Corporate', 'Merger deck — fourteen closures agreed before the announcement',
      'Braemoor Group', 'GB', '2026-10-22', '640 MB', 812, 'published', ['corporate', 'merger', 'secrets'],
      'The internal board deck for an acquisition that is still described publicly as "exploratory talks": synergy targets, the fourteen sites to close, and the paragraph about not putting any of it in writing.',
      'A merger is a plan to make people redundant. The deck is the plan, and the press release is written by the same team a week later.',
      [
        { path: 'board-deck.md', text: [
          '# Project ANVIL — board pack, 20 October',
          'STRICTLY CONFIDENTIAL — not for circulation outside the board',
          '',
          '## The transaction',
          'Acquire Wrenfield Retail for 1.24bn, funded 60/40 debt/equity. Announce as a "merger of equals"; it is not one.',
          '',
          '## Synergies (year one)',
          '- 14 store closures (list attached): 31m of the 38m target.',
          '- 420 head-office roles, mostly in the acquired business.',
          '- Consolidate two distribution centres; the third stays open until the lease ends in 2029.',
          '',
          '## Communications',
          '- Line: "no decisions have been made about any site". This stays true only until the CMA clears it.',
          '- Do not use the word "redundancy" in any internal note that could be forwarded.',
          '- The Wrenfield board has agreed not to tell its regional managers before completion.',
          '',
          '## Risk',
          'If the closure list leaks before the vote, the CMA timetable slips a quarter and the financing costs 12m more.'
        ].join('\n') },
        { path: 'closure-list.csv', text: [
          'site,town,staff,lease_end,planned_action,date',
          'W-014,Wrenfield Central,84,2027-03-31,close,2027-06',
          'W-021,Dunmore Retail Park,61,2026-12-31,close,2027-06',
          'W-033,Ashcombe High Street,29,2028-09-30,close,2027-09',
          'W-041,Carrow Vale,47,2027-06-30,close,2027-06',
          'B-007,Braemoor North,55,2029-01-31,convert to outlet,2027-11',
          '... 9 more rows in the full list ...',
          '# 14 closures, 612 staff, 31m annual saving'
        ].join('\n') },
        { path: 'cfo-note.txt', text: [
          'From: CFO',
          'To: CEO',
          '',
          'On the closures: the numbers work only if we do not consult before the vote. The moment the list is in a',
          'consultation document, it is in the local press, and the vote is about us rather than the deal.',
          '',
          'Legal says we cannot say "no decisions" once the integration committee has met. It has met twice.',
          '',
          'My view: keep the deck to eight copies, no email, and brief the regional managers after completion.'
        ].join('\n') }
      ]),

    L(9, 'payroll-halden', 'Corporate', 'Halden Freight — every salary, bonus and the two contractors off the books',
      'Halden Freight', 'NL', '2026-09-30', '52 MB', 1640, 'published', ['corporate', 'payroll', 'personal data'],
      'The full payroll export for a logistics company: names, roles, gross pay, bonuses, IBANs and the two contractors who are paid but are not on the headcount.',
      'Pay data is the most personal thing most companies hold about their staff, and the most ordinary thing to leak. The interesting part here is the two rows that should not exist.',
      [
        { path: 'payroll-2026.csv', text: [
          'employee,role,gross_eur,bonus_eur,iban,headcount,note',
          'A. de Vries,Operations director,142000,24000,NL91RABO0123456789,yes,',
          'M. Jansen,Depot manager,71000,6000,NL44RABO0987654321,yes,',
          'S. Bakker,Dispatcher,48500,2500,NL12INGB0001234567,yes,shift allowance',
          'R. Kovač,Driver,41200,1200,NL33ABNA0412345678,yes,night routes',
          'T. Osei,Driver,39800,1100,NL55ABNA0498765432,yes,',
          'J. Peeters,"consultant, planning",96000,0,NL66TRIO0199999999,no,"paid monthly, no contract on file"',
          'K. Lindqvist,"consultant, IT",88000,0,NL77TRIO0188888888,no,"also has a login to the planning system"',
          '-- the two consultants are not in the headcount the board sees'
        ].join('\n') },
        { path: 'contractors.txt', text: [
          'The two non-headcount contractors',
          '',
          'J. Peeters — planning. No signed contract. Invoices are approved by the operations director and coded to',
          '"maintenance". Started 2023. The planning system shows the login is shared with the depot manager.',
          '',
          'K. Lindqvist — IT. Contract through a company registered at a residential address. Has production access',
          'and is the only person who can change the routing cuts. Asked twice for a contract; none produced.',
          '',
          'If the auditors ask, both are "temporary support".'
        ].join('\n') }
      ]),

    L(10, 'fx-model', 'Finance', 'Currency desk — trading model, risk limits and the override log',
      'Northbank Markets', 'GB', '2026-11-01', '310 MB', 2210, 'published', ['finance', 'source code', 'trading'],
      'The source of a production FX pricing model, the risk limits it is supposed to respect, and the log of every time a human overrode those limits in the last two years.',
      'A model is a set of assumptions with a rate attached. The override log is where the assumptions were wrong and somebody knew.',
      [
        { path: 'model/quotes.py', text: [
          '""" northbank fx pricing — production model, do not edit without sign-off """',
          'import math',
          '',
          'SPREAD = {"EURUSD": 0.00012, "GBPUSD": 0.00018, "USDJPY": 0.00021}',
          'VOL_CAP = 0.35',
          '',
          'def mid(px, tick=0.00005):',
          '    return round(px / tick) * tick',
          '',
          'def quote(pair, px, vol, size):',
          '    if vol > VOL_CAP:',
          '        # beyond the cap we used to refuse; now we widen and take it anyway (see overrides.log 2026-04)',
          '        return mid(px) * (1 + vol * 0.4)',
          '    skew = math.tanh(size / 5_000_000) * 0.00004',
          '    return mid(px + skew) - SPREAD.get(pair, 0.00025)',
          '',
          'def booking(pair, notional, currency="USD"):',
          '    # converts at the desk rate, not the model rate; nobody reconciles this',
          '    return notional * DESK_RATES[currency]'
        ].join('\n') },
        { path: 'risk_limits.yaml', text: [
          'limits:',
          '  notional_per_pair_usd: 25000000',
          '  volatility_cap: 0.35',
          '  intraday_drawdown_usd: 900000',
          '  stop_loss: required',
          '  exotic_pairs: prohibited',
          'escalation:',
          '  breach_notify: [desk_head, risk]',
          '  breach_tolerance: zero',
          '# note from risk: the model ignores volatility_cap above the cap, it only widens. this was known in April.'
        ].join('\n') },
        { path: 'overrides.log', text: [
          '2025-11-14 09:12 desk_head NOTIONAL_CAP pair=TRYUSD limit=25m size=61m reason="client unwind"',
          '2025-11-14 09:40 risk ACK pair=TRYUSD "one-off, documented"',
          '2025-12-02 11:02 desk_head VOL_CAP pair=EURUSD vol=0.52 size=18m reason="vol spike"',
          '2026-01-19 14:33 desk_head NOTIONAL_CAP pair=GBPUSD limit=25m size=44m reason="quarter end"',
          '2026-03-08 08:55 desk_head STOP_LOSS "manual, hedging"',
          '2026-04-21 10:17 risk ACK VOL_CAP "cap removed in code instead of at booking"',
          '2026-06-30 16:48 desk_head NOTIONAL_CAP pair=EURUSD limit=25m size=52m reason="quarter end"',
          '-- 41 overrides; 9 acknowledged by risk; 3 have no reason beyond "client"'
        ].join('\n') }
      ]),

    L(11, 'ss7-config', 'Telecom', 'Carrier SS7 interconnect — configuration and the lawful-intercept notes',
      'Nordlink Telecom (fictional)', 'NO', '2026-10-12', '780 MB', 3301, 'published', ['telecom', 'infrastructure', 'secrets'],
      'The signalling configuration for a mobile carrier, including which international partners are trusted with what, the subscriber-location query rules, and the internal note about intercept requests that arrived without paperwork.',
      'Signalling is where a phone network trusts its neighbours. The configuration is a map of who that carrier trusts and how far the trust reaches.',
      [
        { path: 'ss7.cfg', text: [
          '# nordlink ss7 interconnect — excerpt (m3ua + sccp)',
          'peer 10.44.2.11  name=DE-CARRIER-1  trust=full   allow=SCMG,MAP-SRI,MAP-PRN',
          'peer 10.44.2.12  name=DE-CARRIER-2  trust=full   allow=SCMG,MAP-SRI,MAP-PRN',
          'peer 10.44.9.4   name=ROAM-HUB-3  trust=limited allow=MAP-SRI',
          'peer 10.44.9.9   name=UNKNOWN-AS  trust=limited allow=MAP-SRI,USSD',
          '# UNKNOWN-AS was added in June for a roaming trial and never reviewed',
          '',
          'sri_rate_limit=0        # 0 means unlimited; a subscriber can be located at line rate',
          'location_privacy=core   # honoured for MAP-SRI, not for USSD callbacks',
          'sms_home_routing=enabled'
        ].join('\n') },
        { path: 'li-notes.md', text: [
          '# Lawful intercept — internal notes, Q3',
          '',
          'Seven requests arrived this quarter. Four had a valid order reference; three did not.',
          'The three without paperwork were implemented anyway, on the word of the requesting officer, because the',
          'alternative was a call from the ministry at 23:00.',
          '',
          'The intercept store is a single filesystem with 90-day retention. Nobody has tested the deletion job since',
          'the migration in February; the monitoring says it errors and the alert is muted.',
          '',
          'Recommendation: stop accepting verbal requests. Recommendation not adopted.'
        ].join('\n') },
        { path: 'partners.csv', text: [
          'partner,country,services,reviewed_by,last_review',
          'DE-CARRIER-1,DE,"SRI,PRN,SCMG",Network,2025-04',
          'DE-CARRIER-2,DE,"SRI,PRN,SCMG",Network,2025-04',
          'ROAM-HUB-3,CH,SRI,Network,2026-01',
          'UNKNOWN-AS,??,SRI,USSD,none,never'
        ].join('\n') }
      ]),

    L(12, 'surveillance-kit', 'Police', 'Police surveillance toolkit — source, operator manual, deployment list',
      'Regional Serious Crime Unit (fictional)', 'US', '2026-09-21', '210 MB', 940, 'published', ['police', 'source code', 'surveillance'],
      'The tool a regional police unit uses to obtain location data from mobile carriers, written by a contractor, with the manual that explains it is "not evidence-grade" and the list of which cases it was used in.',
      'Surveillance software is evidence software. The manual admits the records are approximate, and the deployment list is exactly the cases where that mattered.',
      [
        { path: 'toolkit.py', text: [
          '""" warrant-runner — pulls location records from carrier portals (simulated) """',
          'import requests, json, time',
          '',
          'CARRIERS = {',
          '    "northcell": "https://portal.northcell.example/api",',
          '    "southwire": "https://li.southwire.example/v2",',
          '    "lakecom":   "https://lakecom.example/records",',
          '}',
          '',
          'def pull(carrier, msisdn, start, end, token):',
          '    url = CARRIERS[carrier] + "/locate"',
          '    # the carrier rounds to cell tower, not GPS; the report never says so',
          '    r = requests.get(url, params={"msisdn": msisdn, "from": start, "to": end},',
          '                     headers={"Authorization": "Bearer " + token}, timeout=30)',
          '    return r.json().get("points", [])',
          '',
          'def report(case, points):',
          '    return {"case": case, "points": len(points), "accuracy": "tower", "caveat_printed": False}',
        ].join('\n') },
        { path: 'manual.md', text: [
          '# Warrant Runner — operator manual (v3.2)',
          '',
          '## What this produces',
          'A tower-level location history. It is **not** GPS and it is **not** evidence-grade on its own. The output',
          'must not be described in a warrant application as the suspect\'s precise location.',
          '',
          '## Known limitations',
          '- Records are rounded to the serving cell; a cell can be 3 km wide in rural areas.',
          '- Carriers return records with different time zones and no offset. The tool does not normalise them.',
          '- Duplicate rows appear when the subscriber re-registers. Deduplication is manual.',
          '- If a request fails, the tool retries three times and then returns an empty list — indistinguishable from',
          '  "no records" in the report.',
          '',
          '## Required approvals',
          'A signed order reference is required for every query. The tool does not check this. Operators are told to',
          'enter "PENDING" when the order has not arrived yet; PENDING queries are still sent.'
        ].join('\n') },
        { path: 'deployments.csv', text: [
          'case,carrier,msisdn,order_ref,start,end,points,used_in_court',
          '24-0411,northcell,+15550100,ORD-8821,2026-02-11,2026-02-18,1421,no',
          '24-0418,southwire,+15550144,PENDING,2026-02-19,2026-02-26,88,yes',
          '24-0431,lakecom,+15550177,ORD-8844,2026-03-02,2026-03-09,0,no',
          '24-0455,northcell,+15550102,ORD-8890,2026-03-21,2026-04-01,2210,yes',
          '-- case 24-0431 shows zero points because the request failed, not because the phone was off'
        ].join('\n') }
      ]),

    L(13, 'trial-adverse', 'Healthcare', 'Phase III trial — the adverse events that were left out of the submission',
      'Calderon Therapeutics (fictional)', 'CH', '2026-10-03', '1.2 GB', 2604, 'published', ['healthcare', 'research', 'data'],
      'The line-level adverse-event dataset from a Phase III trial, the statistical analysis plan as it was amended, and the email that decides which events count as "related".',
      'The published paper reports a rate. The dataset reports the events. The difference is the information a patient needs.',
      [
        { path: 'adverse-events.csv', text: [
          'subject,arm,event,grade,serious,related_per_protocol,related_per_email',
          'S-0104,treatment,hepatic enzyme rise,3,yes,yes,yes',
          'S-0112,treatment,hepatic enzyme rise,4,yes,yes,"yes, but reported as intercurrent"',
          'S-0119,treatment,rash,2,no,no,no',
          'S-0127,treatment,hepatic enzyme rise,3,yes,yes,yes',
          'S-0131,placebo,headache,1,no,no,no',
          'S-0148,treatment,acute kidney injury,4,yes,"no, pre-existing"',"no",
          '... 2603 more rows ...',
          '# 6 treatment-arm grade 3+ hepatic events in 412 subjects; the paper reports 2'
        ].join('\n') },
        { path: 'sap-amendment-3.txt', text: [
          'STATISTICAL ANALYSIS PLAN — AMENDMENT 3',
          'Effective 2026-04-18, after unblinding of the first 300 subjects.',
          '',
          'Change 1: the primary safety endpoint moves from "treatment-related grade 3+ events" to "treatment-related',
          'grade 3+ events leading to discontinuation".',
          '',
          'Change 2: events assessed as "intercurrent" are summarised separately and excluded from the primary table.',
          '',
          'Change 3: the hepatic monitoring window is shortened from 12 weeks to 8 weeks.',
          '',
          'Rationale (as written): "to align with the comparator label".',
          'Rationale (not written): the original endpoint was not going to be met.'
        ].join('\n') },
        { path: 'email-thread.txt', text: [
          'From: Biostatistics', 'To: Clinical lead', 'Subject: RE: hepatic events',
          '',
          '> We have six grade 3+ hepatic events in the treatment arm.',
          '',
          'Four of them are clearly related. If we apply the amendment, only the two that led to discontinuation',
          'remain in the primary table. That is defensible and it is what the label comparison needs.',
          '',
          'The two "intercurrent" ones: the investigator called one of them related on the form. Do not change the',
          'form. Describe it as pre-existing in the narrative and keep it out of the table.',
          '',
          'Nobody is hiding an event. We are choosing the endpoint. There is a difference, and the difference is legal.'
        ].join('\n') }
      ]),

    L(14, 'scada-grid', 'Energy', 'Regional grid — SCADA diagrams, default credentials and the vendor backdoor',
      'Eastern Grid Operator (fictional)', 'PL', '2026-09-08', '2.7 GB', 1502, 'published', ['energy', 'infrastructure', 'credentials'],
      'Network diagrams for a transmission operator, the credentials file for the substation gateways, and the vendor service account that every site shares.',
      'Industrial control leaks are not embarrassing, they are physical. A credential file for a substation gateway is a key to a machine that moves electricity.',
      [
        { path: 'substations.csv', text: [
          'site,name,gateway,vlan,protocol,firmware,shared_vendor_account',
          'S-01,Brackenford 400kV,10.90.4.11,40,DNP3,3.2.1,svc-vendor',
          'S-02,Dunmore 220kV,10.90.4.12,40,DNP3,3.2.1,svc-vendor',
          'S-03,Carrow Vale 132kV,10.90.4.13,40,Modbus/TCP,3.1.9,svc-vendor',
          'S-04,Ashcombe 132kV,10.90.4.14,40,Modbus/TCP,3.1.9,svc-vendor',
          '-- the vendor account was supposed to be disabled after commissioning in 2021'
        ].join('\n') },
        { path: 'credentials.txt', text: [
          'Substation gateways — maintenance credentials (keep offline, do not email)',
          '',
          'svc-vendor / Vendor#2021        (all sites)',
          'operator   / Grid!Operator24    (S-01, S-02)',
          'localadmin / localadmin          (S-03, S-04, never changed)',
          'engineering/ Eng1neering        (historically used for firmware upload)',
          '',
          'The vendor account can push firmware to every gateway from the management VLAN. It does not have MFA',
          'because "the gateways do not support it".'
        ].join('\n') },
        { path: 'network.md', text: [
          '# Control network — how it fits together (internal)',
          '',
          'Internet -> corporate VPN -> jump host (10.90.1.5) -> management VLAN 40 -> substation gateways.',
          '',
          'The jump host allows RDP from any corporate laptop. Credentials are cached locally.',
          '',
          'There is a firewall between VLAN 40 and the corporate network. It has a permit for 10.90.4.0/24 any-any',
          'added during commissioning (change CHG-4412) and never removed. There is no IDS on VLAN 40.',
          '',
          'Historically the gateways were reachable from the internet on port 20000. That was closed in 2022 after',
          'the incident in the north, but three sites kept the old rule in their local firewall.'
        ].join('\n') }
      ]),

    L(15, 'settlement-nda', 'Legal', 'Settlement agreement — the harassment claim, the NDA and the payment schedule',
      'Braemoor Group', 'GB', '2026-08-27', '18 MB', 84, 'published', ['legal', 'corporate', 'personal data'],
      'A signed settlement between a company and a former employee, the side letter that explains what the NDA is for, and the payment schedule showing the instalments were conditional on silence.',
      'An NDA is a document about who is allowed to describe what happened. Here the description is already in the claim, attached as an annex.',
      [
        { path: 'settlement.md', text: [
          'SETTLEMENT AGREEMENT',
          'Between Braemoor Group (“the Company”) and [former employee] (“the Claimant”).',
          '',
          '1. The Claimant withdraws all claims in the employment tribunal with prejudice.',
          '2. The Company pays 185,000 in twelve monthly instalments, the first within 30 days of signature.',
          '3. The Claimant agrees not to disclose the existence or terms of this agreement, except to immediate family,',
          '   a lawyer, or as required by law.',
          '4. Clause 3 does not prevent the Claimant from making a protected disclosure, but the Claimant accepts that',
          '   any such disclosure will be treated as a breach of this agreement.',
          '5. Both parties agree the payment reflects a commercial settlement and not an admission of liability.',
          '',
          'Signed: COO (for the Company) and the Claimant, 26 August 2026.'
        ].join('\n') },
        { path: 'side-letter.txt', text: [
          'PRIVATE AND CONFIDENTIAL — not part of the agreement',
          '',
          'The Company will pay instalments 7-12 only if, in the Company\'s reasonable opinion, the Claimant has',
          'complied with clause 3. The Company will notify the Claimant in writing before withholding an instalment.',
          '',
          'For the avoidance of doubt, the Claimant\'s statutory rights are not affected. The Company\'s position is',
          'that they are, and that no tribunal will read the side letter because it is not part of the agreement.',
          '',
          '— General Counsel, handwritten note in the margin: "this is the part that is indefensible"'
        ].join('\n') },
        { path: 'payments.csv', text: [
          'instalment,due,amount_gbp,paid,note',
          '1,2026-09-25,15417,yes,',
          '2,2026-10-25,15417,yes,',
          '3,2026-11-25,15417,yes,',
          '4,2026-12-25,15417,pending,"held: claimant spoke to a journalist"',
          '5,2027-01-25,15417,pending,"same"',
          '... 8 more rows ...',
          '# payments 4-12 were stopped; the claimant\'s solicitors have written twice'
        ].join('\n') }
      ]),

    L(16, 'stories-killed', 'Media', 'Newsroom — the stories killed on legal advice, with the advice',
      'The Meridian (fictional)', 'GB', '2026-09-19', '96 MB', 412, 'published', ['media', 'legal', 'secrets'],
      'The internal kill list of a national newsroom: investigations that were ready to publish and were stopped, with the legal note that stopped them and the editor who signed it off.',
      'A press that cannot be seen to bury stories is the whole point of a press. The list is the gap between what the newsroom knew and what it printed.',
      [
        { path: 'kill-list.csv', text: [
          'date,story,journalist,stage,reason,decision_by',
          '2026-02-11,The care home group and the missing inspections,R. Adeyemi,ready,"""potential contempt, injunction application expected""",Legal/Editor',
          '2026-03-04,Party donor and the planning consent,S. Kalra,legalled,"""defamation risk: the document is real, the inference is not""",Editor',
          '2026-04-22,The water company and the discharge logs,T. Okoro,ready,"""commercial: advertiser is the parent company""",Commercial',
          '2026-05-30,Minister\'s shareholding timing,P. Vance,investigating,none recorded,Desk head',
          '2026-06-14,Police unit and the location data,L. Mbeki,ready,"""source protection: source withdrew after second approach""",Editor'
        ].join('\n') },
        { path: 'email-thread.txt', text: [
          'From: Commercial Director', 'To: Editor', 'Subject: RE: the water piece',
          '',
          'The parent company spends 1.4m with us across print and digital. The piece is accurate and I am not asking',
          'you to kill it. I am asking whether it can run after the trading update.',
          '',
          'Editor: when is the trading update?',
          'Commercial: two weeks. It will not be news then.',
          '',
          'Editor: then it is not a decision about news, it is a decision about money. Fine. Hold it.',
          '',
          'Note to self: do not put "commercial" in the kill-list reason for any story the newsroom might ask about.'
        ].join('\n') },
        { path: 'legal-note.txt', text: [
          'LEGAL NOTE — the care home story',
          '',
          'The inspections documents are authentic. Publishing them is likely lawful.',
          '',
          'The risk is not the documents, it is the headline: "care home group ignored inspections" is a finding we',
          'cannot support from the documents, which show a delay and no record of the outcome. The group has already',
          'instructed solicitors and will apply for an injunction on the morning of publication.',
          '',
          'Recommendation: publish the documents with a headline that describes the delay, not the motive. The desk',
          'has decided not to publish at all. That is not a legal decision and should not be recorded as one.'
        ].join('\n') }
      ]),

    L(17, 'consent-records', 'Research', 'Research institute — consent records and the participants who withdrew',
      'Ashcombe Institute (fictional)', 'CA', '2026-08-30', '420 MB', 1188, 'published', ['research', 'healthcare', 'personal data'],
      'Participant consent forms, the withdrawal register, and the internal note that says the analysis kept the withdrawn samples because re-running it "would cost six months".',
      'Consent records are the part of research nobody reads until it goes wrong. The withdrawal register is the part that proves it did.',
      [
        { path: 'consent.csv', text: [
          'participant,cohort,consent_date,withdrawn,withdrawn_date,samples_retained,notes',
          'P-0041,A,2024-03-11,no,,yes,',
          'P-0052,A,2024-03-19,yes,2025-01-08,yes,"requested deletion twice"',
          'P-0067,B,2024-05-02,no,,yes,',
          'P-0073,B,2024-05-14,yes,2025-03-22,yes,"withdrew after adverse event"',
          'P-0089,C,2024-07-30,yes,2025-06-01,no,"deleted on request"',
          '-- 43 withdrawals in total; 39 of them still have samples in the freezer'
        ].join('\n') },
        { path: 'withdrawals.md', text: [
          '# Withdrawal handling — internal note',
          '',
          'The consent form says a participant may withdraw at any time and that samples will be destroyed.',
          '',
          'In practice we mark the participant withdrawn in the database and stop using their data in *new* analyses.',
          'The samples stay in the freezer because the cohort linkage breaks if we remove them, and the statistician',
          'says re-running the primary analysis would cost six months.',
          '',
          'The ethics committee has not been told. The view was that withdrawal numbers were a reporting detail and',
          'not a protocol deviation.',
          '',
          'If this is ever audited, the consent form is the problem, not the database.'
        ].join('\n') }
      ]),

    L(18, 'exam-bank', 'Education', 'National exam bank — every paper, the marking scheme and the resit list',
      'National Examinations Board (fictional)', 'IE', '2026-05-28', '880 MB', 3104, 'published', ['education', 'government', 'data'],
      'The item bank for two national qualifications: papers, answer keys, the marking scheme, and the list of schools whose results were adjusted in the moderation meeting.',
      'An exam is a promise that the mark means something. The item bank is that promise, and the moderation list is where it was quietly changed.',
      [
        { path: 'papers.csv', text: [
          'subject,level,paper,questions,in_bank,published,used',
          'Mathematics,Higher,P2,8,412,yes,2026',
          'Mathematics,Ordinary,P1,10,388,yes,2026',
          'Physics,Higher,P1,9,201,yes,2026',
          'History,Ordinary,P2,6,144,no,reserve',
          '-- 3,104 items; 780 of them have not been used and are marked "reserve" for 2027'
        ].join('\n') },
        { path: 'marking.md', text: [
          '# Marking scheme — Mathematics Higher P2 (2026)',
          '',
          'Q3 (b) A correct method with an arithmetic slip gets 4 of the 6 marks.',
          'Q3 (c) The scheme expects the substitution, not the answer. Answers only get 1 mark.',
          'Q7 The published scheme says 5 marks for the proof; the Chief Examiner\'s note says 7 because the paper',
          '     was harder than intended. The 7 is applied but not published.',
          '',
          'Moderation: where a school\'s mean falls more than 1.5 standard deviations from its historical mean, the',
          'results were adjusted upward. The adjustment is not shown on the candidate\'s statement.'
        ].join('\n') },
        { path: 'moderation.csv', text: [
          'school,subject,raw_mean,adjusted_mean,reason,approved_by',
          'St Brigid\'s,Mathematics H,54.1,58.0,"cohort anomaly",Board',
          'Coláiste na Mara,Physics H,49.8,52.5,"teacher absent for term",Board',
          'Dunmore CC,History O,61.2,60.0,"adjustment downward, no reason recorded",Chair',
          '-- 41 schools adjusted; 3 adjusted downward'
        ].join('\n') }
      ]),

    L(19, 'water-scada', 'Infrastructure', 'Water utility — pump station passwords and the alarm disable list',
      'Ashcombe Water (fictional)', 'GB', '2026-07-16', '190 MB', 720, 'published', ['infrastructure', 'credentials', 'energy'],
      'The credentials for remote pump stations, the telemetry mapping, and the list of alarms that were disabled because they kept firing at night.',
      'A disabled alarm is a decision to stop knowing something. Read the list, then read the date each one was disabled.',
      [
        { path: 'pumps.csv', text: [
          'station,telemetry_id,modem_ip,username,password,alarm_profile',
          'PS-04 Brackenford,4412,10.70.12.4,psadmin,Pump!Station4,reduced',
          'PS-07 Dunmore,4419,10.70.12.7,psadmin,Pump!Station7,reduced',
          'PS-11 Carrow,4426,10.70.12.11,psadmin,Pump!Station11,none',
          'PS-13 Ashcombe,4431,10.70.12.13,psadmin,Pump!Station13,none',
          '-- one password pattern for every station, unchanged since 2019'
        ].join('\n') },
        { path: 'disabled-alarms.txt', text: [
          'Alarms disabled at the request of the operations team',
          '',
          'PS-11 high-level float           disabled 2025-11-02  "firing every night, sensor is fine"',
          'PS-11 pump 2 current overload     disabled 2025-11-02  same request',
          'PS-13 telemetry heartbeat loss    disabled 2026-01-19  "too noisy after the modem swap"',
          'PS-13 overflow risk              disabled 2026-02-04  "cover alarm, reviewed quarterly"',
          '',
          'Review note (2026-06): the quarterly review has not happened. The sensor at PS-11 was replaced in April and',
          'the alarm was not re-enabled because nobody owned the change.'
        ].join('\n') }
      ]),

    L(20, 'lumen-sdk', 'Source code', 'Lumen Health SDK — telemetry keys and the analytics pipeline',
      'Lumen Health', 'US', '2026-10-25', '410 MB', 1880, 'published', ['source code', 'healthcare', 'secrets'],
      'The client SDK embedded in a health app used by 2.4 million people: the analytics tracker, the key it uploads with, and the SQL that joins app usage to appointment records.',
      'Health data is not just the record. It is also the behaviour around the record, and this SDK collects the behaviour with a key that is in every installed app.',
      [
        { path: 'sdk/LumenTracker.kt', text: [
          'package com.lumenhealth.sdk',
          '',
          'object LumenTracker {',
          '    private const val ENDPOINT = "https://ingest.lumenhealth.example/v2/events"',
          '    private const val WRITE_KEY = "lmn_live_7f3a91c4e8b2"   // shipped in every build',
          '',
          '    fun track(event: String, props: Map<String, String>) {',
          '        val payload = props + mapOf(',
          '            "event" to event,',
          '            "install_id" to Install.id(),',
          '            "screen" to Screen.current(),',
          '            "ts" to System.currentTimeMillis().toString()',
          '        )',
          '        // no consent check here: consent is handled (they think) by the host app',
          '        Net.post(ENDPOINT, WRITE_KEY, payload)',
          '    }',
          '}'
        ].join('\n') },
        { path: 'pipeline.sql', text: [
          '-- joins app telemetry to appointment records, managed by the analytics team',
          'CREATE OR REPLACE VIEW patient_behaviour AS',
          'SELECT a.patient_id, a.appointment_at, a.clinic_id,',
          '       e.event, e.screen, e.ts, u.install_id, u.device',
          'FROM appointments a',
          'JOIN telemetry e ON e.patient_hash = encode(a.patient_id::text, \'sha256\')',
          'JOIN installs u  ON u.install_id = e.install_id',
          'WHERE a.appointment_at > now() - interval \'18 months\';',
          '-- the view is readable by the whole analytics role (14 people). No row-level security.'
        ].join('\n') },
        { path: 'keys.env', text: [
          'LUMEN_WRITE_KEY=lmn_live_7f3a91c4e8b2',
          'LUMEN_ADMIN_TOKEN=lmn_adm_2b9c44e1',
          'SNOWFLAKE_PASSWORD=Analytics#2026',
          'S3_EXPORT_BUCKET=lumen-exports-prod',
          '-- the export bucket was public for 11 days in July'
        ].join('\n') }
      ]),

    L(21, 'data-broker', 'Personal data', 'Data broker — 4.1 million profiles, the source column and the opt-out list nobody processed',
      'Brightpath Data (fictional)', 'US', '2026-11-08', '22 GB', 4104220, 'published', ['personal data', 'corporate', 'privacy'],
      'A broker\'s profile table: names, addresses, inferred income, inferred health interests, the source each field was bought from, and the 61,000 opt-out requests that were marked received and never actioned.',
      'Broker data is assembled from everything else. The source column is the map of who sold what, and the opt-out list is the proof that the map was never meant to be cleaned.',
      [
        { path: 'profiles-sample.csv', text: [
          'profile_id,name,postcode,inferred_income_band,inferred_health_flags,source,opt_out',
          'P-881201,"[redacted]",AB1 2CD,"£45-60k","none",loyalty_scheme,no',
          'P-881202,"[redacted]",AB1 2CD,"£60-80k","diabetes interest",pharmacy_list,no',
          'P-881203,"[redacted]",AB3 4EF,"£18-25k","none",survey_panel,yes',
          'P-881204,"[redacted]",AB3 4EF,"£80k+","mobility aids",medical_supplier,no',
          '-- 4,104,220 rows; the sample above is the anonymised preview'
        ].join('\n') },
        { path: 'opt-outs.md', text: [
          '# Opt-out handling — as it actually worked',
          '',
          'Opt-out requests arrive by post, by email and through the website form.',
          '',
          'The website form writes to `optout_queue`. Nothing reads `optout_queue`. It was built in 2022 and the job that',
          'was supposed to process it was never deployed.',
          '',
          '61,412 requests are in the queue. The oldest is from 2023-04-17. The compliance report says "all requests',
          'actioned within 30 days" because it counts the rows in `optout_processed`, which only ever received postal',
          'requests.',
          '',
          'Fix estimate: two days of engineering. It has been in the backlog for three years.'
        ].join('\n') }
      ])

  ];

  /* ---------------------------------------------------------------- pages */
  const CATS = () => {
    const out = {};
    ARCHIVE.forEach(l => { out[l.cat] = (out[l.cat] || 0) + 1; });
    return out;
  };
  const bySlug = slug => ARCHIVE.find(l => l.slug === String(slug || '').toLowerCase()) || null;

  const badge = t => '<span style="display:inline-block;border:1px solid #4a1c24;background:#1a0a0e;color:#ff8a94;font-size:10px;padding:2px 7px;letter-spacing:.1em;text-transform:uppercase">' + esc(t) + '</span>';
  const link = (href, text) => '<a href="' + esc(href) + '">' + esc(text) + '</a>';

  function homeSection() {
    const latest = ARCHIVE.slice().sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 6);
    return '<h2>Archive</h2>' +
      '<p>' + ARCHIVE.length + ' batches across ' + Object.keys(CATS()).length + ' categories — source code, games, government, politics, defence, finance, telecom, police, health, energy, legal, media, research, education, infrastructure. ' +
      'Every batch is browsable here and downloadable as individual files: ' + link('/archive', 'open the archive') + '.</p>' +
      '<table><tr><th>Date</th><th>Batch</th><th>Category</th><th>Volume</th></tr>' +
      latest.map(l => '<tr><td style="color:#7c4c53">' + esc(l.at) + '</td><td>' + link('/leak/' + l.slug, l.title) +
        '<div style="color:#7c4c53;font-size:11px">' + esc(l.org) + ' · ' + esc(l.country) + '</div></td>' +
        '<td>' + esc(l.cat) + '</td><td style="color:#b5929a">' + esc(l.size) + '</td></tr>').join('') + '</table>';
  }

  function archivePage(query) {
    const q = String(query && query.get ? (query.get('q') || '') : '').trim().toLowerCase();
    const cat = String(query && query.get ? (query.get('cat') || '') : '').trim();
    const list = ARCHIVE.filter(l => (!cat || l.cat.toLowerCase() === cat.toLowerCase()) &&
      (!q || (l.title + ' ' + l.org + ' ' + l.cat + ' ' + l.summary + ' ' + l.tags.join(' ')).toLowerCase().includes(q)));
    const cats = CATS();
    const groups = {};
    list.forEach(l => { (groups[l.cat] = groups[l.cat] || []).push(l); });
    return { kind: 'page', title: 'Archive', html:
      '<h1>Archive</h1>' +
      '<p style="color:#b5929a">' + ARCHIVE.length + ' batches, ' + Object.keys(cats).length + ' categories, ' +
        ARCHIVE.reduce((n, l) => n + l.docs.length, 0) + ' published files. Each batch page lists its files; every file has its own address and can be read with curl.</p>' +
      '<form action="/archive" method="get" style="display:flex;gap:8px;margin:14px 0"><input name="q" value="' + esc(query && query.get ? query.get('q') || '' : '') + '" placeholder="search the archive — payroll, powers, firmware, trial"><button>Search</button></form>' +
      '<p style="color:#7c4c53;font-size:12px">Categories: ' + Object.keys(cats).sort().map(c => link('/archive?cat=' + encodeURIComponent(c), c + ' (' + cats[c] + ')')).join(' · ') + '</p>' +
      (q ? '<p style="color:#ff8a94">' + list.length + ' batch(es) match “' + esc(q) + '”</p>' : '') +
      Object.keys(groups).sort().map(c => '<h2>' + esc(c) + '</h2><table><tr><th>Batch</th><th>Source</th><th>Date</th><th>Volume</th></tr>' +
        groups[c].map(l => '<tr><td>' + link('/leak/' + l.slug, l.title) + '<div style="color:#7c4c53;font-size:11px">' + esc(l.summary.slice(0, 120)) + '…</div></td>' +
          '<td>' + esc(l.org) + '<div style="color:#7c4c53;font-size:11px">' + esc(l.country) + '</div></td>' +
          '<td>' + esc(l.at) + '</td><td>' + esc(l.size) + ' · ' + l.count.toLocaleString('en-US') + ' files</td></tr>').join('') + '</table>').join('')
    };
  }

  function leakPage(leak) {
    const files = leak.docs.map(d => '<tr><td>' + link('/raw/' + leak.slug + '/' + d.path, d.path) +
      '</td><td style="color:#7c4c53">' + fmtSize(d.text.length) + '</td><td style="color:#7c4c53">' + esc(d.path.split('.').pop()) + '</td></tr>').join('');
    const preview = leak.docs[0] ? leak.docs[0].text.split('\n').slice(0, 14).join('\n') : '';
    return { kind: 'page', title: leak.title, html:
      '<p style="color:#7c4c53;font-size:12px"><a href="/archive">← archive</a> · <a href="/archive?cat=' + encodeURIComponent(leak.cat) + '">' + esc(leak.cat) + '</a></p>' +
      '<h1>' + esc(leak.title) + '</h1>' +
      '<p style="color:#7c4c53;font-size:12px">' + esc(leak.org) + ' · ' + esc(leak.country) + ' · ' + esc(leak.at) + ' · ' + esc(leak.size) + ' · ' + leak.count.toLocaleString('en-US') + ' files · ' + badge(leak.status) + '</p>' +
      '<p style="color:#b5929a">' + esc(leak.summary) + '</p>' +
      '<h2>Why it matters</h2><p style="color:#b5929a">' + esc(leak.why) + '</p>' +
      '<h2>Files in this batch</h2><table><tr><th>Path</th><th>Size</th><th>Type</th></tr>' + files + '</table>' +
      '<p style="margin-top:10px">' + link('/download/' + leak.slug + '.torrent', 'whole batch as a .torrent') + ' · ' +
        link('/raw/' + leak.slug + '/' + leak.docs[0].path, 'read the first file') + '</p>' +
      '<h2>Preview — ' + esc(leak.docs[0].path) + '</h2><pre>' + esc(preview) + '\n…</pre>' +
      '<div style="border-left:3px solid #ff5f6d;background:#12080a;padding:10px 14px;margin:16px 0;color:#d6b8bd">' +
        'Simulated leak. The organisation, the documents, the keys and the people named are invented for this playground; ' +
        'nothing here was taken from a real system.</div>'
    };
  }

  function torrentOf(leak) {
    const name = leak.slug + '-ghost.tar.gz';
    const announce = 'udp://tracker.ghostmirror.onion:6969/announce';
    const pieces = '\\x' + 'ab'.repeat(20);
    return 'd8:announce' + announce.length + ':' + announce +
      '4:infod6:lengthi' + (leak.count * 1048576) + 'e4:name' + name.length + ':' + name +
      '12:piece lengthi262144e6:pieces20:' + pieces + '7:privatei1eee';
  }

  /* ---------------------------------------------------------------- routing
     `route` answers only the archive's own addresses. The leak site wraps a page result in its own chrome and
     returns raw results (files, torrents) untouched, so moundshell sees a real body and a real content type. */
  function route(path, query) {
    const p = String(path || '/');
    if (p === '/archive' || p === '/leaks' || p === '/releases') return archivePage(query);
    if (p === '/categories') {
      const cats = CATS();
      return { kind: 'page', title: 'Categories', html: '<h1>Categories</h1><table><tr><th>Category</th><th>Batches</th></tr>' +
        Object.keys(cats).sort().map(c => '<tr><td>' + link('/archive?cat=' + encodeURIComponent(c), c) + '</td><td>' + cats[c] + '</td></tr>').join('') + '</table>' };
    }
    if (/^\/leak\/[a-z0-9-]+$/i.test(p)) {
      const leak = bySlug(p.split('/').pop());
      if (!leak) return { kind: 'raw', status: 404, type: 'text/html', body: '<h1>404</h1><p>No such batch in the archive.</p>' };
      return leakPage(leak);
    }
    if (/^\/raw\/[a-z0-9-]+\/.+$/i.test(p)) {
      const parts = p.split('/');
      const leak = bySlug(parts[2]);
      const want = decodeURIComponent(parts.slice(3).join('/'));
      const doc = leak && leak.docs.find(d => d.path === want);
      if (!doc) return { kind: 'raw', status: 404, type: 'text/plain', body: '404 No such file in this batch.\n' };
      const ext = String(doc.path.split('.').pop()).toLowerCase();
      const type = ext === 'json' ? 'application/json' : ext === 'csv' ? 'text/csv' :
        ext === 'md' ? 'text/markdown' : ext === 'sql' ? 'application/sql' : 'text/plain';
      return { kind: 'raw', status: 200, type, body: doc.text + '\n' };
    }
    if (/^\/download\/[a-z0-9-]+\.torrent$/i.test(p)) {
      const leak = bySlug(p.split('/').pop().replace(/\.torrent$/, ''));
      if (!leak) return { kind: 'raw', status: 404, type: 'text/plain', body: '404 unknown torrent\n' };
      return { kind: 'raw', status: 200, type: 'application/x-bittorrent', body: torrentOf(leak) };
    }
    return null;
  }

  return {
    archive: ARCHIVE, route, homeSection, bySlug, categories: CATS,
    count: () => ARCHIVE.length,
    files: () => ARCHIVE.reduce((n, l) => n + l.docs.length, 0),
    paths: () => ['/archive', '/categories'].concat(ARCHIVE.slice(0, 6).map(l => '/leak/' + l.slug))
  };
})();
if (typeof A !== 'undefined') A.cyberLeaks = CyberDarkLeaks;
