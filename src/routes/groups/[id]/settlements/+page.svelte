<script lang="ts">
    import { page } from "$app/state";
    import GroupSettlementsSection from "$lib/components/groups/GroupSettlementsSection.svelte";
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
        formatDate,
        formatCurrency,
        getMemberName,
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

<GroupSettlementsSection
    settlements={$settlements}
    group={$group}
    {formatDate}
    {formatCurrency}
    {getMemberName}
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
