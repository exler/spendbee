import { json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";

export function requireAuth(event: RequestEvent) {
	if (!event.locals.userId) {
		return json({ error: "Unauthorized" }, { status: 401 });
	}
	return null;
}
