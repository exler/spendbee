<script lang="ts">
    import { resolve } from "$app/paths";
    import LeftSidebar from "$lib/components/LeftSidebar.svelte";
    import RightSidebar from "$lib/components/RightSidebar.svelte";
    import MobileNavbar from "$lib/components/MobileNavbar.svelte";
    import GroupSummaryCard from "$lib/components/groups/GroupSummaryCard.svelte";
    import GroupHeader from "$lib/components/groups/GroupHeader.svelte";
    import GroupTabs from "$lib/components/groups/GroupTabs.svelte";
    import GroupRightSidebar from "$lib/components/groups/GroupRightSidebar.svelte";
    import type { Balance, Expense, Group, GroupMember } from "./group-context";

    export let groupUuid: string;
    export let group: Group | null;
    export let allMembers: GroupMember[];
    export let balances: Balance[];
    export let expenses: Expense[];
    export let loading: boolean;
    export let error: string;
    export let activeSection: string;
    export let isOwner: boolean;
    export let onInviteMember: () => void;
    export let onAddExpense: () => void;
    export let onScanReceipt: () => void;
    export let onSettleDebt: () => void;
    export let formatDate: (date: Date) => string;
    export let formatCurrency: (amount: number) => string;
    export let exportExpenses: () => void;
</script>

<div class="min-h-screen bg-dark-500 text-white">
    <div class="max-w-7xl mx-auto px-4 pb-12">
        <div class="flex min-h-screen gap-6">
            <LeftSidebar active="groups">
                {#if group}
                    <GroupSummaryCard
                        {group}
                        memberCount={allMembers.length}
                        onInvite={onInviteMember}
                    />
                {/if}
            </LeftSidebar>

            <main class="flex-1">
                <MobileNavbar backHref="/groups" backLabel="Back to groups" />
                <div class="pt-6">
                    <div class="hidden lg:flex items-center justify-between mb-6">
                        <a
                            href={resolve("/groups")}
                            class="text-gray-400 hover:text-white flex items-center gap-2 text-sm"
                        >
                            <svg
                                class="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M15 19l-7-7 7-7"
                                />
                            </svg>
                            Back to Groups
                        </a>
                    </div>

                    {#if loading}
                        <div class="text-center py-12">
                            <div class="text-gray-400">Loading...</div>
                        </div>
                    {:else if group}
                        <GroupHeader
                            {group}
                            {allMembers}
                            activeSection={activeSection}
                            groupUuid={groupUuid}
                            {isOwner}
                            onAddExpense={onAddExpense}
                            onScanReceipt={onScanReceipt}
                            onSettleDebt={onSettleDebt}
                        />

                        {#if error}
                            <div
                                class="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded mb-4"
                            >
                                {error}
                            </div>
                        {/if}

                        <GroupTabs
                            {groupUuid}
                            activeSection={activeSection}
                        />

                        <slot />
                    {/if}
                </div>
            </main>

            <RightSidebar>
                <GroupRightSidebar
                    {groupUuid}
                    {group}
                    {balances}
                    {expenses}
                    {formatCurrency}
                    {formatDate}
                    {exportExpenses}
                />
            </RightSidebar>
        </div>
    </div>
</div>
