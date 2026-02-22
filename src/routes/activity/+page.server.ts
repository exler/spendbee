import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

const LOGIN_REDIRECT_STATUS = 302;

export const load: PageServerLoad = async ({ fetch }) => {
    const response = await fetch("/api/activity?limit=120");

    if (response.status === 401) {
        throw redirect(LOGIN_REDIRECT_STATUS, "/login");
    }

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        return {
            activities: [],
            error: errorBody.error || "Failed to load activity",
        };
    }

    const data = await response.json();

    return {
        activities: data.activities ?? [],
        error: "",
    };
};
