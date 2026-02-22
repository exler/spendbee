<script lang="ts">
    import { page } from "$app/state";
    import GroupBalancesSection from "$lib/components/groups/GroupBalancesSection.svelte";
    import SettleDebtModal from "$lib/components/groups/SettleDebtModal.svelte";
    import { getGroupLayoutContext } from "$lib/components/groups/group-layout-context";

    const {
        groupId,
        group,
        allMembers,
        expenses,
        balances,
        settlements,
        refresh,
        formatCurrency,
    } = getGroupLayoutContext();

    let showSettleDebt = $state(false);

    $effect(() => {
        if (page.state?.openSettleDebt) {
            showSettleDebt = true;
        }
    });
</script>

<svelte:head>
    <title>{$group?.name || "Group"} - Spendbee</title>
</svelte:head>

<GroupBalancesSection
    balances={$balances}
    group={$group}
    {formatCurrency}
/>

<SettleDebtModal
    open={showSettleDebt}
    groupId={$groupId}
    group={$group}
    allMembers={$allMembers}
    balances={$balances}
    expenses={$expenses}
    settlements={$settlements}
    onClose={() => (showSettleDebt = false)}
    onSettled={refresh}
/>
