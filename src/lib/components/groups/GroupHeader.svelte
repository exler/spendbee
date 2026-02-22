<script lang="ts">
    import { resolve } from "$app/paths";
    import type { Group, GroupMember } from "./group-context";

    export let group: Group;
    export let allMembers: GroupMember[];
    export let activeSection: string;
    export let groupUuid: string;
    export let isOwner = false;
    export let onAddExpense: () => void;
    export let onScanReceipt: () => void;
    export let onSettleDebt: () => void;
</script>

<div
    class="relative mb-6 rounded-3xl border border-dark-100/70 bg-dark-300/55 p-6 shadow-[0_0_30px_rgba(0,0,0,0.25)]"
>
    <div class="flex flex-wrap items-start justify-between gap-6">
        <div class="flex flex-col gap-4">
            <div class="flex items-center gap-4">
                {#if group.imageUrl}
                    <img
                        src={`/api/receipts/view/${encodeURIComponent(group.imageUrl)}`}
                        alt={group.name}
                        class="h-14 w-14 rounded-2xl object-cover border border-dark-100"
                    />
                {:else}
                    <div
                        class="h-14 w-14 rounded-2xl bg-primary text-dark flex items-center justify-center text-2xl font-bold"
                    >
                        {group.name?.slice(0, 1) || "G"}
                    </div>
                {/if}
                <div>
                    <div class="flex items-center gap-2">
                        <h1 class="text-3xl font-bold text-white">
                            {group.name}
                        </h1>
                        {#if group.archived}
                            <span
                                class="bg-dark-100 text-gray-300 px-3 py-1 rounded-full text-xs uppercase tracking-[0.2em]"
                            >
                                Archived
                            </span>
                        {/if}
                    </div>
                    {#if group.description}
                        <p class="text-gray-400 mt-1">
                            {group.description}
                        </p>
                    {/if}
                    <div class="mt-2 text-sm text-gray-500">
                        {allMembers.length} members ({allMembers.filter((m) => m.userId === null).length} guests)
                    </div>
                </div>
            </div>
            {#if activeSection === "expenses"}
                <div class="flex flex-wrap gap-2">
                    <button
                        onclick={onAddExpense}
                        disabled={group.archived}
                        class="rounded-xl bg-primary text-dark px-5 py-2.5 text-sm font-semibold hover:bg-primary-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Add expense
                    </button>
                    <button
                        onclick={onScanReceipt}
                        disabled={group.archived}
                        class="rounded-xl border border-dark-100 bg-dark-200/80 px-5 py-2.5 text-sm font-semibold text-white hover:bg-dark-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Scan receipt
                    </button>
                    <a
                        href={resolve(`/api/expenses/group/${group.uuid}/export`)}
                        class="rounded-xl border border-dark-100/70 px-5 py-2.5 text-sm font-semibold text-gray-200 hover:bg-dark-200/70 transition lg:hidden"
                        title="Export as spreadsheet"
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
                                d="M12 4v12m0 0l-4-4m4 4l4-4M6 20h12"
                            />
                        </svg>
                    </a>
                </div>
            {:else if activeSection === "balances" || activeSection === "settlements"}
                <div class="flex flex-wrap gap-2">
                    <button
                        onclick={onSettleDebt}
                        disabled={group.archived}
                        class="rounded-xl bg-primary text-dark px-5 py-2.5 text-sm font-semibold hover:bg-primary-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Settle up
                    </button>
                </div>
            {/if}
        </div>
    </div>
    <div class="absolute right-4 top-4 z-10 flex flex-col items-center gap-2">
        <a
            href={resolve(`/groups/${groupUuid}/members`)}
            class="flex h-10 w-10 items-center justify-center rounded-full border border-dark-100 bg-dark-200/80 text-gray-200 hover:bg-dark-100 hover:text-white transition"
            title="Members"
            aria-label="Group members"
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                viewBox="0 0 24 24"
            >
                <path
                    fill="currentColor"
                    d="M16.5 13c-1.2 0-3.07.34-4.5 1c-1.43-.67-3.3-1-4.5-1C5.33 13 1 14.08 1 16.25V19h22v-2.75c0-2.17-4.33-3.25-6.5-3.25m-4 4.5h-10v-1.25c0-.54 2.56-1.75 5-1.75s5 1.21 5 1.75zm9 0H14v-1.25c0-.46-.2-.86-.52-1.22c.88-.3 1.96-.53 3.02-.53c2.44 0 5 1.21 5 1.75zM7.5 12c1.93 0 3.5-1.57 3.5-3.5S9.43 5 7.5 5S4 6.57 4 8.5S5.57 12 7.5 12m0-5.5c1.1 0 2 .9 2 2s-.9 2-2 2s-2-.9-2-2s.9-2 2-2m9 5.5c1.93 0 3.5-1.57 3.5-3.5S18.43 5 16.5 5S13 6.57 13 8.5s1.57 3.5 3.5 3.5m0-5.5c1.1 0 2 .9 2 2s-.9 2-2 2s-2-.9-2-2s.9-2 2-2"
                />
            </svg>
        </a>
        {#if isOwner}
            <a
                href={resolve(`/groups/${groupUuid}/settings`)}
                class="flex h-10 w-10 items-center justify-center rounded-full border border-dark-100 bg-dark-200/80 text-gray-200 hover:bg-dark-100 hover:text-white transition"
                title="Settings"
                aria-label="Group settings"
            >
                <svg
                    class="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M11.983 13.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm7.472-1.5a5.53 5.53 0 00-.055-.75l2.03-1.58a.5.5 0 00.12-.64l-1.92-3.32a.5.5 0 00-.6-.22l-2.39.96a5.6 5.6 0 00-1.3-.75l-.36-2.54a.5.5 0 00-.5-.42h-3.84a.5.5 0 00-.5.42l-.36 2.54a5.6 5.6 0 00-1.3.75l-2.39-.96a.5.5 0 00-.6.22l-1.92 3.32a.5.5 0 00.12.64l2.03 1.58c-.04.25-.05.5-.05.75s.02.5.05.75l-2.03 1.58a.5.5 0 00-.12.64l1.92 3.32a.5.5 0 00.6.22l2.39-.96a5.6 5.6 0 001.3.75l.36 2.54a.5.5 0 00.5.42h3.84a.5.5 0 00.5-.42l.36-2.54a5.6 5.6 0 001.3-.75l2.39.96a.5.5 0 00.6-.22l1.92-3.32a.5.5 0 00-.12-.64l-2.03-1.58c.04-.25.05-.5.05-.75z"
                    />
                </svg>
            </a>
        {/if}
    </div>
    {#if group.archived}
        <div
            class="mt-4 bg-yellow-900/30 border border-yellow-700 text-yellow-200 p-3 rounded-lg text-sm"
        >
            This group is archived. You cannot add expenses or settle debts until it is
            unarchived.
        </div>
    {/if}
</div>
