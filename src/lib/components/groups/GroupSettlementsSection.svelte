<script lang="ts">
    import type { Group, Settlement } from "./group-context";

    export let settlements: Settlement[];
    export let group: Group | null;
    export let formatDate: (date: Date) => string;
    export let formatCurrency: (amount: number) => string;
    export let getMemberName: (member: Settlement["fromMember"]) => string;
</script>

{#if settlements.length === 0}
    <div class="text-center py-12 bg-dark-300 rounded-2xl">
        <p class="text-gray-400">No settlements recorded yet.</p>
    </div>
{:else}
    <div class="space-y-3">
        {#each settlements as settlement (settlement.id)}
            <div class="bg-dark-300/70 p-4 rounded-2xl border border-dark-100/70">
                <div class="flex justify-between items-start">
                    <div>
                        <div class="text-white">
                            <span class="font-semibold">
                                {getMemberName(settlement.fromMember)}
                            </span>
                            <span class="text-gray-400"> paid </span>
                            <span class="font-semibold">
                                {getMemberName(settlement.toMember)}
                            </span>
                        </div>
                        <div class="text-xs text-gray-500 mt-1">
                            {formatDate(settlement.createdAt)}
                        </div>
                    </div>
                    <div class="text-lg font-bold text-primary">
                        {formatCurrency(settlement.amount)}
                        {settlement.currency || "EUR"}
                        {#if settlement.currency && settlement.currency !== group?.baseCurrency && settlement.exchangeRate}
                            <div class="text-xs text-gray-500 font-normal mt-0.5">
                                @ {settlement.exchangeRate.toFixed(4)}
                                {group?.baseCurrency || "EUR"}/{settlement.currency}
                            </div>
                        {/if}
                    </div>
                </div>
            </div>
        {/each}
    </div>
{/if}
