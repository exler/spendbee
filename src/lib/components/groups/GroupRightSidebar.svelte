<script lang="ts">
    import { resolve } from "$app/paths";
    import type { Balance, Expense, Group } from "./group-context";

    export let groupUuid: string;
    export let group: Group | null;
    export let balances: Balance[];
    export let expenses: Expense[];
    export let formatCurrency: (amount: number) => string;
    export let formatDate: (date: Date) => string;
    export let exportExpenses: () => void;
</script>

<div class="rounded-2xl border border-dark-100/70 bg-dark-300/50 p-4">
    <div class="text-xs uppercase tracking-[0.2em] text-gray-500">
        Group balances
    </div>
    {#if balances.length === 0}
        <div class="mt-3 text-sm text-gray-400">No balances yet.</div>
    {:else}
        <div class="mt-4 space-y-3">
            {#each balances.slice(0, 4) as balance (balance.memberId)}
                <div class="flex items-center justify-between">
                    <div>
                        <div class="text-sm font-semibold text-white">
                            {balance.memberName}
                        </div>
                        <div class="text-xs text-gray-500">
                            {group?.baseCurrency || "EUR"}
                        </div>
                    </div>
                    <div
                        class="text-sm font-semibold {balance.balance >
                        0
                            ? 'text-green-400'
                            : balance.balance < 0
                              ? 'text-red-400'
                              : 'text-gray-400'}"
                    >
                        {balance.balance > 0
                            ? "+"
                            : balance.balance < 0
                              ? "-"
                              : ""}{formatCurrency(Math.abs(balance.balance))}
                    </div>
                </div>
            {/each}
        </div>
        <a
            href={resolve(`/groups/${groupUuid}/balances`)}
            class="mt-4 block w-full rounded-lg border border-dark-100/70 px-3 py-2 text-sm text-gray-200 hover:bg-dark-200/70 text-center"
        >
            View details
        </a>
    {/if}
</div>

<div class="mt-6 rounded-2xl border border-dark-100/70 bg-dark-300/50 p-4">
    <div class="text-xs uppercase tracking-[0.2em] text-gray-500">
        Recent activity
    </div>
    <div class="mt-4 space-y-3">
        {#each expenses.slice(0, 4) as expense (expense.id)}
            <div class="flex items-center gap-3">
                <div
                    class="h-9 w-9 rounded-xl bg-dark-200 flex items-center justify-center text-sm font-semibold text-primary"
                >
                    {expense.description.slice(0, 1).toUpperCase()}
                </div>
                <div class="flex-1">
                    <div class="text-sm text-white">{expense.description}</div>
                    <div class="text-xs text-gray-500">
                        {formatDate(expense.createdAt)}
                    </div>
                </div>
                <div class="text-sm font-semibold text-primary">
                    {formatCurrency(expense.amount)}
                </div>
            </div>
        {/each}
        {#if expenses.length === 0}
            <div class="text-sm text-gray-400">
                Activity feed coming soon.
            </div>
        {/if}
    </div>
</div>

<div class="mt-6 rounded-2xl border border-dark-100/70 bg-dark-300/50 p-4">
    <div class="text-xs uppercase tracking-[0.2em] text-gray-500">
        Group settings
    </div>
    <div class="mt-4 space-y-2">
        <a
            href={resolve(`/groups/${groupUuid}/settings`)}
            class="w-full rounded-lg border border-dark-100/70 px-3 py-2 text-sm text-gray-200 hover:bg-dark-200/70 block text-center"
        >
            Edit group settings
        </a>
        <button
            onclick={exportExpenses}
            class="w-full rounded-lg border border-dark-100/70 px-3 py-2 text-sm text-gray-200 hover:bg-dark-200/70"
        >
            Export as spreadsheet
        </button>
    </div>
</div>
