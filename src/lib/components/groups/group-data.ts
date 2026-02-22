import { api } from "$lib/api";

export async function fetchGroupData(groupUuid: string) {
    const [
        group,
        allMembers,
        pendingInvitations,
        expenses,
        balances,
        settlements,
        supportedCurrencies,
    ] = await Promise.all([
        api.groups.get(groupUuid),
        api.members.list(groupUuid),
        api.groups.invitations(groupUuid),
        api.expenses.list(groupUuid),
        api.expenses.balances(groupUuid),
        api.expenses.settlements(groupUuid),
        api.groups.currencies().then((res) => res.currencies),
    ]);

    return {
        group,
        allMembers,
        pendingInvitations,
        expenses,
        balances,
        settlements,
        supportedCurrencies,
    };
}
