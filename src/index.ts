/** The one line that always gets a row, also without incidents (spec, late decision 1). */
// Not exported: workerd treats every named export of the main module as an entrypoint
// and refuses to start on a string export.
const TRAM_3 = "tram 3";

export interface Incident {
	id: string;
	line: string;
	opened: string;
	closed?: unknown;
	what?: unknown;
	author?: unknown;
	[key: string]: unknown;
}

export interface LineStatus {
	line: string;
	open: boolean;
	last: Incident | null;
}

export interface Status {
	updatedAt: string;
	incidents: Incident[];
	lines: LineStatus[];
}

/** Empty means null, missing, or a string that is empty after trim (spec, agent default). */
export function isEmpty(value: unknown): boolean {
	return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDateString(value: unknown): value is string {
	return typeof value === "string" && value !== "" && !Number.isNaN(Date.parse(value));
}

function toIncident(value: unknown, index: number): Incident {
	if (
		!isRecord(value) ||
		typeof value.id !== "string" ||
		typeof value.line !== "string" ||
		value.line === "" ||
		!isDateString(value.opened)
	) {
		throw new Error(`feed incident ${index} has an unexpected shape`);
	}
	// Shallow copy: fields and values pass through unchanged, the input is not touched.
	return { ...value, id: value.id, line: value.line, opened: value.opened };
}

const NUMERIC_ID = /^\d+$/;

function compareIds(a: string, b: string): number {
	if (NUMERIC_ID.test(a) && NUMERIC_ID.test(b)) return Number(a) - Number(b);
	return a < b ? -1 : a > b ? 1 : 0;
}

/** Newest first: latest `opened` as an instant; on a tie the higher id first (spec, agent default). */
function newestFirst(a: Incident, b: Incident): number {
	return Date.parse(b.opened) - Date.parse(a.opened) || compareIds(b.id, a.id);
}

export function buildStatus(feed: unknown): Status {
	if (!isRecord(feed) || !isDateString(feed.updatedAt) || !Array.isArray(feed.incidents)) {
		throw new Error("feed body has an unexpected shape");
	}

	const incidents = feed.incidents.map(toIncident).sort(newestFirst);

	// Incidents are newest first, so a line's first incident is its newest and
	// Map insertion order is the order of each line's newest incident.
	const byLine = new Map<string, LineStatus>();
	for (const incident of incidents) {
		const entry = byLine.get(incident.line);
		if (entry) {
			entry.open ||= isEmpty(incident.closed);
		} else {
			byLine.set(incident.line, { line: incident.line, open: isEmpty(incident.closed), last: incident });
		}
	}
	if (!byLine.has(TRAM_3)) {
		byLine.set(TRAM_3, { line: TRAM_3, open: false, last: null });
	}

	return { updatedAt: feed.updatedAt, incidents, lines: [...byLine.values()] };
}

/** Shown in place of every empty value on the page (spec, Q13). */
const DASH = "—";

/** Visible text of the tram 3 row (R-H6M). */
const BOARD_TEXT = "read on every tram 3 board";

/** Banner violet measured from the pack's screenshot (R-M6Z). */
const BANNER = "#6F55C9";

const HTML_ESCAPES: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#39;",
};

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

/** A feed value as escaped cell text: `—` when empty, otherwise `String(value)`. */
function cellText(value: unknown): string {
	return isEmpty(value) ? DASH : escapeHtml(String(value));
}

/** The instant of an ISO timestamp, or null when it is not a string that parses. */
function parseInstant(value: unknown): Date | null {
	if (typeof value !== "string") return null;
	const ms = Date.parse(value);
	return Number.isNaN(ms) ? null : new Date(ms);
}

function pad2(n: number): string {
	return String(n).padStart(2, "0");
}

/** Day first, from the UTC parts (spec, R-K6L). */
function formatDayMonth(date: Date): string {
	return `${pad2(date.getUTCDate())}/${pad2(date.getUTCMonth() + 1)}`;
}

/** 24-hour, from the UTC parts. */
function formatTime(date: Date): string {
	return `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
}

/** `DD/MM HH:MM`, or `—` when the value is empty or does not parse. */
function stamp(value: unknown): string {
	const date = parseInstant(value);
	return date ? `${formatDayMonth(date)} ${formatTime(date)}` : DASH;
}

/** `HH:MM` only, or `—` when the value is empty or does not parse. */
function time(value: unknown): string {
	const date = parseInstant(value);
	return date ? formatTime(date) : DASH;
}

function dayMonth(value: unknown): string {
	const date = parseInstant(value);
	return date ? formatDayMonth(date) : DASH;
}

function lineRow({ line, open, last }: LineStatus): string {
	const board = line === TRAM_3 ? `<span class="board">${BOARD_TEXT}</span>` : "";
	const lastText = last ? `${stamp(last.opened)} ${cellText(last.what)}` : DASH;
	return `<tr><td>${escapeHtml(line)}${board}</td><td>${open ? "open" : "ok"}</td><td>${lastText}</td></tr>`;
}

function incidentRow(incident: Incident): string {
	const cells = [
		`<td class="t">${dayMonth(incident.opened)}</td>`,
		`<td class="t">${time(incident.opened)}</td>`,
		`<td class="t">${time(incident.closed)}</td>`,
		`<td>${escapeHtml(incident.line)}</td>`,
		`<td>${cellText(incident.what)}</td>`,
		`<td>${cellText(incident.author)}</td>`,
	];
	return `<tr>${cells.join("")}</tr>`;
}

function headRow(columns: readonly string[]): string {
	return `<tr>${columns.map((c) => `<th scope="col">${c}</th>`).join("")}</tr>`;
}

function table(id: string, columns: readonly string[], rows: readonly string[]): string {
	return `<h2 id="${id}">${id}</h2>
<div class="scroll" role="region" aria-labelledby="${id}" tabindex="0">
<table>
<thead>${headRow(columns)}</thead>
<tbody>
${rows.join("\n")}
</tbody>
</table>
</div>`;
}

const STYLE = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; background: #fff; color: #1a1a1a;
	font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
	line-height: 1.4; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
header { background: ${BANNER}; color: #fff; padding: 18px 20px; }
h1 { margin: 0; font-size: 24px; font-weight: 600; }
main { padding: 16px 20px; max-width: 960px; }
h2 { font-size: 16px; margin: 24px 0 8px; }
h2:first-child { margin-top: 0; }
.scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.scroll:focus-visible { outline: 2px solid ${BANNER}; outline-offset: 2px; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #ddd; vertical-align: top; }
th { border-bottom: 2px solid ${BANNER}; font-weight: 600; white-space: nowrap; }
td.t { font-variant-numeric: tabular-nums; white-space: nowrap; }
.board { display: block; font-size: 12px; color: #5a3fb0; font-weight: 500; margin-top: 2px; }
footer { border-top: 1px solid #ddd; padding: 10px 20px; font-size: 12px; color: #595959; }
`;

/** The whole HTML document for the status. Pure: the output depends only on `status`. */
export function renderPage(status: Status): string {
	const lines = table("lines", ["line", "now", "last incident"], status.lines.map(lineRow));
	const incidents = table(
		"incidents",
		["date", "opened", "closed", "line", "what", "who"],
		status.incidents.map(incidentRow),
	);
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>status for the night</title>
<style>${STYLE}</style>
</head>
<body>
<header><h1>status for the night</h1></header>
<main>
${lines}
${incidents}
</main>
<footer>all times UTC · updated ${stamp(status.updatedAt)}</footer>
</body>
</html>
`;
}

/** A hanging feed becomes a 502 after this long (agent default). */
const FEED_TIMEOUT_MS = 5000;

/** Both success routes may be cached this long (R-M2H; the page follows the JSON, agent default). */
const CACHE_OK = "public, max-age=60";

const TEXT = "text/plain; charset=utf-8";

const ALLOW = "GET, HEAD";

function respond(body: string, status: number, headers: Record<string, string>): Response {
	return new Response(body, { status, headers: { "X-Content-Type-Options": "nosniff", ...headers } });
}

function feedUnavailable(cors: boolean): Response {
	const headers: Record<string, string> = { "Content-Type": TEXT, "Cache-Control": "no-store" };
	if (cors) headers["Access-Control-Allow-Origin"] = "*";
	return respond("status feed unavailable", 502, headers);
}

/** Reads the feed live, past any cache the platform lets us skip. Throws on every failure. */
async function readFeed(url: string): Promise<Status> {
	const response = await fetch(url, {
		headers: { Accept: "application/json" },
		cache: "no-store",
		signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
	});
	if (!response.ok) throw new Error(`feed answered ${response.status}`);
	return buildStatus(await response.json());
}

async function route(request: Request, env: Env): Promise<Response> {
	if (request.method !== "GET" && request.method !== "HEAD") {
		return respond("method not allowed", 405, { "Content-Type": TEXT, Allow: ALLOW });
	}

	const { pathname } = new URL(request.url);
	if (pathname !== "/" && pathname !== "/status.json") {
		return respond("not found", 404, { "Content-Type": TEXT });
	}

	const isJson = pathname === "/status.json";
	let status: Status;
	try {
		status = await readFeed(env.FEED_URL);
	} catch {
		return feedUnavailable(isJson);
	}

	if (isJson) {
		const body = JSON.stringify({ updatedAt: status.updatedAt, incidents: status.incidents });
		return respond(body, 200, {
			"Content-Type": "application/json; charset=utf-8",
			"Access-Control-Allow-Origin": "*",
			"Cache-Control": CACHE_OK,
		});
	}
	return respond(renderPage(status), 200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": CACHE_OK });
}

export default {
	async fetch(request, env): Promise<Response> {
		let response: Response;
		try {
			response = await route(request, env);
		} catch {
			// Anything unexpected: a bare 500, never a stack trace.
			response = respond("internal error", 500, { "Content-Type": TEXT, "Cache-Control": "no-store" });
		}
		// HEAD: same status and headers as GET, no body.
		return request.method === "HEAD" ? new Response(null, response) : response;
	},
} satisfies ExportedHandler<Env>;
