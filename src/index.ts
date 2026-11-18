/** The one line that always gets a row, also without incidents (spec, late decision 1). */
export const TRAM_3 = "tram 3";

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

// Skeleton only. renderPage and the request handler follow.
export default {
	async fetch(): Promise<Response> {
		return new Response("not built yet", { status: 503 });
	},
} satisfies ExportedHandler<Env>;
