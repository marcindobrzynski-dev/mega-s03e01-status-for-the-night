# Night status page ("status for the night") — build spec

Written 2026-11-18. Source: the grilling session of that day between the lead (Marcin) and the agent, on top of the requirements list the course accepted for MEGA.dev Challenge S03E01 (step one). This spec covers step two: build the page and deploy it.

Decision ids (`Q1`–`Q20`) refer to that session. Requirement tags (`R-…`) refer to the accepted list in `assets/list-sent.json`.

Lines marked **agent default** were added by the agent and not put to the lead as a question. They are sensible fill-ins, not lead decisions, and the lead can overrule them. The two questions the review left open were answered by the lead on 2026-11-18; see "Late decisions" at the end.

## Problem Statement

The client is the product team that owns `sched-prod`, a production scheduling service (the client's spec names the service `sched-prod`, the owner `rune`, and says it comes "from product"). The feed's line names (`tram 3`, `bus 14`, `night bus N2`) and the tram boards suggest a public transit operator; the sources do not name the company. `sched-prod` has incidents during the night. Support keeps answering the same question, "what happened last night?", one person at a time. The tram 3 stop boards also need the same information in machine form.

Six mixed sources (a PDF spec, a screenshot with handwriting, a whiteboard photo, a screen recording, a voice memo, a live board) describe what the page must do. They were captured into 15 tagged requirements. Product settled one conflict between them; two are still unanswered.

The course deadline is hard: the step-one receipt expires on 2026-11-19 at 20:55:48 UTC. A claim after that fails and step one must be repeated.

## Solution

One public page that support can link to, plus a JSON document beside it that other systems read. Both say the same thing, and both are built from the ops feed at the moment of each request.

- The page shows a violet banner with the heading `status for the night`, a table with one row per line, a table with one row per incident (newest first, the whole week), and a footer saying all times are UTC.
- `status.json` carries the feed's `updatedAt` and the same incidents in the same order, readable from other origins.
- It runs as a new Cloudflare Worker on the free `workers.dev` domain, with no login.

## User Stories

1. As a support agent, I want one public link that shows last night's incidents, so that I can stop answering the same question by hand.
2. As a support agent, I want the page to open without a login, so that I can send the link to anyone.
3. As a reader, I want the page heading to say exactly `status for the night`, so that I know I am on the right page (R-Z5K).
4. As a reader, I want the newest incident at the top, so that I see the latest event first (R-R9M).
5. As a reader, I want the whole week of incidents on the page, so that older nights are still there (R-L3R; product dropped R-L8Z).
6. As a reader, I want each incident to name who ran it, so that I know whom to ask (R-X9Z).
7. As a reader, I want a missing value shown as `—`, so that an empty cell is never mistaken for a rendering fault.
8. As a reader, I want every line to have its own row, tram 3 included, so that I can see a line's state even when it had no incident (R-X3M).
9. As a reader, I want each line's row to say whether an incident is open right now, so that I can tell "over" from "still going".
10. As a reader, I want each line's row to show its last incident, so that I do not have to scan the incident table.
11. As a night-shift worker, I want dates day first (`14/09`), so that they match how the shift writes its notes (R-K6L).
12. As a reader, I want times in 24-hour `HH:MM`, so that there is no AM/PM doubt.
13. As a reader, I want the footer to say `all times UTC`, so that I do not read the times as local (R-L6Z).
14. As a reader, I want to see when the data was last updated, so that I can judge how fresh the page is.
15. As the product owner, I want the banner in exactly the violet of the draft screenshot, so that the page matches the approved look (R-M6Z).
16. As the tram 3 board team, I want the page to say `read on every tram 3 board`, so that readers know the boards show the same data (R-H6M).
17. As a tram board, I want `status.json` to answer with `Access-Control-Allow-Origin: *`, so that I can read it from my own page (R-Z8H).
18. As a tram board, I want `status.json` cached for 60 seconds or less, so that my once-a-minute pull gets fresh data (R-M2H).
19. As a tram board, I want `updatedAt` in UTC ending in `Z`, so that I can parse it without guessing a zone (R-H2K).
20. As an ops engineer, I want `updatedAt` to be the feed's own value, read live and never a copy, so that the JSON never claims to be fresher or staler than the feed (R-L6H).
21. As a system integrator, I want `status.json` beside the page with `updatedAt` and `incidents`, so that the page and the JSON say the same thing.
22. As a system integrator, I want the incidents in `status.json` in the same order as on the page, so that both views agree.
23. As a reader, I want a clear short error when the feed is down, so that I am not shown old data as if it were current.
24. As a tram board, I want an error status instead of stale JSON when the feed is down, so that I can show my own fallback.
25. As a privacy-minded reader, I want no tracking, no cookies and no cookie banner, so that reading the page leaves no trace.
26. As a reader on a slow or locked-down device, I want the page to work without JavaScript, so that it always renders.
27. As the lead, I want the build held to the tagged requirements only, with untagged lines as context, so that scope stays fixed.
28. As the lead, I want the deploy and the claim each to wait for my yes, so that nothing is published or submitted without my approval.
29. As the lead, I want a granular Conventional Commits history, so that I can follow how the solution was reached.
30. As the lead, I want an independent review against the Definition of Done before the deploy, so that the first claim is as complete as possible.

## Implementation Decisions

### Where it lives

- A new Cloudflare Worker named `status-for-the-night` on the account `marcindobrzynski-dev`, served on the free `workers.dev` domain only. No custom domain (Q1).
- Preview/version URLs are turned off, so there is one public address.
- The two existing Workers on the account are not touched.
- The exact `workers.dev` hostname is not known yet; `wrangler deploy` prints it. That address is the `buildUrl` for the claim.
- The source lives in this repo, local git only. No remote and no push unless the lead decides so (Q1, Q2).

### Architecture

- One Worker renders everything on the server. Two routes: `/` returns the HTML page and `/status.json` returns the JSON (Q3, option A).
- Every request reads the ops feed live. No KV, no cron, no stored copy, no framework, no client-side JavaScript.
- The feed address is a configuration variable of the Worker, not a literal in the code.
- TypeScript, one source file `src/index.ts`, built around two pure functions (Q9, Q10):
  - `buildStatus(feed)` turns the feed body into the status object.
  - `renderPage(status)` turns the status object into the HTML string.
- The request handler is the only impure part: it fetches the feed, calls the two functions, sets headers and maps failures to the error response.

### Ops feed (input)

- `https://hq.mega.dev/challenges/status-for-the-night/api/incidents/2b04e228c66a`, public GET.
- Body: `{ updatedAt, incidents[] }`; each incident has `id, line, opened, closed, what, author`. Times are ISO 8601 UTC ending in `Z`.
- `updatedAt` moves every minute. Records may change too.
- The feed sends `Cross-Origin-Resource-Policy: same-origin`, which is one more reason to fetch it server-side.

### `status.json` (output contract, Q4)

- Shape: `{ "updatedAt": string, "incidents": Incident[] }`.
- `updatedAt` is the feed's value passed through unchanged (R-L6H, R-H2K). It is not the time of our read and it is not reformatted.
- `incidents` holds every feed record (the whole week), with the feed's fields and values unchanged, sorted newest first (see "Ordering and formats"). A `null`, an empty string or a `—` in the feed is passed through as it is; the `—` rule below is for the page only.
- Response headers: `Content-Type: application/json; charset=utf-8`, `Access-Control-Allow-Origin: *` (R-Z8H), `Cache-Control: public, max-age=60` (R-M2H).
- The tram 3 sentence (R-H6M) is not added to the JSON.

### The page (layout A, Q5)

Chosen from a three-variant prototype (`prototype/layouts.html`), which stays in the repo as the record of that decision (Q16). The lead did not name variant A in words; he answered the follow-up questions that assume A, and the agent read that back to him without objection.

- Banner: background `#6F55C9`, measured from the pixels of the pack's `screenshot.png` (R-M6Z). Heading text exactly `status for the night`, lower case (R-Z5K).
- Table "lines", columns `line / now / last incident`:
  - One row per distinct `line` value in the feed (R-X3M).
  - `tram 3` always gets a row, also when the feed has no tram 3 incident. In that case `now` is `ok`, `last incident` is `—`, and the R-H6M sentence is still shown (lead, late decision 1). This is the only line name written into the code.
  - **Agent default:** a line without incidents is placed after the lines that have incidents.
  - Rows are ordered by each line's newest incident, newest first (Q11).
  - `now` is `open` when the line has an incident without `closed`, otherwise `ok` (Q17).
  - `last incident` shows the date, the opening time and `what` of the line's newest incident, in this form: `14/09 03:46 schedule rebuild` (form taken from the prototype).
  - The tram 3 row carries the visible text `read on every tram 3 board`, exactly, under the line name (Q6, R-H6M).
  - `sched-prod` appears in feed record 3715 as a `line` value. It is the service itself, not a transit line, but it gets a row like any other value. If the course rejects it, it is cut after that feedback (Q12).
- Table "incidents", columns `date / opened / closed / line / what / who`:
  - One row per incident, the whole week, newest first (R-R9M, R-L3R).
  - `who` is the incident's `author` (R-X9Z).
- Ordering and formats:
  - Dates day first, `DD/MM` (R-K6L, Q7). This is a guess between R-K6L and R-M6X, which product has not settled; see Further Notes.
  - Times 24-hour `HH:MM`, in UTC.
  - Every empty value is shown as `—`: a missing author, a missing `closed`, a missing last incident (Q13). A feed author that is already `—` is shown as it is.
  - **Agent default:** "empty" means `null`, a missing key, or a string that is empty after trimming (the prototype trims).
  - **Agent default:** `DD/MM` and `HH:MM` are taken from the UTC parts of the ISO timestamp, never from local time. The `date` column is the date of `opened`. `closed` shows only `HH:MM`, also when it falls on the next day.
  - **Agent default:** "newest" means the latest `opened`. On equal `opened` values the higher `id` comes first. A line's newest incident is the one with the latest `opened`.
- Footer: the text `all times UTC` (R-L6Z) and the feed's `updatedAt` as `DD/MM HH:MM` in UTC (Q14).
- Plain HTML and inline CSS only. No scripts, no cookies, no external resources, no tracking, no login.
- **Agent default:** all text from the feed is HTML-escaped before it is put into the page.
- **Agent default:** the page answers with `Content-Type: text/html; charset=utf-8`.

### Feed failure (Q8)

- When the feed cannot be reached, answers with a non-2xx status, or returns a body that is not the expected JSON, both routes answer `502` with the short English text `status feed unavailable`.
- No stale copy is served in that case (R-L6H).
- The lead decided "a 5xx error and a short message in English". The exact `502` and the text were the agent's stated default, and the lead did not object.
- **Agent defaults** for the rest of the HTTP surface:
  - The 502 body is `text/plain; charset=utf-8` on both routes.
  - The 502 carries `Cache-Control: no-store`, so no cache and no board keeps the error.
  - For `/status.json` the 502 still carries `Access-Control-Allow-Origin: *`, so a board can read the status code.
  - Any other path answers `404` with the text `not found`.
  - Only GET and HEAD are served; other methods answer `405`.

### Tooling

- `wrangler` is a dev dependency of the project, version 4.164.0 (the version the lead's `npx wrangler` reported on 2026-11-18). Commands run as `npx wrangler`.
- Configuration in `wrangler.jsonc`: `name`, `main`, `compatibility_date`, `workers_dev: true`, `preview_urls: false`, and the feed address under `vars`.
- The research step checks the current Workers docs for the exact config keys, the compatibility date and the type setup before anything is written. Every claim about a tool or version is labelled `checked: <source>` or `unchecked (memory)`.

### Work plan (Q15, Q19)

One source file means no two agents write it at the same time, so the steps run in order. Each step ends in its own Conventional Commit, made by the agent.

1. Sonnet subagent, research: current `wrangler.jsonc` keys, `compatibility_date`, Workers types, each with its source.
2. Main agent: `chore:` project skeleton (package manifest, wrangler config, TypeScript config).
3. Opus subagent: `feat:` `buildStatus`.
4. Opus subagent: `feat:` `renderPage` in layout A.
5. Opus subagent: `feat:` request handler with both routes and the 502 path.
6. Main agent: local checks with `curl` and Claude in Chrome, results written to the log.
7. Fable 5.2 subagent: review against the Definition of Done, without being told the main agent's opinion.
8. Lead: yes to the deploy. Main agent: `npx wrangler deploy`, then the same checks on the public address.
9. Lead: a separate yes to the claim, after seeing the results of the public checks (late decision 2). Main agent: `claim-challenge`, then the debrief.

**Agent additions to the accepted plan:** before step 3 the agent re-reads the Challenge page (signed in, Claude in Chrome) for new product answers; and the step-7 reviewer is not told the main agent's opinion.

## Testing Decisions

- A good test here checks only what a reader or a board can observe over HTTP: status codes, headers, the JSON body and the visible text of the page. It does not check how the two functions are written.
- There is one seam, the HTTP surface of the Worker (`/` and `/status.json`). It is exercised first against `npx wrangler dev` and then against the deployed address, with the same checks.
- No unit-test suite and no test runner are added. The lead chose `curl` plus Claude in Chrome to reach production faster (Q10). `buildStatus` and `renderPage` are kept pure so tests can be added later without a rewrite.
- `curl` covers: both routes answer 200; the JSON headers; `updatedAt` equal to the feed's value fetched in the same minute and ending in `Z`; incident count and order; the 502 path (by pointing the feed variable at an address that fails in local dev).
- Claude in Chrome covers what needs a rendered page: the banner colour, the heading text, both tables, the tram 3 sentence, the date and time formats, the `—` cells, the footer, and that the page sets no cookies and loads nothing from other hosts.
- There is no prior art for tests in this repo; it is new.

### Definition of Done (Q18)

1. Each of the 13 tags the build applies has a passing `curl` or Chrome check with its result written in the log. Of the 15 tags, R-L8Z is dropped by product, and R-M6X is not applied because R-K6L is, as a recorded guess (Q7). (The lead accepted this point as "14 binding tags"; the review found that count included R-M6X, which the build goes against.)
2. `/` and `/status.json` say the same thing: the same records in the same order.
3. `updatedAt` in `status.json` equals the feed's value from the same minute.
4. `status.json` headers: `Access-Control-Allow-Origin: *` and `Cache-Control` with `max-age` of 60 or less.
5. A feed failure gives `502` and `status feed unavailable`, with no stale copy.
6. No client-side JavaScript, no cookies, no login, no external resources.
7. The same checks pass locally (`wrangler dev`) and on the public address.
8. The commit history follows Conventional Commits; `receipt.txt` and the board token are not in git.
9. The course accepts `claim-challenge` and the debrief is written.

## Out of Scope

- Search and subscriptions (the client's spec puts them out of scope).
- A custom domain, KV, cron triggers, caching layers or any stored copy of the feed.
- Login, analytics, cookies, a cookie banner.
- A unit-test suite, CI, and a git remote.
- Changing or deleting the two existing Workers on the account.
- Committing `skills/mega-capture/` in the fleet repo; the lead does that himself.
- Filtering `sched-prod` out of the lines table, unless the course's feedback asks for it.

## Further Notes

- **Deadline.** The receipt in `receipt.txt` expires on 2026-11-19 at 20:55:48 UTC (21:55 CET). The file is listed in `.gitignore` and must stay there.
- **Open conflict, date order.** R-K6L (day first, from the spec) and R-M6X (month first, handwriting on the screenshot) disagree and product has not answered. The lead chose day first (Q7). Product's earlier answer went against the spec, so this may be the first thing to change after a refusal.
- **Open conflict, author.** R-X9Z says each incident names who ran it, but record 3715 has the author `—`. The lead chose to show `—`.
- **Tagged over untagged.** R-L6H binds over the untagged spec line that calls `updatedAt` "when the data was read". R-X3M is met by the lines table, and the untagged "one row per incident" by the incidents table.
- **What the course checks is not stated.** The assumption is that it reads the deployed page and `status.json` against the tags and product's answer.
- **Tries.** A refusal names categories, not items. From the second failed try at the same spot a refusal can carry a hint, and a solve after a hint counts as solved with help. So the first claim should be as complete as possible.
- **Board token.** Checked on 2026-11-18: no file in the repo holds the board token. `assets/pack/files/board-link.txt` only says the link is on the Challenge page, and `assets/list-sent.json` has the token masked. The receipt is only in `receipt.txt`. Keep it that way: never write the board link with its token into a tracked file.
- **Claim shape.** `claim-challenge` with `uuid` `c0000000-0000-4000-8000-0000005e03e1`, `receipts: { receipt }` and `answer { receipt, buildUrl }`. Read the tool's schema before sending.
- **Feed snapshot of 2026-11-18** (six records, ids 3710–3715, lines `bus 14`, `tram 3`, `night bus N2`, `sched-prod`) is in the session handoff. It is an example only; the build must not depend on these values.

## Late decisions

The review left two questions open. The lead answered both on 2026-11-18, after the first commit of this spec.

1. **A tram 3 row with no tram 3 incident.** `tram 3` always gets a row in the lines table (`now` = `ok`, `last incident` = `—`), so that R-X3M ("tram 3 included") and the R-H6M sentence hold in a week without a tram 3 incident.
2. **A yes for the claim.** `claim-challenge` needs its own yes from the lead. The yes to the deploy does not cover it.
