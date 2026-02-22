<script lang="ts">
    import { goto } from "$app/navigation";
    import { resolve } from "$app/paths";
    import { page } from "$app/state";
    import { user } from "$lib/stores/auth";
    import GroupShell from "$lib/components/groups/GroupShell.svelte";
    import { fetchGroupData } from "$lib/components/groups/group-data";
    import {
        exportExpenses,
        formatCurrency,
        formatDate,
        getMemberAvatar,
        getMemberName,
    } from "$lib/components/groups/group-helpers";
    import { setGroupLayoutContext } from "$lib/components/groups/group-layout-context";
    import type {
        Balance,
        Expense,
        Group,
        GroupMember,
        PendingInvitation,
        Settlement,
    } from "$lib/components/groups/group-context";
    import { writable } from "svelte/store";

    const groupUuid = $derived(page.params.id ?? "");

    const groupId = writable<number | null>(null);
    const group = writable<Group | null>(null);
    const allMembers = writable<GroupMember[]>([]);
    const pendingInvitations = writable<PendingInvitation[]>([]);
    const expenses = writable<Expense[]>([]);
    const balances = writable<Balance[]>([]);
    const settlements = writable<Settlement[]>([]);
    const supportedCurrencies = writable<string[]>([]);
    const loading = writable(true);
    const error = writable("");

    let activeSection = $state("expenses");

    $effect(() => {
        const routeId = page.route.id ?? "";
        const path = (page.url?.pathname ?? "").replace(/\/+$/, "");
        const target = routeId || path;
        if (target.endsWith("/balances")) {
            activeSection = "balances";
            return;
        }
        if (target.endsWith("/settlements")) {
            activeSection = "settlements";
            return;
        }
        if (target.endsWith("/members")) {
            activeSection = "members";
            return;
        }
        if (target.endsWith("/settings")) {
            activeSection = "settings";
            return;
        }
        if (target.endsWith("/expenses")) {
            activeSection = "expenses";
            return;
        }
        activeSection = "expenses";
    });

    $effect(() => {
        if (!$user) {
            goto(resolve("/login"));
            return;
        }

        groupUuid;
        void refresh();
    });

    async function refresh() {
        loading.set(true);
        try {
            const data = await fetchGroupData(groupUuid);
            group.set(data.group);
            allMembers.set(data.allMembers);
            pendingInvitations.set(data.pendingInvitations);
            expenses.set(data.expenses);
            balances.set(data.balances);
            settlements.set(data.settlements);
            supportedCurrencies.set(data.supportedCurrencies);
            groupId.set(data.group?.id ?? null);
        } catch (e) {
            error.set(e instanceof Error ? e.message : "Failed to load group data");
        } finally {
            loading.set(false);
        }
    }

    setGroupLayoutContext({
        groupUuid,
        groupId,
        group,
        allMembers,
        pendingInvitations,
        expenses,
        balances,
        settlements,
        supportedCurrencies,
        loading,
        error,
        refresh,
        formatDate,
        formatCurrency,
        getMemberName,
        getMemberAvatar,
        exportExpenses,
    });
</script>

<GroupShell
    {groupUuid}
    group={$group}
    allMembers={$allMembers}
    balances={$balances}
    expenses={$expenses}
    loading={$loading}
    error={$error}
    {activeSection}
    isOwner={$group?.createdBy === $user?.id}
    onInviteMember={() =>
        goto(resolve(`/groups/${groupUuid}/members`), {
            state: { openInviteMember: true },
        })}
    onAddExpense={() =>
        goto(resolve(`/groups/${groupUuid}/expenses`), {
            state: { openAddExpense: true },
        })}
    onScanReceipt={() =>
        goto(resolve(`/groups/${groupUuid}/expenses`), {
            state: { openScanReceipt: true },
        })}
    onSettleDebt={() =>
        goto(resolve(`/groups/${groupUuid}/balances`), {
            state: { openSettleDebt: true },
        })}
    {formatDate}
    {formatCurrency}
    exportExpenses={() => exportExpenses(groupUuid)}
>
    <slot />
</GroupShell>
