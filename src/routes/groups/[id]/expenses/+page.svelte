<script lang="ts">
    import { page } from "$app/state";
    import { api } from "$lib/api";
    import AttachmentPreview from "$lib/components/AttachmentPreview.svelte";
    import GroupExpensesSection from "$lib/components/groups/GroupExpensesSection.svelte";
    import type { Expense, GroupMember } from "$lib/components/groups/group-context";
    import { getGroupLayoutContext } from "$lib/components/groups/group-layout-context";
    import { user } from "$lib/stores/auth";

    const {
        groupUuid,
        groupId,
        group,
        allMembers,
        expenses,
        balances,
        settlements,
        supportedCurrencies,
        error,
        refresh,
        formatCurrency,
        formatDate,
        getMemberName,
        exportExpenses,
    } = getGroupLayoutContext();

    let showAddExpense = $state(false);
    let showScanReceipt = $state(false);
    let showEditExpense = $state(false);
    let showReceiptPreview = $state<number | null>(null);
    let previewImageUrl = $state<string | null>(null);

    let expenseDescription = $state("");
    let expenseNote = $state("");
    let expenseAmount = $state("");
    let expenseCurrency = $state("EUR");
    let expenseDate = $state("");
    let expensePaidBy = $state(0);
    let selectedMembers = $state<number[]>([]);
    let splitEvenly = $state(true);
    let customShares = $state<Record<number, string>>({});
    let splitMode = $state<"amounts" | "percent">("amounts");
    let percentShares = $state<Record<number, string>>({});

    let receiptImage = $state<string | null>(null);
    let receiptImageUrl = $state<string | null>(null);
    let receiptItems = $state<
        Array<{
            description: string;
            quantity: number;
            price: number;
            assignedTo: number[];
        }>
    >([]);
    let scanningReceipt = $state(false);

    let expenseAttachments = $state<Array<{ url: string; name: string; type: string }>>([]);
    let uploadingAttachment = $state(false);

    let editingExpenseId = $state<number | null>(null);

    $effect(() => {
        if ($group) {
            expenseCurrency = $group.baseCurrency || "EUR";
        }

        const currentUserMember = $allMembers.find((m) => m.userId === $user?.id);
        if (currentUserMember && expensePaidBy === 0) {
            expensePaidBy = currentUserMember.id;
        }
    });

    $effect(() => {
        if (page.state?.openAddExpense) {
            showAddExpense = true;
        }
        if (page.state?.openScanReceipt) {
            showScanReceipt = true;
        }
    });

    async function addExpense() {
        if (!expenseDescription || !expenseAmount || selectedMembers.length === 0) return;

        if (splitMode === "percent" && Math.abs(getPercentRemaining()) > 0.01) {
            $error = "Percentages must add up to 100%";
            return;
        }

        try {
            if (!$groupId) return;
            const normalizedAmount = Number.parseFloat(expenseAmount);
            const customSharesArray = buildCustomSharesArray(normalizedAmount);

            await api.expenses.create({
                groupId: $groupId,
                description: expenseDescription,
                note: expenseNote || undefined,
                amount: normalizedAmount,
                currency: expenseCurrency,
                createdAt: expenseDate || undefined,
                paidBy: expensePaidBy || undefined,
                sharedWith: selectedMembers,
                receiptImageUrl: receiptImageUrl || undefined,
                receiptItems: receiptItems.length > 0 ? receiptItems : undefined,
                attachments: expenseAttachments.length > 0 ? expenseAttachments : undefined,
                customShares: customSharesArray,
            });
            resetExpenseForm();
            showAddExpense = false;
            await refresh();
        } catch (e) {
            $error = e instanceof Error ? e.message : "Failed to add expense";
        }
    }

    async function handleReceiptUpload(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            $error = "Please upload an image file";
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            const imageData = e.target?.result as string;
            receiptImage = imageData;
            scanningReceipt = true;
            $error = "";

            try {
                if (!$groupId) return;
                const result = await api.expenses.analyzeReceipt({
                    groupId: $groupId,
                    image: imageData,
                });

                expenseDescription = result.businessName || "Receipt";
                expenseCurrency = result.currency || "EUR";
                receiptImageUrl = result.imageUrl;

                receiptItems = result.items.map((item: any) => ({
                    description: item.description,
                    quantity: item.quantity,
                    price: item.price,
                    assignedTo: [],
                }));

                const total = result.total || receiptItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
                expenseAmount = total.toFixed(2);

                if (result.attachments && result.attachments.length > 0) {
                    expenseAttachments = result.attachments;
                }

                showScanReceipt = false;
                showAddExpense = true;
            } catch (e) {
                console.error(e);
                $error = e instanceof Error ? e.message : "Failed to scan receipt";
            } finally {
                scanningReceipt = false;
            }
        };
        reader.readAsDataURL(file);
    }

    async function handleAttachmentUpload(event: Event) {
        const input = event.target as HTMLInputElement;
        const files = input.files;
        if (!files || files.length === 0) return;

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
            "application/pdf",
            "text/csv",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ];

        for (let i = 0; i < files.length && expenseAttachments.length < 5; i++) {
            const file = files[i];

            if (!allowedTypes.includes(file.type)) {
                $error = `File ${file.name} has unsupported type`;
                continue;
            }

            if (file.size > 10 * 1024 * 1024) {
                $error = `File ${file.name} exceeds 10MB limit`;
                continue;
            }

            uploadingAttachment = true;

            try {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const fileData = e.target?.result as string;

                    try {
                        if (!$groupId) return;
                        const result = await api.expenses.uploadAttachment({
                            groupId: $groupId,
                            file: fileData,
                            filename: file.name,
                        });

                        expenseAttachments = [...expenseAttachments, result];
                    } catch (e) {
                        $error = e instanceof Error ? e.message : "Failed to upload attachment";
                    } finally {
                        uploadingAttachment = false;
                    }
                };
                reader.readAsDataURL(file);
            } catch (e) {
                $error = e instanceof Error ? e.message : "Failed to read file";
                uploadingAttachment = false;
            }
        }
    }

    function removeAttachment(index: number) {
        expenseAttachments = expenseAttachments.filter((_, i) => i !== index);
    }

    function handleImagePreview(url: string) {
        previewImageUrl = url;
    }

    function addReceiptItem() {
        receiptItems = [...receiptItems, { description: "", quantity: 1, price: 0, assignedTo: [] }];
    }

    function deleteReceiptItem(index: number) {
        receiptItems = receiptItems.filter((_, i) => i !== index);
        updateTotalFromItems();
    }

    function updateTotalFromItems() {
        const total = receiptItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        expenseAmount = total.toFixed(2);
    }

    function toggleItemAssignment(itemIndex: number, memberId: number) {
        const item = receiptItems[itemIndex];
        if (item.assignedTo.includes(memberId)) {
            item.assignedTo = item.assignedTo.filter((id) => id !== memberId);
        } else {
            item.assignedTo = [...item.assignedTo, memberId];
        }
        receiptItems = [...receiptItems];
        calculateCustomSharesFromItems();
    }

    function calculateCustomSharesFromItems() {
        if (splitMode !== "amounts") return;
        const memberShares: { [memberId: number]: number } = {};

        for (const item of receiptItems) {
            if (item.assignedTo.length > 0) {
                const itemTotal = item.price * item.quantity;
                const sharePerPerson = itemTotal / item.assignedTo.length;

                for (const memberId of item.assignedTo) {
                    memberShares[memberId] = (memberShares[memberId] || 0) + sharePerPerson;
                }
            }
        }

        const assignedMembers = Object.keys(memberShares).map(Number);
        if (assignedMembers.length > 0) {
            selectedMembers = assignedMembers;
            splitEvenly = false;
            customShares = {};
            for (const memberId of assignedMembers) {
                customShares[memberId] = memberShares[memberId].toFixed(2);
            }
        }
    }

    function toggleMember(memberId: number) {
        if (selectedMembers.includes(memberId)) {
            selectedMembers = selectedMembers.filter((id) => id !== memberId);
            delete customShares[memberId];
            delete percentShares[memberId];
        } else {
            selectedMembers = [...selectedMembers, memberId];
        }
    }

    function selectAllMembers() {
        if (!$allMembers) return;
        selectedMembers = $allMembers.map((m) => m.id);
    }

    function getCustomSharesTotal(): number {
        return selectedMembers.reduce((sum, memberId) => {
            return sum + Number.parseFloat(customShares[memberId] || "0");
        }, 0);
    }

    function getCustomSharesRemaining(): number {
        const total = Number.parseFloat(expenseAmount || "0");
        const allocated = getCustomSharesTotal();
        return total - allocated;
    }

    function getPercentTotal(): number {
        return selectedMembers.reduce((sum, memberId) => {
            return sum + Number.parseFloat(percentShares[memberId] || "0");
        }, 0);
    }

    function getPercentRemaining(): number {
        return 100 - getPercentTotal();
    }

    function distributeEvenly() {
        if (!expenseAmount || selectedMembers.length === 0) return;
        const total = Number.parseFloat(expenseAmount);
        const perPerson = total / selectedMembers.length;
        customShares = {};
        selectedMembers.forEach((memberId) => {
            customShares[memberId] = perPerson.toFixed(2);
        });
    }

    function distributePercentEvenly() {
        if (selectedMembers.length === 0) return;
        const perPerson = 100 / selectedMembers.length;
        percentShares = {};
        let allocated = 0;
        selectedMembers.forEach((memberId, index) => {
            if (index === selectedMembers.length - 1) {
                const remaining = 100 - allocated;
                percentShares[memberId] = remaining.toFixed(2);
                return;
            }
            const value = Number.parseFloat(perPerson.toFixed(2));
            allocated += value;
            percentShares[memberId] = value.toFixed(2);
        });
    }

    function setSplitMode(nextMode: "amounts" | "percent") {
        if (splitMode === nextMode) return;
        splitMode = nextMode;
        $error = "";

        if (nextMode === "percent") {
            const total = Number.parseFloat(expenseAmount || "0");
            percentShares = {};

            if (selectedMembers.length > 0 && total > 0 && Object.keys(customShares).length > 0) {
                selectedMembers.forEach((memberId) => {
                    const amount = Number.parseFloat(customShares[memberId] || "0");
                    percentShares[memberId] = ((amount / total) * 100).toFixed(2);
                });
            }

            if (Object.keys(percentShares).length === 0 && selectedMembers.length > 0) {
                distributePercentEvenly();
            }
        }
    }

    function buildCustomSharesArray(totalAmount: number) {
        if (splitMode === "percent") {
            const shares = selectedMembers.map((memberId) => {
                const percent = Number.parseFloat(percentShares[memberId] || "0");
                const amount = (totalAmount * percent) / 100;
                return {
                    memberId,
                    amount: Number.parseFloat(amount.toFixed(2)),
                };
            });

            if (shares.length > 0) {
                const allocated = shares.reduce((sum, share) => sum + share.amount, 0);
                const diff = Number.parseFloat((totalAmount - allocated).toFixed(2));
                shares[shares.length - 1].amount = Number.parseFloat(
                    (shares[shares.length - 1].amount + diff).toFixed(2),
                );
            }

            return shares;
        }

        if (!splitEvenly) {
            return selectedMembers.map((memberId) => ({
                memberId,
                amount: Number.parseFloat(customShares[memberId] || "0"),
            }));
        }

        return undefined;
    }

    function startEditExpense(expense: Expense) {
        editingExpenseId = expense.id;
        expenseDescription = expense.description;
        expenseNote = expense.note || "";
        splitMode = "amounts";
        expenseAmount = expense.amount.toString();
        expenseCurrency = expense.currency || "EUR";
        expenseDate = new Date(expense.createdAt).toISOString().split("T")[0];
        expensePaidBy = expense.paidBy;
        selectedMembers = expense.shares.map((s) => s.member.id);
        percentShares = {};

        const shareAmount = expense.amount / expense.shares.length;
        const allSharesEqual = expense.shares.every((s) => Math.abs(s.share - shareAmount) < 0.01);

        if (allSharesEqual) {
            splitEvenly = true;
            customShares = {};
        } else {
            splitEvenly = false;
            customShares = {};
            expense.shares.forEach((s) => {
                customShares[s.member.id] = s.share.toFixed(2);
            });
        }

        receiptImageUrl = expense.receiptImageUrl || null;
        if (expense.receiptItems) {
            try {
                receiptItems = JSON.parse(expense.receiptItems);
            } catch {
                receiptItems = [];
            }
        } else {
            receiptItems = [];
        }

        if (expense.attachments) {
            try {
                expenseAttachments = JSON.parse(expense.attachments);
            } catch {
                expenseAttachments = [];
            }
        } else {
            expenseAttachments = [];
        }

        showEditExpense = true;
    }

    async function updateExpense() {
        if (!expenseDescription || !expenseAmount || selectedMembers.length === 0 || !editingExpenseId) return;

        if (splitMode === "percent" && Math.abs(getPercentRemaining()) > 0.01) {
            $error = "Percentages must add up to 100%";
            return;
        }

        try {
            const normalizedAmount = Number.parseFloat(expenseAmount);
            const customSharesArray = buildCustomSharesArray(normalizedAmount);

            await api.expenses.update(editingExpenseId, {
                description: expenseDescription,
                note: expenseNote || undefined,
                amount: normalizedAmount,
                currency: expenseCurrency,
                createdAt: expenseDate || undefined,
                paidBy: expensePaidBy || undefined,
                sharedWith: selectedMembers,
                receiptImageUrl: receiptImageUrl || undefined,
                receiptItems: receiptItems.length > 0 ? receiptItems : undefined,
                attachments: expenseAttachments.length > 0 ? expenseAttachments : undefined,
                customShares: customSharesArray,
            });

            resetExpenseForm();
            showEditExpense = false;
            editingExpenseId = null;
            await refresh();
        } catch (e) {
            $error = e instanceof Error ? e.message : "Failed to update expense";
        }
    }

    async function deleteExpense(expenseId: number) {
        if (!confirm("Are you sure you want to delete this expense?")) return;

        try {
            await api.expenses.delete(expenseId);
            await refresh();
        } catch (e) {
            $error = e instanceof Error ? e.message : "Failed to delete expense";
        }
    }

    function resetExpenseForm() {
        expenseDescription = "";
        expenseNote = "";
        expenseAmount = "";
        expenseDate = "";
        const currentUserMember = $allMembers.find((m) => m.userId === $user?.id);
        expensePaidBy = currentUserMember?.id || 0;
        selectedMembers = [];
        splitEvenly = true;
        customShares = {};
        splitMode = "amounts";
        percentShares = {};
        receiptImage = null;
        receiptImageUrl = null;
        receiptItems = [];
        expenseAttachments = [];
    }
</script>

<svelte:head>
    <title>{$group?.name || "Group"} - Spendbee</title>
</svelte:head>

<GroupExpensesSection
    expenses={$expenses}
    group={$group}
    {formatCurrency}
    {formatDate}
    {getMemberName}
    onEdit={startEditExpense}
    onDelete={deleteExpense}
    onImagePreview={handleImagePreview}
/>

{#if showAddExpense && $group}
    <div class="fixed inset-0 bg-black/80 flex items-end md:items-center justify-center p-4 z-50">
        <div
            class="bg-dark-300 p-6 rounded-t-3xl md:rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto border border-dark-100 shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
        >
            <div class="flex items-center justify-between mb-4">
                <div>
                    <div class="text-xs uppercase tracking-[0.3em] text-gray-500">New expense</div>
                    <h3 class="text-2xl font-bold text-white">Add Expense</h3>
                </div>
                <div
                    class="h-10 w-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-semibold"
                >
                    +
                </div>
            </div>
            <div class="mb-4">
                <div class="text-xs uppercase tracking-[0.3em] text-gray-500">Split category</div>
                <div class="mt-3 flex flex-wrap gap-2">
                    <button
                        type="button"
                        onclick={() => setSplitMode("amounts")}
                        class="rounded-full px-4 py-1.5 text-xs font-semibold transition {splitMode === 'amounts'
                            ? 'bg-primary text-dark'
                            : 'bg-dark-200 text-gray-300 hover:text-white'}"
                    >
                        Amounts
                    </button>
                    <button
                        type="button"
                        onclick={() => setSplitMode("percent")}
                        class="rounded-full px-4 py-1.5 text-xs font-semibold transition {splitMode === 'percent'
                            ? 'bg-primary text-dark'
                            : 'bg-dark-200 text-gray-300 hover:text-white'}"
                    >
                        Percentage
                    </button>
                </div>
                {#if splitMode === "percent"}
                    <p class="mt-2 text-xs text-gray-400">Percentages must total 100%.</p>
                {/if}
            </div>
            <form
                onsubmit={(event) => {
                    event.preventDefault();
                    addExpense();
                }}
                class="space-y-4"
            >
                <div>
                    <label for="description" class="block text-sm font-medium text-gray-300 mb-2"> Description </label>
                    <input
                        type="text"
                        id="description"
                        bind:value={expenseDescription}
                        required
                        class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
                        placeholder="e.g., Dinner, Groceries"
                    />
                </div>
                <div>
                    <label for="note" class="block text-sm font-medium text-gray-300 mb-2"> Note (optional) </label>
                    <textarea
                        id="note"
                        bind:value={expenseNote}
                        rows="2"
                        class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
                        placeholder="Add any additional context or details..."
                    ></textarea>
                </div>
                <div class="grid gap-4 md:grid-cols-2">
                    <div>
                        <label for="amount" class="block text-sm font-medium text-gray-300 mb-2"> Amount </label>
                        <div class="flex items-center gap-2 rounded-lg border border-dark-100 bg-dark-200 px-3 py-2">
                            <span class="text-sm text-gray-400">
                                {expenseCurrency}
                            </span>
                            <input
                                type="number"
                                id="amount"
                                bind:value={expenseAmount}
                                required
                                step="0.01"
                                min="0.01"
                                class="w-full bg-transparent text-white focus:outline-none"
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                    <div>
                        <label for="currency" class="block text-sm font-medium text-gray-300 mb-2"> Currency </label>
                        <select
                            id="currency"
                            bind:value={expenseCurrency}
                            class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
                        >
                            {#each $supportedCurrencies as curr (curr)}
                                <option value={curr}>{curr}</option>
                            {/each}
                        </select>
                    </div>
                </div>
                <div>
                    <label for="expenseDate" class="block text-sm font-medium text-gray-300 mb-2">
                        Date (optional)
                    </label>
                    <div class="flex items-center gap-2 rounded-lg border border-dark-100 bg-dark-200 px-3 py-2">
                        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                        </svg>
                        <input
                            type="date"
                            id="expenseDate"
                            bind:value={expenseDate}
                            max={new Date().toISOString().split("T")[0]}
                            class="w-full bg-transparent text-white focus:outline-none"
                        />
                    </div>
                    <p class="text-xs text-gray-400 mt-1">Leave empty to use today's date</p>
                </div>
                <div>
                    <label for="paidBy" class="block text-sm font-medium text-gray-300 mb-2"> Paid by </label>
                    <select
                        id="paidBy"
                        bind:value={expensePaidBy}
                        class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
                    >
                        {#each $allMembers as member (member.id)}
                            <option value={member.id}>
                                {#if member.userId === $user?.id}
                                    Me ({getMemberName(member)})
                                {:else}
                                    {getMemberName(member)}
                                {/if}
                            </option>
                        {/each}
                    </select>
                    <p class="text-xs text-gray-400 mt-1">Select who paid for this expense</p>
                </div>
                <div>
                    <div class="flex justify-between items-center mb-2">
                        <div class="block text-sm font-medium text-gray-300">
                            Attachments ({expenseAttachments.length}/5)
                        </div>
                        {#if expenseAttachments.length < 5}
                            <label class="text-xs text-primary hover:text-primary-400 cursor-pointer">
                                + Add File
                                <input
                                    type="file"
                                    multiple
                                    accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.csv,.xlsx,.xls,.doc,.docx"
                                    onchange={handleAttachmentUpload}
                                    class="hidden"
                                />
                            </label>
                        {/if}
                    </div>
                    {#if expenseAttachments.length > 0}
                        <AttachmentPreview
                            attachments={expenseAttachments}
                            onRemove={removeAttachment}
                            onImageClick={(attachment) => handleImagePreview(attachment.url)}
                            showRemove={true}
                        />
                    {:else}
                        <p class="text-xs text-gray-400">
                            You can attach images, PDFs, spreadsheets, or documents (max 5 files, 10MB each)
                        </p>
                    {/if}
                    {#if uploadingAttachment}
                        <div class="text-xs text-gray-400 mt-2">Uploading...</div>
                    {/if}
                </div>
                {#if receiptItems.length > 0 && splitMode === "amounts"}
                    <div class="border border-dark-100 rounded-lg p-3">
                        <div class="flex justify-between items-center mb-3">
                            <h4 class="text-sm font-medium text-white">Receipt Items</h4>
                            <button
                                type="button"
                                onclick={addReceiptItem}
                                class="text-xs text-primary hover:text-primary-400"
                            >
                                + Add Item
                            </button>
                        </div>
                        <div class="hidden md:flex gap-2 mb-2 px-3 py-2 bg-dark-300 rounded-lg">
                            <div class="flex-1 text-xs font-medium text-gray-400">Name</div>
                            <div class="w-16 text-xs font-medium text-gray-400 text-center">Qty</div>
                            <div class="w-20 text-xs font-medium text-gray-400 text-center">Price</div>
                            <div class="w-6"></div>
                        </div>
                        <div class="space-y-3 max-h-64 overflow-y-auto">
                            {#each receiptItems as item, index (index)}
                                <div class="bg-dark-200 p-3 rounded-lg">
                                    <div class="md:hidden space-y-2">
                                        <div class="flex items-center justify-between mb-2">
                                            <span class="text-xs text-gray-400">
                                                Item {index + 1}
                                            </span>
                                            <button
                                                type="button"
                                                onclick={() => deleteReceiptItem(index)}
                                                class="text-red-400 hover:text-red-300 text-xs w-6 h-6 flex items-center justify-center"
                                                aria-label="Remove item"
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
                                                        d="M6 18L18 6M6 6l12 12"
                                                    />
                                                </svg>
                                            </button>
                                        </div>
                                        <div>
                                            <div class="text-xs text-gray-400 block mb-1">Name</div>
                                            <input
                                                type="text"
                                                bind:value={item.description}
                                                oninput={updateTotalFromItems}
                                                placeholder="Item name"
                                                class="w-full px-2 py-1.5 text-sm bg-dark-300 border border-dark-100 rounded text-white focus:outline-none focus:border-primary"
                                            />
                                        </div>
                                        <div class="grid grid-cols-2 gap-2">
                                            <div>
                                                <div class="text-xs text-gray-400 block mb-1">Qty</div>
                                                <input
                                                    type="number"
                                                    bind:value={item.quantity}
                                                    oninput={updateTotalFromItems}
                                                    min="1"
                                                    placeholder="1"
                                                    class="w-full px-2 py-1.5 text-sm bg-dark-300 border border-dark-100 rounded text-white focus:outline-none focus:border-primary"
                                                />
                                            </div>
                                            <div>
                                                <div class="text-xs text-gray-400 block mb-1">Price</div>
                                                <input
                                                    type="number"
                                                    bind:value={item.price}
                                                    oninput={updateTotalFromItems}
                                                    step="0.01"
                                                    min="0"
                                                    placeholder="0.00"
                                                    class="w-full px-2 py-1.5 text-sm bg-dark-300 border border-dark-100 rounded text-white focus:outline-none focus:border-primary"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div class="hidden md:flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            bind:value={item.description}
                                            oninput={updateTotalFromItems}
                                            placeholder="Item description"
                                            class="flex-1 px-2 py-1 text-sm bg-dark-300 border border-dark-100 rounded text-white focus:outline-none focus:border-primary"
                                        />
                                        <input
                                            type="number"
                                            bind:value={item.quantity}
                                            oninput={updateTotalFromItems}
                                            min="1"
                                            placeholder="Qty"
                                            class="w-16 px-2 py-1 text-sm bg-dark-300 border border-dark-100 rounded text-white focus:outline-none focus:border-primary"
                                        />
                                        <input
                                            type="number"
                                            bind:value={item.price}
                                            oninput={updateTotalFromItems}
                                            step="0.01"
                                            min="0"
                                            placeholder="Price"
                                            class="w-20 px-2 py-1 text-sm bg-dark-300 border border-dark-100 rounded text-white focus:outline-none focus:border-primary"
                                        />
                                        <button
                                            type="button"
                                            onclick={() => deleteReceiptItem(index)}
                                            class="text-red-400 hover:text-red-300 text-xs"
                                            aria-label="Remove item"
                                        >
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                    stroke-width="2"
                                                    d="M6 18L18 6M6 6l12 12"
                                                />
                                            </svg>
                                        </button>
                                    </div>

                                    <div class="flex flex-wrap gap-2 mt-2">
                                        <span class="text-xs text-gray-400"> Assign to: </span>
                                        {#each $allMembers as member (member.id)}
                                            <label class="flex items-center gap-1">
                                                <input
                                                    type="checkbox"
                                                    checked={item.assignedTo.includes(member.id)}
                                                    onchange={() => toggleItemAssignment(index, member.id)}
                                                    class="w-3 h-3 text-primary bg-dark border-dark-100 rounded"
                                                />
                                                <span class="text-xs text-gray-300">
                                                    {getMemberName(member)}
                                                </span>
                                            </label>
                                        {/each}
                                    </div>
                                </div>
                            {/each}
                        </div>
                        <div class="mt-2 text-xs text-gray-400">
                            Auto-calculated from items. Assignments update split shares.
                        </div>
                    </div>
                {/if}

                <div>
                    <div class="flex justify-between items-center mb-2">
                        <div class="block text-sm font-medium text-gray-300">Split with</div>
                        <button
                            type="button"
                            onclick={selectAllMembers}
                            class="text-xs text-primary hover:text-primary-400"
                        >
                            Select All
                        </button>
                    </div>
                    <div class="grid gap-2 sm:grid-cols-2 max-h-48 overflow-y-auto">
                        {#each $allMembers as member (member.id)}
                            <label
                                class="flex items-center space-x-2 p-2 bg-dark-200 rounded-lg cursor-pointer border border-dark-100 hover:border-primary/50 transition"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedMembers.includes(member.id)}
                                    onchange={() => toggleMember(member.id)}
                                    class="w-4 h-4 text-primary bg-dark border-dark-100 rounded focus:ring-primary"
                                />
                                <span class="text-white">
                                    {getMemberName(member)}
                                </span>
                            </label>
                        {/each}
                    </div>
                    {#if selectedMembers.length > 0}
                        <div class="mt-3 p-3 bg-dark-200 rounded-lg">
                            {#if splitMode === "percent"}
                                <div class="space-y-2 mb-2">
                                    <div class="flex justify-between items-center">
                                        <span class="text-xs font-medium text-gray-300"> Custom percentages </span>
                                        <button
                                            type="button"
                                            onclick={distributePercentEvenly}
                                            class="text-xs text-primary hover:text-primary-400"
                                        >
                                            Auto-fill evenly
                                        </button>
                                    </div>
                                    {#each selectedMembers as memberId (memberId)}
                                        {@const member = $allMembers.find((m) => m.id === memberId)}
                                        {#if member}
                                            {@const total = Number.parseFloat(expenseAmount || "0")}
                                            {@const percent = Number.parseFloat(percentShares[memberId] || "0")}
                                            <div class="flex items-center space-x-2">
                                                <span class="text-xs text-gray-400 flex-1">
                                                    {getMemberName(member)}
                                                </span>
                                                <span class="text-[11px] text-gray-500">
                                                    {formatCurrency((total * percent) / 100)}
                                                    {expenseCurrency}
                                                </span>
                                                <div class="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        bind:value={percentShares[memberId]}
                                                        step="0.01"
                                                        min="0"
                                                        max="100"
                                                        placeholder="0"
                                                        class="w-24 px-2 py-1 text-sm bg-dark-300 border border-dark-100 rounded text-white focus:outline-none focus:border-primary"
                                                    />
                                                    <span class="text-xs text-gray-500">%</span>
                                                </div>
                                            </div>
                                        {/if}
                                    {/each}
                                </div>
                                <div class="text-xs space-y-1">
                                    <div class="flex justify-between text-gray-400">
                                        <span>Total allocated:</span>
                                        <span>{getPercentTotal().toFixed(2)}%</span>
                                    </div>
                                    <div
                                        class="flex justify-between {Math.abs(getPercentRemaining()) < 0.01
                                            ? 'text-green-400'
                                            : 'text-red-400'}"
                                    >
                                        <span>Remaining:</span>
                                        <span>
                                            {getPercentRemaining().toFixed(2)}%
                                        </span>
                                    </div>
                                </div>
                            {:else}
                                <label class="flex items-center space-x-2 mb-3">
                                    <input
                                        type="checkbox"
                                        bind:checked={splitEvenly}
                                        class="w-4 h-4 text-primary bg-dark border-dark-100 rounded focus:ring-primary"
                                    />
                                    <span class="text-sm text-gray-300"> Split evenly </span>
                                </label>
                                {#if splitEvenly}
                                    <p class="text-xs text-gray-400">
                                        {selectedMembers.length} member(s) selected • {formatCurrency(
                                            parseFloat(expenseAmount || "0") / selectedMembers.length,
                                        )}
                                        {expenseCurrency} each
                                    </p>
                                {:else}
                                    <div class="space-y-2 mb-2">
                                        <div class="flex justify-between items-center">
                                            <span class="text-xs font-medium text-gray-300"> Custom amounts </span>
                                            <button
                                                type="button"
                                                onclick={distributeEvenly}
                                                class="text-xs text-primary hover:text-primary-400"
                                            >
                                                Auto-fill evenly
                                            </button>
                                        </div>
                                        {#each selectedMembers as memberId (memberId)}
                                            {@const member = $allMembers.find((m) => m.id === memberId)}
                                            {#if member}
                                                <div class="flex items-center space-x-2">
                                                    <span class="text-xs text-gray-400 flex-1">
                                                        {getMemberName(member)}
                                                    </span>
                                                    <input
                                                        type="number"
                                                        bind:value={customShares[memberId]}
                                                        step="0.01"
                                                        min="0"
                                                        placeholder="0.00"
                                                        class="w-24 px-2 py-1 text-sm bg-dark-300 border border-dark-100 rounded text-white focus:outline-none focus:border-primary"
                                                    />
                                                </div>
                                            {/if}
                                        {/each}
                                    </div>
                                    <div class="text-xs space-y-1">
                                        <div class="flex justify-between text-gray-400">
                                            <span>Total allocated:</span>
                                            <span>
                                                {formatCurrency(getCustomSharesTotal())}
                                                {expenseCurrency}
                                            </span>
                                        </div>
                                        <div
                                            class="flex justify-between {Math.abs(getCustomSharesRemaining()) < 0.01
                                                ? 'text-green-400'
                                                : 'text-red-400'}"
                                        >
                                            <span>Remaining:</span>
                                            <span>
                                                {formatCurrency(getCustomSharesRemaining())}
                                                {expenseCurrency}
                                            </span>
                                        </div>
                                    </div>
                                {/if}
                            {/if}
                        </div>
                    {/if}
                </div>

                <div class="flex gap-2">
                    <button
                        type="submit"
                        class="flex-1 bg-primary text-dark py-2.5 px-4 rounded-xl font-semibold hover:bg-primary-400 transition"
                    >
                        Save Expense
                    </button>
                    <button
                        type="button"
                        onclick={() => {
                            showAddExpense = false;
                            resetExpenseForm();
                        }}
                        class="flex-1 bg-dark-200 text-white py-2.5 px-4 rounded-xl font-semibold hover:bg-dark-100 transition"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}

{#if showEditExpense && $group}
    <div class="fixed inset-0 bg-black/80 flex items-end md:items-center justify-center p-4 z-50">
        <div
            class="bg-dark-300 p-6 rounded-t-3xl md:rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto border border-dark-100 shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
        >
            <div class="flex items-center justify-between mb-4">
                <div>
                    <div class="text-xs uppercase tracking-[0.3em] text-gray-500">Edit</div>
                    <h3 class="text-2xl font-bold text-white">Edit Expense</h3>
                </div>
                <div
                    class="h-10 w-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-semibold"
                >
                    ED
                </div>
            </div>
            <div class="mb-4">
                <div class="text-xs uppercase tracking-[0.3em] text-gray-500">Split category</div>
                <div class="mt-3 flex flex-wrap gap-2">
                    <button
                        type="button"
                        onclick={() => setSplitMode("amounts")}
                        class="rounded-full px-4 py-1.5 text-xs font-semibold transition {splitMode === 'amounts'
                            ? 'bg-primary text-dark'
                            : 'bg-dark-200 text-gray-300 hover:text-white'}"
                    >
                        Amounts
                    </button>
                    <button
                        type="button"
                        onclick={() => setSplitMode("percent")}
                        class="rounded-full px-4 py-1.5 text-xs font-semibold transition {splitMode === 'percent'
                            ? 'bg-primary text-dark'
                            : 'bg-dark-200 text-gray-300 hover:text-white'}"
                    >
                        Percentage
                    </button>
                </div>
                {#if splitMode === "percent"}
                    <p class="mt-2 text-xs text-gray-400">Percentages must total 100%.</p>
                {/if}
            </div>
            <form
                onsubmit={(event) => {
                    event.preventDefault();
                    updateExpense();
                }}
                class="space-y-4"
            >
                <div>
                    <label for="editDescription" class="block text-sm font-medium text-gray-300 mb-2">
                        Description
                    </label>
                    <input
                        type="text"
                        id="editDescription"
                        bind:value={expenseDescription}
                        required
                        class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
                        placeholder="e.g., Dinner, Groceries"
                    />
                </div>
                <div>
                    <label for="editNote" class="block text-sm font-medium text-gray-300 mb-2"> Note (optional) </label>
                    <textarea
                        id="editNote"
                        bind:value={expenseNote}
                        rows="2"
                        class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
                        placeholder="Add any additional context or details..."
                    ></textarea>
                </div>
                <div class="grid gap-4 md:grid-cols-2">
                    <div>
                        <label for="editAmount" class="block text-sm font-medium text-gray-300 mb-2"> Amount </label>
                        <div class="flex items-center gap-2 rounded-lg border border-dark-100 bg-dark-200 px-3 py-2">
                            <span class="text-sm text-gray-400">
                                {expenseCurrency}
                            </span>
                            <input
                                type="number"
                                id="editAmount"
                                bind:value={expenseAmount}
                                required
                                step="0.01"
                                min="0.01"
                                class="w-full bg-transparent text-white focus:outline-none"
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                    <div>
                        <label for="editCurrency" class="block text-sm font-medium text-gray-300 mb-2">
                            Currency
                        </label>
                        <select
                            id="editCurrency"
                            bind:value={expenseCurrency}
                            class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
                        >
                            {#each $supportedCurrencies as curr (curr)}
                                <option value={curr}>{curr}</option>
                            {/each}
                        </select>
                    </div>
                </div>
                <div>
                    <label for="editExpenseDate" class="block text-sm font-medium text-gray-300 mb-2">
                        Date (optional)
                    </label>
                    <div class="flex items-center gap-2 rounded-lg border border-dark-100 bg-dark-200 px-3 py-2">
                        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                        </svg>
                        <input
                            type="date"
                            id="editExpenseDate"
                            bind:value={expenseDate}
                            max={new Date().toISOString().split("T")[0]}
                            class="w-full bg-transparent text-white focus:outline-none"
                        />
                    </div>
                    <p class="text-xs text-gray-400 mt-1">Leave empty to use today's date</p>
                </div>
                <div>
                    <label for="editPaidBy" class="block text-sm font-medium text-gray-300 mb-2"> Paid by </label>
                    <select
                        id="editPaidBy"
                        bind:value={expensePaidBy}
                        class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
                    >
                        {#each $allMembers as member (member.id)}
                            <option value={member.id}>
                                {#if member.userId === $user?.id}
                                    Me ({getMemberName(member)})
                                {:else}
                                    {getMemberName(member)}
                                {/if}
                            </option>
                        {/each}
                    </select>
                    <p class="text-xs text-gray-400 mt-1">Select who paid for this expense</p>
                </div>
                <div>
                    <div class="flex justify-between items-center mb-2">
                        <div class="block text-sm font-medium text-gray-300">
                            Attachments ({expenseAttachments.length}/5)
                        </div>
                        {#if expenseAttachments.length < 5}
                            <label class="text-xs text-primary hover:text-primary-400 cursor-pointer">
                                + Add File
                                <input
                                    type="file"
                                    multiple
                                    accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.csv,.xlsx,.xls,.doc,.docx"
                                    onchange={handleAttachmentUpload}
                                    class="hidden"
                                />
                            </label>
                        {/if}
                    </div>
                    {#if expenseAttachments.length > 0}
                        <AttachmentPreview
                            attachments={expenseAttachments}
                            onRemove={removeAttachment}
                            onImageClick={(attachment) => handleImagePreview(attachment.url)}
                            showRemove={true}
                        />
                    {:else}
                        <p class="text-xs text-gray-400">
                            You can attach images, PDFs, spreadsheets, or documents (max 5 files, 10MB each)
                        </p>
                    {/if}
                    {#if uploadingAttachment}
                        <div class="text-xs text-gray-400 mt-2">Uploading...</div>
                    {/if}
                </div>

                {#if receiptImageUrl}
                    <div class="border border-dark-100 rounded-lg p-3">
                        <h4 class="text-sm font-medium text-white mb-2">Receipt Image</h4>
                        <button
                            type="button"
                            class="w-full rounded-lg hover:opacity-90 transition"
                            onclick={() => (showReceiptPreview = editingExpenseId)}
                            aria-label="Preview receipt"
                        >
                            <img
                                src={`/api/receipts/view/${encodeURIComponent(receiptImageUrl)}`}
                                alt="Receipt"
                                class="w-full rounded-lg"
                            />
                        </button>
                    </div>
                {/if}

                {#if receiptItems.length > 0 && splitMode === "amounts"}
                    <div class="border border-dark-100 rounded-lg p-3">
                        <div class="flex justify-between items-center mb-3">
                            <h4 class="text-sm font-medium text-white">Receipt Items</h4>
                            <button
                                type="button"
                                onclick={addReceiptItem}
                                class="text-xs text-primary hover:text-primary-400"
                            >
                                + Add Item
                            </button>
                        </div>
                        <div class="hidden md:flex gap-2 mb-2 px-3 py-2 bg-dark-300 rounded-lg">
                            <div class="flex-1 text-xs font-medium text-gray-400">Name</div>
                            <div class="w-16 text-xs font-medium text-gray-400 text-center">Qty</div>
                            <div class="w-20 text-xs font-medium text-gray-400 text-center">Price</div>
                            <div class="w-6"></div>
                        </div>
                        <div class="space-y-3 max-h-64 overflow-y-auto">
                            {#each receiptItems as item, index (index)}
                                <div class="bg-dark-200 p-3 rounded-lg">
                                    <div class="md:hidden space-y-2">
                                        <div class="flex items-center justify-between mb-2">
                                            <span class="text-xs text-gray-400">
                                                Item {index + 1}
                                            </span>
                                            <button
                                                type="button"
                                                onclick={() => deleteReceiptItem(index)}
                                                class="text-red-400 hover:text-red-300 text-xs w-6 h-6 flex items-center justify-center"
                                                aria-label="Remove item"
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
                                                        d="M6 18L18 6M6 6l12 12"
                                                    />
                                                </svg>
                                            </button>
                                        </div>
                                        <div>
                                            <div class="text-xs text-gray-400 block mb-1">Name</div>
                                            <input
                                                type="text"
                                                bind:value={item.description}
                                                oninput={updateTotalFromItems}
                                                placeholder="Item name"
                                                class="w-full px-2 py-1.5 text-sm bg-dark-300 border border-dark-100 rounded text-white focus:outline-none focus:border-primary"
                                            />
                                        </div>
                                        <div class="grid grid-cols-2 gap-2">
                                            <div>
                                                <div class="text-xs text-gray-400 block mb-1">Qty</div>
                                                <input
                                                    type="number"
                                                    bind:value={item.quantity}
                                                    oninput={updateTotalFromItems}
                                                    min="1"
                                                    placeholder="1"
                                                    class="w-full px-2 py-1.5 text-sm bg-dark-300 border border-dark-100 rounded text-white focus:outline-none focus:border-primary"
                                                />
                                            </div>
                                            <div>
                                                <div class="text-xs text-gray-400 block mb-1">Price</div>
                                                <input
                                                    type="number"
                                                    bind:value={item.price}
                                                    oninput={updateTotalFromItems}
                                                    step="0.01"
                                                    min="0"
                                                    placeholder="0.00"
                                                    class="w-full px-2 py-1.5 text-sm bg-dark-300 border border-dark-100 rounded text-white focus:outline-none focus:border-primary"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div class="hidden md:flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            bind:value={item.description}
                                            oninput={updateTotalFromItems}
                                            placeholder="Item description"
                                            class="flex-1 px-2 py-1 text-sm bg-dark-300 border border-dark-100 rounded text-white focus:outline-none focus:border-primary"
                                        />
                                        <input
                                            type="number"
                                            bind:value={item.quantity}
                                            oninput={updateTotalFromItems}
                                            min="1"
                                            placeholder="Qty"
                                            class="w-16 px-2 py-1 text-sm bg-dark-300 border border-dark-100 rounded text-white focus:outline-none focus:border-primary"
                                        />
                                        <input
                                            type="number"
                                            bind:value={item.price}
                                            oninput={updateTotalFromItems}
                                            step="0.01"
                                            min="0"
                                            placeholder="Price"
                                            class="w-20 px-2 py-1 text-sm bg-dark-300 border border-dark-100 rounded text-white focus:outline-none focus:border-primary"
                                        />
                                        <button
                                            type="button"
                                            onclick={() => deleteReceiptItem(index)}
                                            class="text-red-400 hover:text-red-300 text-xs"
                                            aria-label="Remove item"
                                        >
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                    stroke-width="2"
                                                    d="M6 18L18 6M6 6l12 12"
                                                />
                                            </svg>
                                        </button>
                                    </div>

                                    <div class="flex flex-wrap gap-2 mt-2">
                                        <span class="text-xs text-gray-400"> Assign to: </span>
                                        {#each $allMembers as member (member.id)}
                                            <label class="flex items-center gap-1">
                                                <input
                                                    type="checkbox"
                                                    checked={item.assignedTo.includes(member.id)}
                                                    onchange={() => toggleItemAssignment(index, member.id)}
                                                    class="w-3 h-3 text-primary bg-dark border-dark-100 rounded"
                                                />
                                                <span class="text-xs text-gray-300">
                                                    {getMemberName(member)}
                                                </span>
                                            </label>
                                        {/each}
                                    </div>
                                </div>
                            {/each}
                        </div>
                        <div class="mt-2 text-xs text-gray-400">
                            Auto-calculated from items. Assignments update split shares.
                        </div>
                    </div>
                {/if}

                <div>
                    <div class="flex justify-between items-center mb-2">
                        <div class="block text-sm font-medium text-gray-300">Split with</div>
                        <button
                            type="button"
                            onclick={selectAllMembers}
                            class="text-xs text-primary hover:text-primary-400"
                        >
                            Select All
                        </button>
                    </div>
                    <div class="grid gap-2 sm:grid-cols-2 max-h-48 overflow-y-auto">
                        {#each $allMembers as member (member.id)}
                            <label
                                class="flex items-center space-x-2 p-2 bg-dark-200 rounded-lg cursor-pointer border border-dark-100 hover:border-primary/50 transition"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedMembers.includes(member.id)}
                                    onchange={() => toggleMember(member.id)}
                                    class="w-4 h-4 text-primary bg-dark border-dark-100 rounded focus:ring-primary"
                                />
                                <span class="text-white">
                                    {getMemberName(member)}
                                </span>
                            </label>
                        {/each}
                    </div>
                    {#if selectedMembers.length > 0}
                        <div class="mt-3 p-3 bg-dark-200 rounded-lg">
                            {#if splitMode === "percent"}
                                <div class="space-y-2 mb-2">
                                    <div class="flex justify-between items-center">
                                        <span class="text-xs font-medium text-gray-300"> Custom percentages </span>
                                        <button
                                            type="button"
                                            onclick={distributePercentEvenly}
                                            class="text-xs text-primary hover:text-primary-400"
                                        >
                                            Auto-fill evenly
                                        </button>
                                    </div>
                                    {#each selectedMembers as memberId (memberId)}
                                        {@const member = $allMembers.find((m) => m.id === memberId)}
                                        {#if member}
                                            {@const total = Number.parseFloat(expenseAmount || "0")}
                                            {@const percent = Number.parseFloat(percentShares[memberId] || "0")}
                                            <div class="flex items-center space-x-2">
                                                <span class="text-xs text-gray-400 flex-1">
                                                    {getMemberName(member)}
                                                </span>
                                                <span class="text-[11px] text-gray-500">
                                                    {formatCurrency((total * percent) / 100)}
                                                    {expenseCurrency}
                                                </span>
                                                <div class="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        bind:value={percentShares[memberId]}
                                                        step="0.01"
                                                        min="0"
                                                        max="100"
                                                        placeholder="0"
                                                        class="w-24 px-2 py-1 text-sm bg-dark-300 border border-dark-100 rounded text-white focus:outline-none focus:border-primary"
                                                    />
                                                    <span class="text-xs text-gray-500">%</span>
                                                </div>
                                            </div>
                                        {/if}
                                    {/each}
                                </div>
                                <div class="text-xs space-y-1">
                                    <div class="flex justify-between text-gray-400">
                                        <span>Total allocated:</span>
                                        <span>{getPercentTotal().toFixed(2)}%</span>
                                    </div>
                                    <div
                                        class="flex justify-between {Math.abs(getPercentRemaining()) < 0.01
                                            ? 'text-green-400'
                                            : 'text-red-400'}"
                                    >
                                        <span>Remaining:</span>
                                        <span>
                                            {getPercentRemaining().toFixed(2)}%
                                        </span>
                                    </div>
                                </div>
                            {:else}
                                <label class="flex items-center space-x-2 mb-3">
                                    <input
                                        type="checkbox"
                                        bind:checked={splitEvenly}
                                        class="w-4 h-4 text-primary bg-dark border-dark-100 rounded focus:ring-primary"
                                    />
                                    <span class="text-sm text-gray-300"> Split evenly </span>
                                </label>
                                {#if splitEvenly}
                                    <p class="text-xs text-gray-400">
                                        {selectedMembers.length} member(s) selected • {formatCurrency(
                                            parseFloat(expenseAmount || "0") / selectedMembers.length,
                                        )}
                                        {expenseCurrency} each
                                    </p>
                                {:else}
                                    <div class="space-y-2 mb-2">
                                        <div class="flex justify-between items-center">
                                            <span class="text-xs font-medium text-gray-300"> Custom amounts </span>
                                            <button
                                                type="button"
                                                onclick={distributeEvenly}
                                                class="text-xs text-primary hover:text-primary-400"
                                            >
                                                Auto-fill evenly
                                            </button>
                                        </div>
                                        {#each selectedMembers as memberId (memberId)}
                                            {@const member = $allMembers.find((m) => m.id === memberId)}
                                            {#if member}
                                                <div class="flex items-center space-x-2">
                                                    <span class="text-xs text-gray-400 flex-1">
                                                        {getMemberName(member)}
                                                    </span>
                                                    <input
                                                        type="number"
                                                        bind:value={customShares[memberId]}
                                                        step="0.01"
                                                        min="0"
                                                        placeholder="0.00"
                                                        class="w-24 px-2 py-1 text-sm bg-dark-300 border border-dark-100 rounded text-white focus:outline-none focus:border-primary"
                                                    />
                                                </div>
                                            {/if}
                                        {/each}
                                    </div>
                                    <div class="text-xs space-y-1">
                                        <div class="flex justify-between text-gray-400">
                                            <span>Total allocated:</span>
                                            <span>
                                                {formatCurrency(getCustomSharesTotal())}
                                                {expenseCurrency}
                                            </span>
                                        </div>
                                        <div
                                            class="flex justify-between {Math.abs(getCustomSharesRemaining()) < 0.01
                                                ? 'text-green-400'
                                                : 'text-red-400'}"
                                        >
                                            <span>Remaining:</span>
                                            <span>
                                                {formatCurrency(getCustomSharesRemaining())}
                                                {expenseCurrency}
                                            </span>
                                        </div>
                                    </div>
                                {/if}
                            {/if}
                        </div>
                    {/if}
                </div>

                <div class="flex gap-2">
                    <button
                        type="submit"
                        class="flex-1 bg-primary text-dark py-2.5 px-4 rounded-xl font-semibold hover:bg-primary-400 transition"
                    >
                        Save Changes
                    </button>
                    <button
                        type="button"
                        onclick={() => {
                            showEditExpense = false;
                            editingExpenseId = null;
                            resetExpenseForm();
                        }}
                        class="flex-1 bg-dark-200 text-white py-2.5 px-4 rounded-xl font-semibold hover:bg-dark-100 transition"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}

{#if showScanReceipt && $group}
    <div class="fixed inset-0 bg-black/80 flex items-end md:items-center justify-center p-4 z-50">
        <div
            class="bg-dark-300 p-6 rounded-t-3xl md:rounded-2xl max-w-md w-full border border-dark-100 shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
        >
            <div class="flex items-center justify-between mb-4">
                <div>
                    <div class="text-xs uppercase tracking-[0.3em] text-gray-500">Scan receipt</div>
                    <h3 class="text-2xl font-bold text-white">Receipt Scan</h3>
                </div>
                <div
                    class="h-10 w-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-semibold"
                >
                    R
                </div>
            </div>
            <div class="space-y-4">
                <label
                    class="block w-full rounded-2xl border border-dashed border-dark-100 bg-dark-200/70 p-6 text-center cursor-pointer"
                >
                    {#if scanningReceipt}
                        <div class="text-sm text-gray-400">Scanning...</div>
                    {:else}
                        <div class="flex flex-col items-center gap-2">
                            <svg class="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                                />
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                            </svg>
                            <span class="text-gray-300"> Click to upload receipt image </span>
                            <span class="text-xs text-gray-400"> JPG, PNG, or HEIC </span>
                        </div>
                    {/if}
                    <input
                        id="receiptUpload"
                        type="file"
                        accept="image/*"
                        onchange={handleReceiptUpload}
                        disabled={scanningReceipt}
                        class="hidden"
                    />
                </label>
            </div>
            <div class="flex gap-2 mt-4">
                <button
                    type="button"
                    onclick={() => (showScanReceipt = false)}
                    class="flex-1 bg-dark-200 text-white py-2.5 px-4 rounded-xl font-semibold hover:bg-dark-100 transition"
                >
                    Cancel
                </button>
            </div>
        </div>
    </div>
{/if}

{#if previewImageUrl}
    <div class="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
        <div class="max-w-4xl max-h-full">
            <img
                src={`/api/receipts/view/${encodeURIComponent(previewImageUrl)}`}
                alt="Preview"
                class="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            <button
                onclick={() => (previewImageUrl = null)}
                class="mt-4 w-full bg-dark-300 text-white py-2 px-4 rounded-lg font-semibold hover:bg-dark-200 transition"
            >
                Close
            </button>
        </div>
    </div>
{/if}

{#if showReceiptPreview !== null}
    {@const expense = $expenses.find((e) => e.id === showReceiptPreview)}
    {#if expense && expense.receiptImageUrl}
        <div class="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
            <div class="max-w-4xl max-h-full">
                <img
                    src={`/api/receipts/view/${encodeURIComponent(expense.receiptImageUrl)}`}
                    alt="Receipt"
                    class="max-w-full max-h-[90vh] object-contain rounded-lg"
                />
                <button
                    onclick={() => (showReceiptPreview = null)}
                    class="mt-4 w-full bg-dark-300 text-white py-2 px-4 rounded-lg font-semibold hover:bg-dark-200 transition"
                >
                    Close
                </button>
            </div>
        </div>
    {/if}
{/if}
