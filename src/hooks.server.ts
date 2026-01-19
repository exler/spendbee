import type { Handle, HandleServerError } from "@sveltejs/kit";
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

export const handleError: HandleServerError = async ({ error, event, status, message }) => {
    const errorId = crypto.randomUUID();

    // Log the full error details
    console.error(`[${status}] ${event.request.method} ${event.url.pathname}`);
    console.error(`Error ID: ${errorId}`);
    console.error(`Message: ${message}`);

    if (error instanceof Error) {
        console.error(`Error name: ${error.name}`);
        console.error(`Error message: ${error.message}`);
        console.error(`Stack trace:\n${error.stack}`);
    } else {
        console.error("Error object:", error);
    }

    return {
        message: `Internal Error (ID: ${errorId})`,
    };
};
