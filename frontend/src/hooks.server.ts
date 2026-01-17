import type { Handle } from "@sveltejs/kit";
import { verifyJWT } from "$lib/server/auth";

export const handle: Handle = async ({ event, resolve }) => {
	// Check for JWT token in cookie or Authorization header
	const token = event.cookies.get("token") || 
		event.request.headers.get("Authorization")?.replace("Bearer ", "");

	if (token) {
		const payload = await verifyJWT(token);
		if (payload) {
			event.locals.userId = payload.userId;
			event.locals.email = payload.email;
		}
	}

	return resolve(event);
};
