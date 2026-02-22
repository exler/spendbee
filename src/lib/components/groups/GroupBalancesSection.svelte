<script lang="ts">
    import type { Balance, Group } from "./group-context";

    export let balances: Balance[];
    export let group: Group | null;
    export let formatCurrency: (amount: number) => string;
</script>

<div class="space-y-3">
    {#each balances as balance (balance.memberId)}
        <div class="bg-dark-300/70 p-4 rounded-2xl border border-dark-100/70">
            <div class="flex items-start gap-4 mb-2">
                <div class="flex items-center gap-3 flex-1 min-w-0">
                    {#if balance.avatarUrl}
                        <img
                            src={`/api/receipts/view/${encodeURIComponent(balance.avatarUrl)}`}
                            alt="Member avatar"
                            class="h-10 w-10 rounded-xl object-cover border border-dark-100"
                        />
                    {:else}
                        <div
                            class="h-10 w-10 rounded-xl bg-dark-200 text-primary flex items-center justify-center text-sm font-semibold"
                        >
                            {balance.memberName.slice(0, 1).toUpperCase()}
                        </div>
                    {/if}
                    <div class="min-w-0">
                        <div class="font-semibold text-white">
                            {balance.memberName}
                        </div>
                        {#if balance.isGuest}
                            <div class="text-xs text-gray-500 mb-2">
                                Guest member
                            </div>
                        {/if}

                        {#if balance.balanceByCurrency && balance.balanceByCurrency.length > 0}
                            <div class="mt-2 space-y-1">
                                {#each balance.balanceByCurrency as currBal (currBal.currency)}
                                    <div
                                        class="text-sm font-medium {currBal.amount >
                                        0
                                            ? 'text-green-400'
                                            : currBal.amount < 0
                                              ? 'text-red-400'
                                              : 'text-gray-400'}"
                                    >
                                        {currBal.amount > 0
                                            ? "Owed: +"
                                            : "Owes: "}{formatCurrency(
                                            Math.abs(currBal.amount),
                                        )}
                                        {currBal.currency}
                                    </div>
                                {/each}
                                {#if balance.balanceByCurrency.length > 1}
                                    <div
                                        class="text-xs text-gray-500 mt-1 pt-1 border-t border-dark-100"
                                    >
                                        Total in {group?.baseCurrency ||
                                            "EUR"}: {balance.balance >
                                        0
                                            ? "+"
                                            : ""}{formatCurrency(
                                            Math.abs(balance.balance),
                                        )}
                                    </div>
                                {/if}
                            </div>
                        {/if}
                    </div>
                </div>
                <div class="text-right shrink-0">
                    <div
                        class="text-xl font-bold {balance.balance >
                        0
                            ? 'text-green-400'
                            : balance.balance < 0
                              ? 'text-red-400'
                              : 'text-gray-400'}"
                    >
                        {#if balance.balance > 0}
                            +{formatCurrency(balance.balance)}
                        {:else if balance.balance < 0}
                            -{formatCurrency(Math.abs(balance.balance))}
                        {:else}
                            Settled
                        {/if}
                    </div>
                    <div class="text-xs text-gray-500 mt-1">
                        {group?.baseCurrency || "EUR"}
                    </div>
                </div>
            </div>
        </div>
    {/each}
</div>
