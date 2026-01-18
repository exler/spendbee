import type { Handle } from "@sveltejs/kit";
import { verifyJWT } from "$lib/server/auth";

export const handle: Handle = async ({ event, resolve }) => {
    // Check for JWT token in httpOnly cookie
    const token = event.cookies.get("token");

    if (token) {
        const payload = await verifyJWT(token);
        if (payload) {
            event.locals.userId = payload.userId;
            event.locals.email = payload.email;
        }
    }

    return resolve(event);
};
