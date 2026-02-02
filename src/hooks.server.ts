import type { Handle } from "@sveltejs/kit";
import { verifyJWT } from "$lib/server/auth";
import * as Sentry from "@sentry/sveltekit";
import { env } from "$env/dynamic/private";
import { sequence } from "@sveltejs/kit/hooks";

if (env.SENTRY_DSN) {
    Sentry.init({
        dsn: env.SENTRY_DSN,
        tracesSampleRate: 1.0,
    });
}

const authHandle: Handle = async ({ event, resolve }) => {
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

export const handle = sequence(Sentry.sentryHandle(), authHandle);

export const handleError = Sentry.handleErrorWithSentry();
