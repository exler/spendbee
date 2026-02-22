import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

const LOGIN_REDIRECT_STATUS = 302;

export const load: PageServerLoad = async ({ fetch, url }) => {
    const includeArchived = url.searchParams.get("includeArchived") === "true";
    const groupsUrl = includeArchived ? "/api/groups?includeArchived=true" : "/api/groups";

    const [groupsResponse, currenciesResponse] = await Promise.all([
        fetch(groupsUrl),
        fetch("/api/groups/currencies"),
    ]);

    if (groupsResponse.status === 401 || currenciesResponse.status === 401) {
        throw redirect(LOGIN_REDIRECT_STATUS, "/login");
    }

    if (!groupsResponse.ok) {
        const errorBody = await groupsResponse.json().catch(() => ({}));
        return {
            groups: [],
            supportedCurrencies: [],
            includeArchived,
            error: errorBody.error || "Failed to load groups",
        };
    }

    if (!currenciesResponse.ok) {
        const errorBody = await currenciesResponse.json().catch(() => ({}));
        return {
            groups: await groupsResponse.json().catch(() => []),
            supportedCurrencies: [],
            includeArchived,
            error: errorBody.error || "Failed to load currencies",
        };
    }

    const [groups, currenciesData] = await Promise.all([
        groupsResponse.json(),
        currenciesResponse.json(),
    ]);

    return {
        groups: groups ?? [],
        supportedCurrencies: currenciesData?.currencies ?? [],
        includeArchived,
        error: "",
    };
};
