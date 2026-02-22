<script lang="ts">
    import AttachmentPreview from "$lib/components/AttachmentPreview.svelte";
    import type { Expense, Group } from "./group-context";

    export let expenses: Expense[];
    export let group: Group | null;
    export let formatCurrency: (amount: number) => string;
    export let formatDate: (date: Date) => string;
    export let getMemberName: (member: Expense["payer"]) => string;
    export let onEdit: (expense: Expense) => void;
    export let onDelete: (expenseId: number) => void;
    export let onImagePreview: (url: string) => void;
</script>

{#if expenses.length === 0}
    <div class="text-center py-16 bg-dark-300 rounded-2xl border border-dark-100">
        <p class="text-gray-400">No expenses yet.</p>
    </div>
{:else}
    <div class="space-y-3">
        {#each expenses as expense (expense.id)}
            <div
                class="bg-dark-300 p-5 rounded-2xl border border-dark-100 hover:border-primary/50 transition"
            >
                <div class="flex flex-wrap justify-between items-start gap-4 mb-3">
                    <div class="flex-1">
                        <div class="flex items-center gap-3">
                            <div
                                class="h-10 w-10 rounded-xl bg-dark-200 flex items-center justify-center text-primary border border-dark-100"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    class="w-5 h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        fill="currentColor"
                                        d="M17 2a3 3 0 0 1 3 3v16a1 1 0 0 1-1.555.832l-2.318-1.545l-1.42 1.42a1 1 0 0 1-1.32.083l-.094-.083L12 20.415l-1.293 1.292a1 1 0 0 1-1.32.083l-.094-.083l-1.421-1.42l-2.317 1.545l-.019.012l-.054.03l-.028.017l-.054.023l-.05.023l-.049.015l-.06.019l-.052.009l-.057.011l-.084.006l-.026.003H5l-.049-.003h-.039l-.013-.003h-.016l-.041-.008l-.038-.005l-.015-.005l-.018-.002l-.034-.011l-.04-.01l-.019-.007l-.015-.004l-.029-.013l-.04-.015l-.021-.011l-.013-.005l-.028-.016l-.036-.018l-.014-.01l-.018-.01l-.038-.027l-.022-.014l-.01-.009l-.02-.014l-.045-.041l-.012-.008l-.024-.024l-.035-.039l-.02-.02l-.007-.011l-.011-.012l-.032-.045l-.02-.025l-.012-.019l-.03-.054l-.017-.028l-.023-.054l-.023-.05a1 1 0 0 1-.034-.108l-.01-.057l-.01-.053L4 21V5a3 3 0 0 1 3-3zm-5 3a1 1 0 0 0-1 1a3 3 0 1 0 0 6v2c-.403.013-.75-.18-.934-.5a1 1 0 0 0-1.732 1a3 3 0 0 0 2.505 1.5l.161-.001A1 1 0 1 0 13 16l.176-.005A3 3 0 0 0 13 10V8c.403-.013.75.18.934.5a1 1 0 0 0 1.732-1A3 3 0 0 0 13.161 6H13a1 1 0 0 0-1-1m1 7a1 1 0 0 1 0 2zm-2-4v2a1 1 0 0 1 0-2"
                                    />
                                </svg>
                            </div>
                            <div>
                                <h3 class="text-xl font-bold text-white">
                                    {expense.description}
                                </h3>
                                <p class="text-sm text-gray-400">
                                    Paid by {getMemberName(expense.payer)}
                                </p>
                            </div>
                        </div>
                        {#if expense.note}
                            <p class="text-sm text-gray-400 mt-2">
                                {expense.note}
                            </p>
                        {/if}
                        <div class="text-sm text-gray-500 mt-2">
                            Split with: {expense.shares
                                .map((s) => getMemberName(s.member))
                                .join(", ")}
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-2xl font-bold text-primary">
                            {formatCurrency(expense.amount)}
                            {expense.currency || "EUR"}
                        </div>
                        {#if expense.currency && expense.currency !== group?.baseCurrency && expense.exchangeRate}
                            <div class="text-xs text-gray-500 mt-1">
                                @ {expense.exchangeRate.toFixed(4)}
                                {group?.baseCurrency || "EUR"}/{expense.currency}
                            </div>
                        {/if}
                        <div class="text-xs text-gray-500 mt-1">
                            {formatDate(expense.createdAt)}
                        </div>
                    </div>
                </div>

                <div class="flex flex-wrap justify-between items-end gap-4">
                    {#if expense.attachments || expense.receiptImageUrl}
                        <div class="flex-1">
                            <div class="text-xs text-gray-500 mb-2">
                                Attachments
                            </div>
                            {#if expense.attachments}
                                {@const parsedAttachments =
                                    JSON.parse(expense.attachments)}
                                <AttachmentPreview
                                    attachments={parsedAttachments}
                                    onImageClick={(attachment) =>
                                        onImagePreview(attachment.url)}
                                />
                            {:else if expense.receiptImageUrl}
                                <AttachmentPreview
                                    attachments={[
                                        {
                                            url: expense.receiptImageUrl,
                                            name: "receipt.jpg",
                                            type: "image/jpeg",
                                        },
                                    ]}
                                    onImageClick={(attachment) =>
                                        onImagePreview(attachment.url)}
                                />
                            {/if}
                        </div>
                    {:else}
                        <div class="flex-1"></div>
                    {/if}
                    <div class="flex gap-2">
                        <button
                            onclick={() => onEdit(expense)}
                            class="w-10 h-10 flex items-center justify-center bg-dark-200 text-primary rounded-lg hover:bg-dark-100 transition border border-dark-100"
                            title="Edit"
                        >
                            <svg
                                class="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                />
                            </svg>
                        </button>
                        <button
                            onclick={() => onDelete(expense.id)}
                            class="w-10 h-10 flex items-center justify-center bg-dark-200 text-red-400 rounded-lg hover:bg-dark-100 transition border border-dark-100"
                            title="Delete"
                        >
                            <svg
                                class="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        {/each}
    </div>
{/if}
