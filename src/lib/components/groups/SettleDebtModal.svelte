<script lang="ts">
    import { api } from "$lib/api";
    import type { Balance, Expense, Group, GroupMember, Settlement } from "./group-context";
    import { formatCurrency, getMemberName } from "$lib/components/groups/group-helpers";

    export let open = false;
    export let groupId: number | null = null;
    export let group: Group | null;
    export let allMembers: GroupMember[] = [];
    export let balances: Balance[] = [];
    export let expenses: Expense[] = [];
    export let settlements: Settlement[] = [];
    export let onClose: () => void;
    export let onSettled: () => void;

    let settleFromMember = 0;
    let settleToMember = 0;
    let settleAmount = "";
    let settleCurrency = "EUR";
    let error = "";

    $: if (open && group?.baseCurrency) {
        settleCurrency = group.baseCurrency;
    }

    function getPairwiseBalance(fromId: number, toId: number): number {
        let balance = 0;
        for (const expense of expenses) {
            const rate = expense.exchangeRate ?? 1;
            if (expense.paidBy === toId) {
                const share = expense.shares.find((s) => s.member.id === fromId);
                if (share) balance += share.share * rate;
            } else if (expense.paidBy === fromId) {
                const share = expense.shares.find((s) => s.member.id === toId);
                if (share) balance -= share.share * rate;
            }
        }
        for (const settlement of settlements) {
            const rate = settlement.exchangeRate ?? 1;
            if (
                settlement.fromMember.id === fromId &&
                settlement.toMember.id === toId
            ) {
                balance -= settlement.amount * rate;
            } else if (
                settlement.fromMember.id === toId &&
                settlement.toMember.id === fromId
            ) {
                balance += settlement.amount * rate;
            }
        }
        return balance;
    }

    $: sortedMembersForSettle = [...allMembers].sort((a, b) => {
        const balA = balances.find((x) => x.memberId === a.id)?.balance ?? 0;
        const balB = balances.find((x) => x.memberId === b.id)?.balance ?? 0;
        return balA - balB;
    });

    $: sortedReceiversForSettle = [...allMembers]
        .filter((m) => m.id !== settleFromMember)
        .sort((a, b) => {
            if (settleFromMember) {
                return (
                    getPairwiseBalance(settleFromMember, b.id) -
                    getPairwiseBalance(settleFromMember, a.id)
                );
            }
            const balA = balances.find((x) => x.memberId === a.id)?.balance ?? 0;
            const balB = balances.find((x) => x.memberId === b.id)?.balance ?? 0;
            return balB - balA;
        });

    function selectSettleFrom(memberId: number) {
        settleFromMember = memberId;
        if (settleToMember === memberId) settleToMember = 0;
        settleAmount = "";
    }

    function selectSettleTo(memberId: number) {
        settleToMember = memberId;
    }

    async function settleDebt() {
        if (!settleAmount || !settleFromMember || !settleToMember || !groupId)
            return;

        try {
            await api.expenses.settle({
                groupId,
                fromMemberId: settleFromMember,
                toMemberId: settleToMember,
                amount: Number.parseFloat(settleAmount),
                currency: settleCurrency,
            });
            settleFromMember = 0;
            settleToMember = 0;
            settleAmount = "";
            onClose();
            onSettled();
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to settle debt";
        }
    }
</script>

{#if open && group}
    <div
        class="fixed inset-0 bg-black/80 flex items-end md:items-center justify-center p-4 z-50"
    >
        <div
            class="bg-dark-300 p-6 rounded-t-3xl md:rounded-2xl max-w-md w-full border border-dark-100 shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
        >
            <div class="flex items-center justify-between mb-4">
                <div>
                    <div class="text-xs uppercase tracking-[0.3em] text-gray-500">
                        Settle
                    </div>
                    <h3 class="text-2xl font-bold text-white">Settle Debt</h3>
                </div>
                <div
                    class="h-10 w-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-semibold"
                >
                    $
                </div>
            </div>

            {#if error}
                <div class="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded mb-4">
                    {error}
                </div>
            {/if}

            <div class="space-y-4">
                <div>
                    <div class="block text-sm font-medium text-gray-300 mb-2">
                        Who is paying?
                    </div>
                    <div class="grid gap-2">
                        {#each sortedMembersForSettle as member (member.id)}
                            {@const bal =
                                balances.find((b) => b.memberId === member.id)
                                    ?.balance ?? 0}
                            <button
                                type="button"
                                onclick={() => selectSettleFrom(member.id)}
                                class="flex items-center justify-between p-3 rounded-xl border {settleFromMember ===
                                member.id
                                    ? 'border-primary bg-primary/10'
                                    : 'border-dark-100 bg-dark-200'}"
                            >
                                <span class="text-white">
                                    {getMemberName(member)}
                                </span>
                                <span
                                    class="text-xs {bal < 0
                                    ? 'text-red-400'
                                    : bal > 0
                                      ? 'text-green-400'
                                      : 'text-gray-400'}"
                                >
                                    {bal < 0 ? "Owes" : bal > 0 ? "Is owed" : "Settled"}
                                </span>
                            </button>
                        {/each}
                    </div>
                </div>

                {#if settleFromMember}
                    <div>
                        <div class="block text-sm font-medium text-gray-300 mb-2">
                            Paying to
                        </div>
                        <div class="grid gap-2">
                            {#each sortedReceiversForSettle as member (member.id)}
                                {@const balance = getPairwiseBalance(
                                    settleFromMember,
                                    member.id,
                                )}
                                <button
                                    type="button"
                                    onclick={() => selectSettleTo(member.id)}
                                    class="flex items-center justify-between p-3 rounded-xl border {settleToMember ===
                                    member.id
                                        ? 'border-primary bg-primary/10'
                                        : 'border-dark-100 bg-dark-200'}"
                                >
                                    <span class="text-white">
                                        {getMemberName(member)}
                                    </span>
                                    <span
                                        class="text-xs {balance > 0
                                        ? 'text-red-400'
                                        : balance < 0
                                          ? 'text-green-400'
                                          : 'text-gray-400'}"
                                    >
                                        {balance > 0
                                            ? `Owes ${formatCurrency(
                                                  Math.abs(balance),
                                              )}`
                                            : balance < 0
                                              ? `Owed ${formatCurrency(
                                                    Math.abs(balance),
                                                )}`
                                              : "Settled"}
                                    </span>
                                </button>
                            {/each}
                        </div>
                    </div>
                {/if}

                <div class="grid gap-4 md:grid-cols-2">
                    <div>
                        <label
                            for="settleAmount"
                            class="block text-sm font-medium text-gray-300 mb-2"
                        >
                            Amount
                        </label>
                        <div
                            class="flex items-center gap-2 rounded-lg border border-dark-100 bg-dark-200 px-3 py-2"
                        >
                            <span class="text-sm text-gray-400">
                                {settleCurrency}
                            </span>
                            <input
                                type="number"
                                id="settleAmount"
                                bind:value={settleAmount}
                                required
                                step="0.01"
                                min="0.01"
                                class="w-full bg-transparent text-white focus:outline-none"
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                    <div>
                        <label
                            for="settleCurrency"
                            class="block text-sm font-medium text-gray-300 mb-2"
                        >
                            Currency
                        </label>
                        <select
                            id="settleCurrency"
                            bind:value={settleCurrency}
                            class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
                        >
                            <option value={group.baseCurrency || "EUR"}>
                                {group.baseCurrency || "EUR"}
                            </option>
                        </select>
                    </div>
                </div>

                <div class="flex gap-2">
                    <button
                        type="button"
                        onclick={settleDebt}
                        class="flex-1 bg-primary text-dark py-2.5 px-4 rounded-xl font-semibold hover:bg-primary-400 transition"
                    >
                        Record settlement
                    </button>
                    <button
                        type="button"
                        onclick={onClose}
                        class="flex-1 bg-dark-200 text-white py-2.5 px-4 rounded-xl font-semibold hover:bg-dark-100 transition"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}
