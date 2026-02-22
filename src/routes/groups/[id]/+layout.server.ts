import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";

const LOGIN_REDIRECT_STATUS = 302;

async function parseJson(response: Response) {
    return response.json().catch(() => null);
}

export const load: LayoutServerLoad = async ({ fetch, params }) => {
    const groupUuid = params.id;

    const [
        groupResponse,
        membersResponse,
        invitationsResponse,
        expensesResponse,
        balancesResponse,
        settlementsResponse,
        currenciesResponse,
    ] = await Promise.all([
        fetch(`/api/groups/${groupUuid}`),
        fetch(`/api/groups/${groupUuid}/members`),
        fetch(`/api/groups/${groupUuid}/invitations`),
        fetch(`/api/expenses/group/${groupUuid}`),
        fetch(`/api/expenses/group/${groupUuid}/balances`),
        fetch(`/api/expenses/group/${groupUuid}/settlements`),
        fetch("/api/groups/currencies"),
    ]);

    const responses = [
        groupResponse,
        membersResponse,
        invitationsResponse,
        expensesResponse,
        balancesResponse,
        settlementsResponse,
        currenciesResponse,
    ];

    if (responses.some((response) => response.status === 401)) {
        throw redirect(LOGIN_REDIRECT_STATUS, "/login");
    }

    const errorResponse = responses.find((response) => !response.ok);

    if (errorResponse) {
        const errorBody = await parseJson(errorResponse);
        return {
            group: null,
            allMembers: [],
            pendingInvitations: [],
            expenses: [],
            balances: [],
            settlements: [],
            supportedCurrencies: [],
            error: errorBody?.error || "Failed to load group data",
        };
    }

    const [
        group,
        allMembers,
        pendingInvitations,
        expenses,
        balances,
        settlements,
        currenciesData,
    ] = await Promise.all(responses.map(parseJson));

    return {
        group: group ?? null,
        allMembers: allMembers ?? [],
        pendingInvitations: pendingInvitations ?? [],
        expenses: expenses ?? [],
        balances: balances ?? [],
        settlements: settlements ?? [],
        supportedCurrencies: currenciesData?.currencies ?? [],
        error: "",
    };
};
