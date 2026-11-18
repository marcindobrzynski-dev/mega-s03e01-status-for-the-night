// Skeleton only. buildStatus, renderPage and the request handler follow.
export default {
	async fetch(): Promise<Response> {
		return new Response("not built yet", { status: 503 });
	},
} satisfies ExportedHandler<Env>;
