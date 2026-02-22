import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

const LOGIN_REDIRECT_STATUS = 302;

export const load: PageServerLoad = async ({ fetch }) => {
    const response = await fetch("/api/account");

    if (response.status === 401) {
        throw redirect(LOGIN_REDIRECT_STATUS, "/login");
    }

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        return {
            user: null,
            error: errorBody.error || "Failed to load account",
        };
    }

    const data = await response.json();

    return {
        user: data.user ?? null,
        error: "",
    };
};
