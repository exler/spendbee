<script lang="ts">
    import { onMount } from "svelte";
    import { page } from "$app/state";
    import { goto } from "$app/navigation";
    import { user } from "$lib/stores/auth";
    import { api } from "$lib/api";
    import AttachmentPreview from "$lib/components/AttachmentPreview.svelte";
    import LeftSidebar from "$lib/components/LeftSidebar.svelte";
    import RightSidebar from "$lib/components/RightSidebar.svelte";
    import MobileNavbar from "$lib/components/MobileNavbar.svelte";

    interface GroupMember {
        id: number;
        userId: number | null;
        name: string | null;
        user?: {
            id: number;
            name: string;
            email: string;
            avatarUrl?: string | null;
        };
    }

    interface Group {
        id: number;
        uuid: string;
        name: string;
        description: string | null;
        baseCurrency?: string;
        archived?: boolean;
        createdBy?: number;
        imageUrl?: string | null;
        members: GroupMember[];
    }

    interface CurrencyBalance {
        currency: string;
        amount: number;
    }

    interface Expense {
        id: number;
        description: string;
        note?: string;
        amount: number;
        currency?: string;
        exchangeRate?: number;
        paidBy: number;
        createdAt: Date;
        payer: GroupMember;
        shares: Array<{ member: GroupMember; share: number }>;
        receiptImageUrl?: string;
        receiptItems?: string;
        attachments?: string;
    }

    interface Balance {
        memberId: number;
        memberName: string;
        balance: number;
        balanceByCurrency?: CurrencyBalance[];
        balanceInBaseCurrency?: number;
        isGuest?: boolean;
        avatarUrl?: string | null;
    }

    interface Settlement {
        id: number;
        fromMember: GroupMember;
        toMember: GroupMember;
        amount: number;
        currency?: string;
        exchangeRate?: number;
        createdAt: Date;
    }

    interface PendingInvitation {
        id: number;
        email: string;
        type: "notification" | "token";
        invitedBy: {
            id: number;
            name: string;
            email: string;
        };
        createdAt: Date;
    }

    let groupUuid: string;
    let groupId: number; // Internal database ID, still used for creating expenses/settlements
    let group: Group | null = null;
    let allMembers: GroupMember[] = [];
    let pendingInvitations: PendingInvitation[] = [];
    let expenses: Expense[] = [];
    let balances: Balance[] = [];
    let settlements: Settlement[] = [];
    let loading = true;
    let error = "";
    let activeTab: "expenses" | "balances" | "settlements" | "members" | "settings" = "expenses";

    let showAddExpense = false;
    let showSettleDebt = false;
    let showAddGuestMember = false;
    let showInviteMember = false;
    let showChangeCurrency = false;
    let expenseDescription = "";
    let expenseNote = "";
    let expenseAmount = "";
    let expenseCurrency = "EUR";
    let expenseDate = "";
    let expensePaidBy = 0;
    let selectedMembers: number[] = [];
    let splitEvenly = true;
    let customShares: { [memberId: number]: string } = {};
    let splitMode: "amounts" | "percent" = "amounts";
    let percentShares: { [memberId: number]: string } = {};
    let settleFromMember = 0;
    let settleToMember = 0;
    let settleAmount = "";
    let settleCurrency = "EUR";
    let newGuestMemberName = "";
    let inviteEmail = "";
    let newBaseCurrency = "EUR";
    let supportedCurrencies: string[] = [];

    let editGroupName = "";
    let editGroupDescription = "";
    let editGroupCurrency = "EUR";
    let settingsSaved = false;
    let uploadingGroupImage = false;

    // Receipt scanning variables
    let showScanReceipt = false;
    let receiptImage: string | null = null;
    let receiptImageUrl: string | null = null;
    let receiptItems: Array<{
        description: string;
        quantity: number;
        price: number;
        assignedTo: number[];
    }> = [];
    let scanningReceipt = false;
    let showReceiptPreview: number | null = null;

    // Attachment variables
    let expenseAttachments: Array<{ url: string; name: string; type: string }> = [];
    let uploadingAttachment = false;
    let previewImageUrl: string | null = null;

    // Edit expense variables
    let showEditExpense = false;
    let editingExpenseId: number | null = null;

    onMount(() => {
        if (!$user) {
            goto("/login");
            return;
        }
        groupUuid = page.params.id!;
        loadGroupData();
    });

    async function loadGroupData() {
        loading = true;
        try {
            [group, allMembers, pendingInvitations, expenses, balances, settlements, supportedCurrencies] =
                await Promise.all([
                    api.groups.get(groupUuid),
                    api.members.list(groupUuid),
                    api.groups.invitations(groupUuid),
                    api.expenses.list(groupUuid),
                    api.expenses.balances(groupUuid),
                    api.expenses.settlements(groupUuid),
                    api.groups.currencies().then((res) => res.currencies),
                ]);
            if (group) {
                groupId = group.id; // Set the internal numeric ID
                expenseCurrency = group.baseCurrency || "EUR";
                settleCurrency = group.baseCurrency || "EUR";
                newBaseCurrency = group.baseCurrency || "EUR";
                editGroupName = group.name;
                editGroupDescription = group.description || "";
                editGroupCurrency = group.baseCurrency || "EUR";
            }
            // Set default paidBy to current user's member ID
            const currentUserMember = allMembers.find((m) => m.userId === $user?.id);
            if (currentUserMember && expensePaidBy === 0) {
                expensePaidBy = currentUserMember.id;
            }
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to load group data";
        } finally {
            loading = false;
        }
    }

    async function addExpense() {
        if (!expenseDescription || !expenseAmount || selectedMembers.length === 0) return;

        if (splitMode === "percent" && Math.abs(getPercentRemaining()) > 0.01) {
            error = "Percentages must add up to 100%";
            return;
        }

        try {
            const normalizedAmount = Number.parseFloat(expenseAmount);
            const customSharesArray = buildCustomSharesArray(normalizedAmount);

            await api.expenses.create({
                groupId,
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
            loadGroupData();
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to add expense";
        }
    }

    async function settleDebt() {
        if (!settleAmount || !settleFromMember || !settleToMember) return;

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
            showSettleDebt = false;
            loadGroupData();
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to settle debt";
        }
    }

    async function handleReceiptUpload(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            error = "Please upload an image file";
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            const imageData = e.target?.result as string;
            receiptImage = imageData;
            scanningReceipt = true;
            error = "";

            try {
                const result = await api.expenses.analyzeReceipt({
                    groupId,
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

                // Add uploaded attachments if any
                if (result.attachments && result.attachments.length > 0) {
                    expenseAttachments = result.attachments;
                }

                showScanReceipt = false;
                showAddExpense = true;
            } catch (e) {
                console.error(e);
                error = e instanceof Error ? e.message : "Failed to scan receipt";
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
                error = `File ${file.name} has unsupported type`;
                continue;
            }

            if (file.size > 10 * 1024 * 1024) {
                error = `File ${file.name} exceeds 10MB limit`;
                continue;
            }

            uploadingAttachment = true;

            try {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const fileData = e.target?.result as string;

                    try {
                        const result = await api.expenses.uploadAttachment({
                            groupId,
                            file: fileData,
                            filename: file.name,
                        });

                        expenseAttachments = [...expenseAttachments, result];
                    } catch (e) {
                        error = e instanceof Error ? e.message : "Failed to upload attachment";
                    } finally {
                        uploadingAttachment = false;
                    }
                };
                reader.readAsDataURL(file);
            } catch (e) {
                error = e instanceof Error ? e.message : "Failed to read file";
                uploadingAttachment = false;
            }
        }
    }

    function removeAttachment(index: number) {
        expenseAttachments = expenseAttachments.filter((_, i) => i !== index);
    }

    function handleImagePreview(attachment: { url: string; name: string; type: string }) {
        previewImageUrl = attachment.url;
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

    async function addGuestMember() {
        if (!newGuestMemberName) return;

        try {
            await api.members.create(groupUuid, {
                name: newGuestMemberName,
            });
            newGuestMemberName = "";
            showAddGuestMember = false;
            loadGroupData();
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to add guest member";
        }
    }

    async function inviteMember() {
        if (!inviteEmail) return;

        try {
            await api.groups.invite(groupUuid, inviteEmail);
            inviteEmail = "";
            showInviteMember = false;
            error = "";
            // Show success message
            const successMsg = error;
            error = "Invitation sent successfully!";
            setTimeout(() => {
                if (error === "Invitation sent successfully!") error = "";
            }, 3000);
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to send invitation";
        }
    }

    async function deleteGuestMember(memberId: number) {
        if (!confirm("Are you sure? This will remove all their expense shares and settlements.")) return;

        try {
            await api.members.delete(groupUuid, memberId);
            loadGroupData();
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to delete guest member";
        }
    }

    async function revokeInvitation(invitationId: number, type: string) {
        if (!confirm("Are you sure you want to revoke this invitation?")) return;

        try {
            await api.groups.revokeInvitation(groupUuid, invitationId, type);
            loadGroupData();
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to revoke invitation";
        }
    }

    async function updateBaseCurrency() {
        if (!newBaseCurrency) return;

        try {
            await api.groups.updateCurrency(groupUuid, newBaseCurrency);
            showChangeCurrency = false;
            loadGroupData();
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to update base currency";
        }
    }

    async function saveGroupSettings() {
        if (!editGroupName) {
            error = "Group name is required";
            return;
        }

        try {
            await api.groups.update(groupUuid, {
                name: editGroupName,
                description: editGroupDescription || undefined,
                baseCurrency: editGroupCurrency,
            });
            settingsSaved = true;
            setTimeout(() => {
                settingsSaved = false;
            }, 3000);
            loadGroupData();
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to update group settings";
        }
    }

    async function handleGroupImageChange(event: Event) {
        const input = event.currentTarget as HTMLInputElement;
        if (!input.files?.length || !group) return;

        uploadingGroupImage = true;
        error = "";

        try {
            const file = input.files[0];
            const base64 = await readAsDataUrl(file);
            const updated = await uploadGroupImage(group.uuid, base64, file.name);
            group = { ...group, imageUrl: updated.imageUrl };
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to upload group image";
        } finally {
            uploadingGroupImage = false;
            input.value = "";
        }
    }

    async function toggleArchive() {
        if (!group) return;

        const newArchivedState = !group.archived;
        const action = newArchivedState ? "archive" : "unarchive";

        if (
            !confirm(
                `Are you sure you want to ${action} this group? ${newArchivedState ? "Archived groups cannot have expenses added or debts settled until unarchived." : ""}`,
            )
        ) {
            return;
        }

        try {
            await api.groups.archive(groupUuid, newArchivedState);
            loadGroupData();
        } catch (e) {
            error = e instanceof Error ? e.message : `Failed to ${action} group`;
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
        if (!allMembers) return;
        selectedMembers = allMembers.map((m) => m.id);
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
        error = "";

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

    function formatDate(date: Date) {
        return new Date(date).toLocaleDateString();
    }

    function formatCurrency(amount: number) {
        return amount.toFixed(2);
    }

    function exportExpenses() {
        if (!groupUuid) return;
        window.location.href = `/api/expenses/group/${groupUuid}/export`;
    }

    function getMemberName(member: GroupMember) {
        if (member.user?.name) return member.user.name;
        if (member.name) return `${member.name} (guest)`;
        return "Unknown";
    }

    function getMemberAvatar(member: GroupMember) {
        const avatar = member.user?.avatarUrl;
        if (!avatar) return null;
        if (avatar.startsWith("http")) return avatar;
        return `/api/receipts/view/${encodeURIComponent(avatar)}`;
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

        // Check if shares are even
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

        // Load attachments
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

    function readAsDataUrl(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("Failed to read file"));
            reader.readAsDataURL(file);
        });
    }

    async function uploadGroupImage(groupUuid: string, file: string, filename: string) {
        const response = await fetch(`/api/groups/${groupUuid}/image`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ file, filename }),
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || "Failed to upload group image");
        }

        return response.json();
    }

    async function updateExpense() {
        if (!expenseDescription || !expenseAmount || selectedMembers.length === 0 || !editingExpenseId) return;

        if (splitMode === "percent" && Math.abs(getPercentRemaining()) > 0.01) {
            error = "Percentages must add up to 100%";
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
            loadGroupData();
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to update expense";
        }
    }

    async function deleteExpense(expenseId: number) {
        if (!confirm("Are you sure you want to delete this expense?")) return;

        try {
            await api.expenses.delete(expenseId);
            loadGroupData();
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to delete expense";
        }
    }

    function resetExpenseForm() {
        expenseDescription = "";
        expenseNote = "";
        expenseAmount = "";
        expenseDate = "";
        // Set default paidBy to current user's member ID
        const currentUserMember = allMembers.find((m) => m.userId === $user?.id);
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
    <title>{group?.name || "Group"} - Spendbee</title>
</svelte:head>

<div class="min-h-screen bg-dark-500 text-white">
    <div class="max-w-7xl mx-auto px-4 pb-12">
        <div class="flex min-h-screen gap-6">
            <LeftSidebar active="groups">
                {#if group}
                    <div>
                        <div class="text-xs uppercase tracking-[0.2em] text-gray-500">Current group</div>
                        <div class="mt-3 rounded-2xl border border-dark-100/70 bg-dark-300/50 p-4">
                            <div class="flex items-center gap-3">
                                {#if group.imageUrl}
                                    <img
                                        src={`/api/receipts/view/${encodeURIComponent(group.imageUrl)}`}
                                        alt="Group image"
                                        class="h-10 w-10 rounded-xl object-cover border border-dark-100"
                                    />
                                {:else}
                                    <div
                                        class="h-10 w-10 rounded-xl bg-primary text-dark flex items-center justify-center font-semibold"
                                    >
                                        {group.name?.slice(0, 1) || "G"}
                                    </div>
                                {/if}
                                <div>
                                    <div class="font-semibold text-white">{group.name}</div>
                                    <div class="text-xs text-gray-400">{allMembers.length} members</div>
                                </div>
                            </div>
                            <button
                                on:click={() => (showInviteMember = true)}
                                class="mt-4 w-full rounded-lg bg-primary text-dark py-2 text-sm font-semibold hover:bg-primary-400"
                            >
                                Invite friends
                            </button>
                        </div>
                    </div>
                {/if}
            </LeftSidebar>

            <main class="flex-1">
                <MobileNavbar backHref="/groups" backLabel="Back to groups" />
                <div class="pt-6">
                    <div class="hidden lg:flex items-center justify-between mb-6">
                        <a href="/groups" class="text-gray-400 hover:text-white flex items-center gap-2 text-sm">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                        <div
                            class="relative mb-6 rounded-3xl border border-dark-100/70 bg-dark-300/55 p-6 shadow-[0_0_30px_rgba(0,0,0,0.25)]"
                        >
                            <div class="flex flex-wrap items-start justify-between gap-6">
                                <div class="flex flex-col gap-4">
                                    <div class="flex items-center gap-4">
                                        {#if group.imageUrl}
                                            <img
                                                src={`/api/receipts/view/${encodeURIComponent(group.imageUrl)}`}
                                                alt="Group image"
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
                                                <h1 class="text-3xl font-bold text-white">{group.name}</h1>
                                                {#if group.archived}
                                                    <span
                                                        class="bg-dark-100 text-gray-300 px-3 py-1 rounded-full text-xs uppercase tracking-[0.2em]"
                                                    >
                                                        Archived
                                                    </span>
                                                {/if}
                                            </div>
                                            {#if group.description}
                                                <p class="text-gray-400 mt-1">{group.description}</p>
                                            {/if}
                                            <div class="mt-2 text-sm text-gray-500">
                                                {allMembers.length} members ({allMembers.filter(
                                                    (m) => m.userId === null,
                                                ).length} guests)
                                            </div>
                                        </div>
                                    </div>
                                    {#if activeTab === "expenses"}
                                        <div class="flex flex-wrap gap-2">
                                            <button
                                                on:click={() => (showAddExpense = true)}
                                                disabled={group.archived}
                                                class="rounded-xl bg-primary text-dark px-5 py-2.5 text-sm font-semibold hover:bg-primary-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Add expense
                                            </button>
                                            <button
                                                on:click={() => (showScanReceipt = true)}
                                                disabled={group.archived}
                                                class="rounded-xl border border-dark-100 bg-dark-200/80 px-5 py-2.5 text-sm font-semibold text-white hover:bg-dark-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Scan receipt
                                            </button>
                                            <button
                                                on:click={exportExpenses}
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
                                            </button>
                                        </div>
                                    {:else if activeTab === "balances" || activeTab === "settlements"}
                                        <div class="flex flex-wrap gap-2">
                                            <button
                                                on:click={() => (showSettleDebt = true)}
                                                disabled={group.archived}
                                                class="rounded-xl bg-primary text-dark px-5 py-2.5 text-sm font-semibold hover:bg-primary-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Settle up
                                            </button>
                                        </div>
                                    {/if}
                                </div>
                            </div>
                            <div class="absolute right-4 top-4 flex flex-col gap-2">
                                {#if group.createdBy === $user?.id}
                                    <button
                                        on:click={() => (activeTab = "settings")}
                                        class="h-10 w-10 rounded-full border border-dark-100 bg-dark-200/80 text-gray-200 hover:bg-dark-100 hover:text-white transition"
                                        title="Settings"
                                        aria-label="Group settings"
                                    >
                                        <svg
                                            class="w-5 h-5 mx-auto"
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
                                    </button>
                                {/if}
                                <button
                                    on:click={() => (activeTab = "members")}
                                    class="h-10 w-10 rounded-full border border-dark-100 bg-dark-200/80 text-gray-200 hover:bg-dark-100 hover:text-white transition"
                                    title="Members"
                                    aria-label="Group members"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 mx-auto" viewBox="0 0 24 24"
                                        >><path
                                            fill="currentColor"
                                            d="M16.5 13c-1.2 0-3.07.34-4.5 1c-1.43-.67-3.3-1-4.5-1C5.33 13 1 14.08 1 16.25V19h22v-2.75c0-2.17-4.33-3.25-6.5-3.25m-4 4.5h-10v-1.25c0-.54 2.56-1.75 5-1.75s5 1.21 5 1.75zm9 0H14v-1.25c0-.46-.2-.86-.52-1.22c.88-.3 1.96-.53 3.02-.53c2.44 0 5 1.21 5 1.75zM7.5 12c1.93 0 3.5-1.57 3.5-3.5S9.43 5 7.5 5S4 6.57 4 8.5S5.57 12 7.5 12m0-5.5c1.1 0 2 .9 2 2s-.9 2-2 2s-2-.9-2-2s.9-2 2-2m9 5.5c1.93 0 3.5-1.57 3.5-3.5S18.43 5 16.5 5S13 6.57 13 8.5s1.57 3.5 3.5 3.5m0-5.5c1.1 0 2 .9 2 2s-.9 2-2 2s-2-.9-2-2s.9-2 2-2"
                                        /></svg
                                    >
                                </button>
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

                        {#if error}
                            <div class="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded mb-4">
                                {error}
                            </div>
                        {/if}

                        <div class="flex flex-wrap gap-2 mb-6">
                            <button
                                on:click={() => (activeTab = "expenses")}
                                class="px-5 py-2 rounded-full text-sm font-medium transition {activeTab === 'expenses'
                                    ? 'bg-primary text-dark'
                                    : 'bg-dark-200 text-gray-300 hover:text-white'}"
                            >
                                Expenses
                            </button>
                            <button
                                on:click={() => (activeTab = "balances")}
                                class="px-5 py-2 rounded-full text-sm font-medium transition {activeTab === 'balances'
                                    ? 'bg-primary text-dark'
                                    : 'bg-dark-200 text-gray-300 hover:text-white'}"
                            >
                                Balances
                            </button>
                            <button
                                on:click={() => (activeTab = "settlements")}
                                class="px-5 py-2 rounded-full text-sm font-medium transition {activeTab ===
                                'settlements'
                                    ? 'bg-primary text-dark'
                                    : 'bg-dark-200 text-gray-300 hover:text-white'}"
                            >
                                Settlements
                            </button>
                        </div>

                        {#if activeTab === "expenses"}
                            {#if expenses.length === 0}
                                <div class="text-center py-16 bg-dark-300 rounded-2xl border border-dark-100">
                                    <p class="text-gray-400">No expenses yet.</p>
                                </div>
                            {:else}
                                <div class="space-y-3">
                                    {#each expenses as expense}
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
                                                                ><path
                                                                    fill="currentColor"
                                                                    d="M17 2a3 3 0 0 1 3 3v16a1 1 0 0 1-1.555.832l-2.318-1.545l-1.42 1.42a1 1 0 0 1-1.32.083l-.094-.083L12 20.415l-1.293 1.292a1 1 0 0 1-1.32.083l-.094-.083l-1.421-1.42l-2.317 1.545l-.019.012l-.054.03l-.028.017l-.054.023l-.05.023l-.049.015l-.06.019l-.052.009l-.057.011l-.084.006l-.026.003H5l-.049-.003h-.039l-.013-.003h-.016l-.041-.008l-.038-.005l-.015-.005l-.018-.002l-.034-.011l-.04-.01l-.019-.007l-.015-.004l-.029-.013l-.04-.015l-.021-.011l-.013-.005l-.028-.016l-.036-.018l-.014-.01l-.018-.01l-.038-.027l-.022-.014l-.01-.009l-.02-.014l-.045-.041l-.012-.008l-.024-.024l-.035-.039l-.02-.02l-.007-.011l-.011-.012l-.032-.045l-.02-.025l-.012-.019l-.03-.054l-.017-.028l-.023-.054l-.023-.05a1 1 0 0 1-.034-.108l-.01-.057l-.01-.053L4 21V5a3 3 0 0 1 3-3zm-5 3a1 1 0 0 0-1 1a3 3 0 1 0 0 6v2c-.403.013-.75-.18-.934-.5a1 1 0 0 0-1.732 1a3 3 0 0 0 2.505 1.5l.161-.001A1 1 0 1 0 13 16l.176-.005A3 3 0 0 0 13 10V8c.403-.013.75.18.934.5a1 1 0 0 0 1.732-1A3 3 0 0 0 13.161 6H13a1 1 0 0 0-1-1m1 7a1 1 0 0 1 0 2zm-2-4v2a1 1 0 0 1 0-2"
                                                                /></svg
                                                            >
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
                                                        <p class="text-sm text-gray-400 mt-2">{expense.note}</p>
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
                                                        <div class="text-xs text-gray-500 mb-2">Attachments</div>
                                                        {#if expense.attachments}
                                                            {@const parsedAttachments = JSON.parse(expense.attachments)}
                                                            <AttachmentPreview
                                                                attachments={parsedAttachments}
                                                                onImageClick={handleImagePreview}
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
                                                                onImageClick={handleImagePreview}
                                                            />
                                                        {/if}
                                                    </div>
                                                {:else}
                                                    <div class="flex-1"></div>
                                                {/if}
                                                <div class="flex gap-2">
                                                    <button
                                                        on:click={() => startEditExpense(expense)}
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
                                                        on:click={() => deleteExpense(expense.id)}
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
                        {/if}

                        {#if activeTab === "balances"}
                            <div class="space-y-3">
                                {#each balances as balance}
                                    <div class="bg-dark-300/70 p-4 rounded-2xl border border-dark-100/70">
                                        <div class="flex items-start gap-4 mb-2">
                                            <div class="flex items-center gap-3 flex-1 min-w-0">
                                                {#if balance.avatarUrl}
                                                    <img
                                                        src={`/api/receipts/view/${encodeURIComponent(
                                                            balance.avatarUrl,
                                                        )}`}
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
                                                    <div class="font-semibold text-white">{balance.memberName}</div>
                                                    {#if balance.isGuest}
                                                        <div class="text-xs text-gray-500 mb-2">Guest member</div>
                                                    {/if}

                                                    {#if balance.balanceByCurrency && balance.balanceByCurrency.length > 0}
                                                        <div class="mt-2 space-y-1">
                                                            {#each balance.balanceByCurrency as currBal}
                                                                <div
                                                                    class="text-sm font-medium {currBal.amount > 0
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
                                                                    Total in {group?.baseCurrency || "EUR"}: {balance.balance >
                                                                    0
                                                                        ? "+"
                                                                        : ""}{formatCurrency(Math.abs(balance.balance))}
                                                                </div>
                                                            {/if}
                                                        </div>
                                                    {/if}
                                                </div>
                                            </div>
                                            <div class="text-right shrink-0">
                                                <div
                                                    class="text-xl font-bold {balance.balance > 0
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
                        {/if}

                        {#if activeTab === "settlements"}
                            {#if settlements.length === 0}
                                <div class="text-center py-12 bg-dark-300 rounded-2xl">
                                    <p class="text-gray-400">No settlements recorded yet.</p>
                                </div>
                            {:else}
                                <div class="space-y-3">
                                    {#each settlements as settlement}
                                        <div class="bg-dark-300/70 p-4 rounded-2xl border border-dark-100/70">
                                            <div class="flex justify-between items-start">
                                                <div>
                                                    <div class="text-white">
                                                        <span class="font-semibold"
                                                            >{getMemberName(settlement.fromMember)}</span
                                                        >
                                                        <span class="text-gray-400"> paid </span>
                                                        <span class="font-semibold"
                                                            >{getMemberName(settlement.toMember)}</span
                                                        >
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
                        {/if}

                        {#if activeTab === "members"}
                            <div class="mb-4 flex flex-wrap gap-2">
                                <button
                                    on:click={() => (showInviteMember = true)}
                                    class="flex-1 bg-primary text-dark py-3 px-6 rounded-xl font-semibold hover:bg-primary-400 transition"
                                >
                                    Invite Member
                                </button>
                                <button
                                    on:click={() => (showAddGuestMember = true)}
                                    class="flex-1 bg-dark-200 text-white py-3 px-6 rounded-xl font-semibold hover:bg-dark-100 transition border border-primary"
                                >
                                    Add Guest Member
                                </button>
                            </div>

                            <div class="space-y-4">
                                {#if pendingInvitations.length > 0}
                                    <div>
                                        <h3 class="text-lg font-semibold text-white mb-3">Pending Invitations</h3>
                                        <div class="space-y-2">
                                            {#each pendingInvitations as invitation}
                                                <div class="bg-dark-300/70 p-4 rounded-2xl border border-dark-100/70">
                                                    <div class="flex justify-between items-center">
                                                        <div>
                                                            <div class="font-semibold text-white">
                                                                {invitation.email}
                                                            </div>
                                                            <div class="text-sm text-gray-400">
                                                                Invited by {invitation.invitedBy.name}
                                                                {#if invitation.type === "token"}
                                                                    • New user
                                                                {:else}
                                                                    • Existing user
                                                                {/if}
                                                            </div>
                                                            <div class="text-xs text-gray-500 mt-1">
                                                                {formatDate(invitation.createdAt)}
                                                            </div>
                                                        </div>
                                                        <button
                                                            on:click={() =>
                                                                revokeInvitation(invitation.id, invitation.type)}
                                                            class="text-red-400 hover:text-red-300 text-sm"
                                                        >
                                                            Revoke
                                                        </button>
                                                    </div>
                                                </div>
                                            {/each}
                                        </div>
                                    </div>
                                {/if}

                                <div>
                                    <h3 class="text-lg font-semibold text-white mb-3">All Members</h3>
                                    <div class="space-y-2">
                                        {#each allMembers as member}
                                            <div class="bg-dark-300/70 p-4 rounded-2xl border border-dark-100/70">
                                                <div class="flex justify-between items-center">
                                                    <div class="flex items-center gap-3">
                                                        {#if getMemberAvatar(member)}
                                                            <img
                                                                src={getMemberAvatar(member)}
                                                                alt="Member avatar"
                                                                class="h-11 w-11 rounded-2xl object-cover border border-dark-100"
                                                            />
                                                        {:else}
                                                            <div
                                                                class="h-11 w-11 rounded-2xl bg-dark-200 text-primary flex items-center justify-center text-sm font-semibold"
                                                            >
                                                                {getMemberName(member).slice(0, 1).toUpperCase()}
                                                            </div>
                                                        {/if}
                                                        <div>
                                                            <div class="font-semibold text-white">
                                                                {getMemberName(member)}
                                                            </div>
                                                            {#if member.user}
                                                                <div class="text-sm text-gray-400">
                                                                    {member.user.email}
                                                                </div>
                                                            {:else}
                                                                <div class="text-sm text-gray-400">Guest user</div>
                                                            {/if}
                                                        </div>
                                                    </div>
                                                    {#if member.userId !== null}
                                                        <div class="text-xs text-primary">Registered</div>
                                                    {:else}
                                                        <button
                                                            on:click={() => deleteGuestMember(member.id)}
                                                            class="text-red-400 hover:text-red-300 text-sm"
                                                        >
                                                            Remove
                                                        </button>
                                                    {/if}
                                                </div>
                                            </div>
                                        {/each}
                                    </div>
                                </div>
                            </div>
                        {/if}

                        {#if activeTab === "settings"}
                            {#if group.createdBy === $user?.id}
                                <div class="bg-dark-300 p-6 rounded-2xl border border-dark-100">
                                    <div class="flex flex-wrap gap-6 items-start">
                                        {#if group.imageUrl}
                                            <img
                                                src={`/api/receipts/view/${encodeURIComponent(group.imageUrl)}`}
                                                alt="Group image"
                                                class="w-28 h-28 rounded-3xl object-cover border border-dark-100"
                                            />
                                        {:else}
                                            <div
                                                class="w-28 h-28 rounded-3xl bg-gradient-to-br from-primary/80 to-primary-600 flex items-center justify-center text-4xl font-bold text-dark"
                                            >
                                                {group.name?.slice(0, 1) || "G"}
                                            </div>
                                        {/if}
                                        <div class="flex-1 min-w-[220px]">
                                            <h3 class="text-2xl font-bold text-white mb-2">Group Settings</h3>
                                            <p class="text-sm text-gray-400">Manage your group details and members.</p>
                                        </div>
                                    </div>

                                    {#if settingsSaved}
                                        <div
                                            class="bg-green-900/50 border border-green-500 text-green-200 p-3 rounded mb-4 mt-4"
                                        >
                                            Settings saved successfully!
                                        </div>
                                    {/if}

                                    <form on:submit|preventDefault={saveGroupSettings} class="space-y-6 mt-6">
                                        <div>
                                            <label class="block text-sm font-medium text-gray-300 mb-2">
                                                Group Image
                                            </label>
                                            <div class="flex flex-wrap items-center gap-4">
                                                {#if group.imageUrl}
                                                    <img
                                                        src={`/api/receipts/view/${encodeURIComponent(group.imageUrl)}`}
                                                        alt="Group image"
                                                        class="h-16 w-16 rounded-2xl object-cover border border-dark-100"
                                                    />
                                                {:else}
                                                    <div
                                                        class="h-16 w-16 rounded-2xl bg-dark-200 text-primary flex items-center justify-center font-semibold"
                                                    >
                                                        {group.name?.slice(0, 1) || "G"}
                                                    </div>
                                                {/if}
                                                <label
                                                    class="inline-flex items-center gap-2 rounded-lg border border-dark-100 bg-dark-200/70 px-4 py-2 text-sm text-gray-200 hover:bg-dark-100 cursor-pointer"
                                                >
                                                    {uploadingGroupImage ? "Uploading..." : "Upload image"}
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        class="hidden"
                                                        disabled={uploadingGroupImage}
                                                        on:change={handleGroupImageChange}
                                                    />
                                                </label>
                                                <div class="text-xs text-gray-500">
                                                    JPG, PNG, GIF, or WebP. Max 8MB.
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label
                                                for="settingsGroupName"
                                                class="block text-sm font-medium text-gray-300 mb-2"
                                            >
                                                Group Name
                                            </label>
                                            <input
                                                type="text"
                                                id="settingsGroupName"
                                                bind:value={editGroupName}
                                                required
                                                class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
                                                placeholder="e.g., Roommates, Trip to Paris"
                                            />
                                        </div>

                                        <div>
                                            <label
                                                for="settingsGroupDescription"
                                                class="block text-sm font-medium text-gray-300 mb-2"
                                            >
                                                Description
                                            </label>
                                            <textarea
                                                id="settingsGroupDescription"
                                                bind:value={editGroupDescription}
                                                rows="3"
                                                class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
                                                placeholder="What is this group for?"
                                            ></textarea>
                                        </div>

                                        <div>
                                            <label
                                                for="settingsBaseCurrency"
                                                class="block text-sm font-medium text-gray-300 mb-2"
                                            >
                                                Base Currency
                                            </label>
                                            <select
                                                id="settingsBaseCurrency"
                                                bind:value={editGroupCurrency}
                                                class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
                                            >
                                                {#each supportedCurrencies as curr}
                                                    <option value={curr}>{curr}</option>
                                                {/each}
                                            </select>
                                            <p class="text-xs text-gray-400 mt-1">
                                                The base currency is used to display total balances when multiple
                                                currencies are used.
                                            </p>
                                        </div>

                                        <button
                                            type="submit"
                                            class="w-full bg-primary text-dark py-3 px-6 rounded-lg font-semibold hover:bg-primary-400 transition"
                                        >
                                            Save Settings
                                        </button>
                                    </form>

                                    <div class="mt-6 pt-6 border-t border-dark-100">
                                        <h4 class="text-lg font-semibold text-white mb-3">Archive Group</h4>
                                        <p class="text-sm text-gray-400 mb-4">
                                            {#if group.archived}
                                                This group is currently archived. Unarchive it to add expenses or settle
                                                debts.
                                            {:else}
                                                Archive this group to hide it from your groups list. You can unarchive
                                                it later if needed.
                                            {/if}
                                        </p>
                                        <button
                                            type="button"
                                            on:click={toggleArchive}
                                            class="w-full {group.archived
                                                ? 'bg-primary text-dark'
                                                : 'bg-dark-200 text-white'} py-3 px-6 rounded-lg font-semibold hover:opacity-80 transition"
                                        >
                                            {group.archived ? "Unarchive Group" : "Archive Group"}
                                        </button>
                                    </div>
                                </div>
                            {:else}
                                <div class="text-center py-12 bg-dark-300 rounded-2xl">
                                    <p class="text-gray-400">Only the group creator can modify settings.</p>
                                </div>
                            {/if}
                        {/if}
                    {/if}
                </div>
            </main>

            <RightSidebar>
                <div class="rounded-2xl border border-dark-100/70 bg-dark-300/50 p-4">
                    <div class="text-xs uppercase tracking-[0.2em] text-gray-500">Group balances</div>
                    {#if balances.length === 0}
                        <div class="mt-3 text-sm text-gray-400">No balances yet.</div>
                    {:else}
                        <div class="mt-4 space-y-3">
                            {#each balances.slice(0, 4) as balance}
                                <div class="flex items-center justify-between">
                                    <div>
                                        <div class="text-sm font-semibold text-white">{balance.memberName}</div>
                                        <div class="text-xs text-gray-500">{group?.baseCurrency || "EUR"}</div>
                                    </div>
                                    <div
                                        class="text-sm font-semibold {balance.balance > 0
                                            ? 'text-green-400'
                                            : balance.balance < 0
                                              ? 'text-red-400'
                                              : 'text-gray-400'}"
                                    >
                                        {balance.balance > 0 ? "+" : balance.balance < 0 ? "-" : ""}{formatCurrency(
                                            Math.abs(balance.balance),
                                        )}
                                    </div>
                                </div>
                            {/each}
                        </div>
                        <button
                            on:click={() => (activeTab = "balances")}
                            class="mt-4 w-full rounded-lg border border-dark-100/70 px-3 py-2 text-sm text-gray-200 hover:bg-dark-200/70"
                        >
                            View details
                        </button>
                    {/if}
                </div>

                <div class="mt-6 rounded-2xl border border-dark-100/70 bg-dark-300/50 p-4">
                    <div class="text-xs uppercase tracking-[0.2em] text-gray-500">Recent activity</div>
                    <div class="mt-4 space-y-3">
                        {#each expenses.slice(0, 4) as expense}
                            <div class="flex items-center gap-3">
                                <div
                                    class="h-9 w-9 rounded-xl bg-dark-200 flex items-center justify-center text-sm font-semibold text-primary"
                                >
                                    {expense.description.slice(0, 1).toUpperCase()}
                                </div>
                                <div class="flex-1">
                                    <div class="text-sm text-white">{expense.description}</div>
                                    <div class="text-xs text-gray-500">{formatDate(expense.createdAt)}</div>
                                </div>
                                <div class="text-sm font-semibold text-primary">
                                    {formatCurrency(expense.amount)}
                                </div>
                            </div>
                        {/each}
                        {#if expenses.length === 0}
                            <div class="text-sm text-gray-400">Activity feed coming soon.</div>
                        {/if}
                    </div>
                </div>

                <div class="mt-6 rounded-2xl border border-dark-100/70 bg-dark-300/50 p-4">
                    <div class="text-xs uppercase tracking-[0.2em] text-gray-500">Group settings</div>
                    <div class="mt-4 space-y-2">
                        <button
                            on:click={() => (activeTab = "settings")}
                            class="w-full rounded-lg border border-dark-100/70 px-3 py-2 text-sm text-gray-200 hover:bg-dark-200/70"
                        >
                            Edit group settings
                        </button>
                        <button
                            on:click={exportExpenses}
                            class="w-full rounded-lg border border-dark-100/70 px-3 py-2 text-sm text-gray-200 hover:bg-dark-200/70"
                        >
                            Export as spreadsheet
                        </button>
                    </div>
                </div>
            </RightSidebar>
        </div>
    </div>
</div>

{#if showAddExpense && group}
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
                        on:click={() => setSplitMode("amounts")}
                        class="rounded-full px-4 py-1.5 text-xs font-semibold transition {splitMode === 'amounts'
                            ? 'bg-primary text-dark'
                            : 'bg-dark-200 text-gray-300 hover:text-white'}"
                    >
                        Amounts
                    </button>
                    <button
                        type="button"
                        on:click={() => setSplitMode("percent")}
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
            <form on:submit|preventDefault={addExpense} class="space-y-4">
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
                            <span class="text-sm text-gray-400">{expenseCurrency}</span>
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
                            {#each supportedCurrencies as curr}
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
                        {#each allMembers as member}
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
                <!-- Attachments Section -->
                <div>
                    <div class="flex justify-between items-center mb-2">
                        <label class="block text-sm font-medium text-gray-300">
                            Attachments ({expenseAttachments.length}/5)
                        </label>
                        {#if expenseAttachments.length < 5}
                            <label class="text-xs text-primary hover:text-primary-400 cursor-pointer">
                                + Add File
                                <input
                                    type="file"
                                    multiple
                                    accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.csv,.xlsx,.xls,.doc,.docx"
                                    on:change={handleAttachmentUpload}
                                    class="hidden"
                                />
                            </label>
                        {/if}
                    </div>
                    {#if expenseAttachments.length > 0}
                        <AttachmentPreview
                            attachments={expenseAttachments}
                            onRemove={removeAttachment}
                            onImageClick={handleImagePreview}
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
                                on:click={addReceiptItem}
                                class="text-xs text-primary hover:text-primary-400"
                            >
                                + Add Item
                            </button>
                        </div>
                        <!-- Column Headers - Hidden on mobile -->
                        <div class="hidden md:flex gap-2 mb-2 px-3 py-2 bg-dark-300 rounded-lg">
                            <div class="flex-1 text-xs font-medium text-gray-400">Name</div>
                            <div class="w-16 text-xs font-medium text-gray-400 text-center">Qty</div>
                            <div class="w-20 text-xs font-medium text-gray-400 text-center">Price</div>
                            <div class="w-6"></div>
                        </div>
                        <div class="space-y-3 max-h-64 overflow-y-auto">
                            {#each receiptItems as item, index}
                                <div class="bg-dark-200 p-3 rounded-lg">
                                    <!-- Mobile Layout: Stacked -->
                                    <div class="md:hidden space-y-2">
                                        <div class="flex items-center justify-between mb-2">
                                            <span class="text-xs text-gray-400">Item {index + 1}</span>
                                            <button
                                                type="button"
                                                on:click={() => deleteReceiptItem(index)}
                                                class="text-red-400 hover:text-red-300 text-xs w-6 h-6 flex items-center justify-center"
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
                                            <label class="text-xs text-gray-400 block mb-1">Name</label>
                                            <input
                                                type="text"
                                                bind:value={item.description}
                                                on:input={updateTotalFromItems}
                                                placeholder="Item name"
                                                class="w-full px-2 py-1.5 text-sm bg-dark-300 border border-dark-100 rounded text-white focus:outline-none focus:border-primary"
                                            />
                                        </div>
                                        <div class="grid grid-cols-2 gap-2">
                                            <div>
                                                <label class="text-xs text-gray-400 block mb-1">Qty</label>
                                                <input
                                                    type="number"
                                                    bind:value={item.quantity}
                                                    on:input={updateTotalFromItems}
                                                    min="1"
                                                    placeholder="1"
                                                    class="w-full px-2 py-1.5 text-sm bg-dark-300 border border-dark-100 rounded text-white focus:outline-none focus:border-primary"
                                                />
                                            </div>
                                            <div>
                                                <label class="text-xs text-gray-400 block mb-1">Price</label>
                                                <input
                                                    type="number"
                                                    bind:value={item.price}
                                                    on:input={updateTotalFromItems}
                                                    step="0.01"
                                                    min="0"
                                                    placeholder="0.00"
                                                    class="w-full px-2 py-1.5 text-sm bg-dark-300 border border-dark-100 rounded text-white focus:outline-none focus:border-primary"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Desktop Layout: Row -->
                                    <div class="hidden md:flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            bind:value={item.description}
                                            on:input={updateTotalFromItems}
                                            placeholder="Item description"
                                            class="flex-1 px-2 py-1 text-sm bg-dark-300 border border-dark-100 rounded text-white focus:outline-none focus:border-primary"
                                        />
                                        <input
                                            type="number"
                                            bind:value={item.quantity}
                                            on:input={updateTotalFromItems}
                                            min="1"
                                            placeholder="Qty"
                                            class="w-16 px-2 py-1 text-sm bg-dark-300 border border-dark-100 rounded text-white focus:outline-none focus:border-primary"
                                        />
                                        <input
                                            type="number"
                                            bind:value={item.price}
                                            on:input={updateTotalFromItems}
                                            step="0.01"
                                            min="0"
                                            placeholder="Price"
                                            class="w-20 px-2 py-1 text-sm bg-dark-300 border border-dark-100 rounded text-white focus:outline-none focus:border-primary"
                                        />
                                        <button
                                            type="button"
                                            on:click={() => deleteReceiptItem(index)}
                                            class="text-red-400 hover:text-red-300 text-xs"
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
                                        <span class="text-xs text-gray-400">Assign to:</span>
                                        {#each allMembers as member}
                                            <label class="flex items-center gap-1">
                                                <input
                                                    type="checkbox"
                                                    checked={item.assignedTo.includes(member.id)}
                                                    on:change={() => toggleItemAssignment(index, member.id)}
                                                    class="w-3 h-3 text-primary bg-dark border-dark-100 rounded"
                                                />
                                                <span class="text-xs text-gray-300">{getMemberName(member)}</span>
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
                        <label class="block text-sm font-medium text-gray-300">Split with</label>
                        <button
                            type="button"
                            on:click={selectAllMembers}
                            class="text-xs text-primary hover:text-primary-400"
                        >
                            Select All
                        </button>
                    </div>
                    <div class="grid gap-2 sm:grid-cols-2 max-h-48 overflow-y-auto">
                        {#each allMembers as member}
                            <label
                                class="flex items-center space-x-2 p-2 bg-dark-200 rounded-lg cursor-pointer border border-dark-100 hover:border-primary/50 transition"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedMembers.includes(member.id)}
                                    on:change={() => toggleMember(member.id)}
                                    class="w-4 h-4 text-primary bg-dark border-dark-100 rounded focus:ring-primary"
                                />
                                <span class="text-white">{getMemberName(member)}</span>
                            </label>
                        {/each}
                    </div>
                    {#if selectedMembers.length > 0}
                        <div class="mt-3 p-3 bg-dark-200 rounded-lg">
                            {#if splitMode === "percent"}
                                <div class="space-y-2 mb-2">
                                    <div class="flex justify-between items-center">
                                        <span class="text-xs font-medium text-gray-300">Custom percentages</span>
                                        <button
                                            type="button"
                                            on:click={distributePercentEvenly}
                                            class="text-xs text-primary hover:text-primary-400"
                                        >
                                            Auto-fill evenly
                                        </button>
                                    </div>
                                    {#each selectedMembers as memberId}
                                        {@const member = allMembers.find((m) => m.id === memberId)}
                                        {#if member}
                                            {@const total = Number.parseFloat(expenseAmount || "0")}
                                            {@const percent = Number.parseFloat(percentShares[memberId] || "0")}
                                            <div class="flex items-center space-x-2">
                                                <span class="text-xs text-gray-400 flex-1">{getMemberName(member)}</span>
                                                <span class="text-[11px] text-gray-500">
                                                    {formatCurrency((total * percent) / 100)} {expenseCurrency}
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
                                        <span>{getPercentRemaining().toFixed(2)}%</span>
                                    </div>
                                </div>
                            {:else}
                                <label class="flex items-center space-x-2 mb-3">
                                    <input
                                        type="checkbox"
                                        bind:checked={splitEvenly}
                                        class="w-4 h-4 text-primary bg-dark border-dark-100 rounded focus:ring-primary"
                                    />
                                    <span class="text-sm text-gray-300">Split evenly</span>
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
                                            <span class="text-xs font-medium text-gray-300">Custom amounts</span>
                                            <button
                                                type="button"
                                                on:click={distributeEvenly}
                                                class="text-xs text-primary hover:text-primary-400"
                                            >
                                                Auto-fill evenly
                                            </button>
                                        </div>
                                        {#each selectedMembers as memberId}
                                            {@const member = allMembers.find((m) => m.id === memberId)}
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
                                            <span>{formatCurrency(getCustomSharesTotal())} {expenseCurrency}</span>
                                        </div>
                                        <div
                                            class="flex justify-between {Math.abs(getCustomSharesRemaining()) < 0.01
                                                ? 'text-green-400'
                                                : 'text-red-400'}"
                                        >
                                            <span>Remaining:</span>
                                            <span>{formatCurrency(getCustomSharesRemaining())} {expenseCurrency}</span>
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
                        Add
                    </button>
                    <button
                        type="button"
                        on:click={() => (showAddExpense = false)}
                        class="flex-1 bg-dark-200 text-white py-2.5 px-4 rounded-xl font-semibold hover:bg-dark-100 transition"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}

{#if showSettleDebt && group}
    <div class="fixed inset-0 bg-black/80 flex items-end md:items-center justify-center p-4 z-50">
        <div
            class="bg-dark-300 p-6 rounded-t-3xl md:rounded-2xl max-w-md w-full border border-dark-100 shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
        >
            <div class="flex items-center justify-between mb-4">
                <div>
                    <div class="text-xs uppercase tracking-[0.3em] text-gray-500">Settlement</div>
                    <h3 class="text-2xl font-bold text-white">Settle Debt</h3>
                </div>
                <div
                    class="h-10 w-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-semibold"
                >
                    OK
                </div>
            </div>
            <form on:submit|preventDefault={settleDebt} class="space-y-4">
                <div>
                    <label for="fromMember" class="block text-sm font-medium text-gray-300 mb-2">
                        From (who paid)
                    </label>
                    <select
                        id="fromMember"
                        bind:value={settleFromMember}
                        required
                        class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
                    >
                        <option value={0}>Select person</option>
                        {#each allMembers as member}
                            <option value={member.id}>{getMemberName(member)}</option>
                        {/each}
                    </select>
                </div>
                <div>
                    <label for="toMember" class="block text-sm font-medium text-gray-300 mb-2">
                        To (who received)
                    </label>
                    <select
                        id="toMember"
                        bind:value={settleToMember}
                        required
                        class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
                    >
                        <option value={0}>Select person</option>
                        {#each allMembers as member}
                            <option value={member.id}>{getMemberName(member)}</option>
                        {/each}
                    </select>
                </div>
                <div>
                    <label for="settleAmount" class="block text-sm font-medium text-gray-300 mb-2"> Amount </label>
                    <div class="flex items-center gap-2 rounded-lg border border-dark-100 bg-dark-200 px-3 py-2">
                        <span class="text-sm text-gray-400">{settleCurrency}</span>
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
                    <label for="settleCurrency" class="block text-sm font-medium text-gray-300 mb-2"> Currency </label>
                    <select
                        id="settleCurrency"
                        bind:value={settleCurrency}
                        class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
                    >
                        {#each supportedCurrencies as curr}
                            <option value={curr}>{curr}</option>
                        {/each}
                    </select>
                </div>
                <div class="flex gap-2">
                    <button
                        type="submit"
                        class="flex-1 bg-primary text-dark py-2.5 px-4 rounded-xl font-semibold hover:bg-primary-400 transition"
                    >
                        Settle
                    </button>
                    <button
                        type="button"
                        on:click={() => (showSettleDebt = false)}
                        class="flex-1 bg-dark-200 text-white py-2.5 px-4 rounded-xl font-semibold hover:bg-dark-100 transition"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}

{#if showAddGuestMember && group}
    <div class="fixed inset-0 bg-black/80 flex items-end md:items-center justify-center p-4 z-50">
        <div
            class="bg-dark-300 p-6 rounded-t-3xl md:rounded-2xl max-w-md w-full border border-dark-100 shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
        >
            <div class="flex items-center justify-between mb-4">
                <div>
                    <div class="text-xs uppercase tracking-[0.3em] text-gray-500">Guest</div>
                    <h3 class="text-2xl font-bold text-white">Add Guest Member</h3>
                </div>
                <div
                    class="h-10 w-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-semibold"
                >
                    +
                </div>
            </div>
            <p class="text-sm text-gray-400 mb-4">
                Guest members don't need an account. Perfect for visitors or people who don't want to register.
            </p>
            <form on:submit|preventDefault={addGuestMember} class="space-y-4">
                <div>
                    <label for="guestMemberName" class="block text-sm font-medium text-gray-300 mb-2"> Name </label>
                    <input
                        type="text"
                        id="guestMemberName"
                        bind:value={newGuestMemberName}
                        required
                        class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
                        placeholder="e.g., John (visiting)"
                    />
                </div>
                <div class="flex gap-2">
                    <button
                        type="submit"
                        class="flex-1 bg-primary text-dark py-2.5 px-4 rounded-xl font-semibold hover:bg-primary-400 transition"
                    >
                        Add
                    </button>
                    <button
                        type="button"
                        on:click={() => (showAddGuestMember = false)}
                        class="flex-1 bg-dark-200 text-white py-2.5 px-4 rounded-xl font-semibold hover:bg-dark-100 transition"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}

{#if showChangeCurrency && group}
    <div class="fixed inset-0 bg-black/80 flex items-end md:items-center justify-center p-4 z-50">
        <div
            class="bg-dark-300 p-6 rounded-t-3xl md:rounded-2xl max-w-md w-full border border-dark-100 shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
        >
            <div class="flex items-center justify-between mb-4">
                <div>
                    <div class="text-xs uppercase tracking-[0.3em] text-gray-500">Currency</div>
                    <h3 class="text-2xl font-bold text-white">Change Base Currency</h3>
                </div>
                <div
                    class="h-10 w-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-semibold"
                >
                    FX
                </div>
            </div>
            <p class="text-sm text-gray-400 mb-4">
                The base currency is used to display total balances when multiple currencies are used in the group.
            </p>
            <form on:submit|preventDefault={updateBaseCurrency} class="space-y-4">
                <div>
                    <label for="baseCurrency" class="block text-sm font-medium text-gray-300 mb-2">
                        Base Currency
                    </label>
                    <select
                        id="baseCurrency"
                        bind:value={newBaseCurrency}
                        class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
                    >
                        {#each supportedCurrencies as curr}
                            <option value={curr}>{curr}</option>
                        {/each}
                    </select>
                </div>
                <div class="flex gap-2">
                    <button
                        type="submit"
                        class="flex-1 bg-primary text-dark py-2.5 px-4 rounded-xl font-semibold hover:bg-primary-400 transition"
                    >
                        Update
                    </button>
                    <button
                        type="button"
                        on:click={() => (showChangeCurrency = false)}
                        class="flex-1 bg-dark-200 text-white py-2.5 px-4 rounded-xl font-semibold hover:bg-dark-100 transition"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}

{#if showInviteMember && group}
    <div class="fixed inset-0 bg-black/80 flex items-end md:items-center justify-center p-4 z-50">
        <div
            class="bg-dark-300 p-6 rounded-t-3xl md:rounded-2xl max-w-md w-full border border-dark-100 shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
        >
            <div class="flex items-center justify-between mb-4">
                <div>
                    <div class="text-xs uppercase tracking-[0.3em] text-gray-500">Invite</div>
                    <h3 class="text-2xl font-bold text-white">Invite Member</h3>
                </div>
                <div
                    class="h-10 w-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-semibold"
                >
                    @
                </div>
            </div>
            <p class="text-sm text-gray-400 mb-4">
                Invite a user by their email address. They will receive a notification and can accept or decline the
                invitation.
            </p>
            <form on:submit|preventDefault={inviteMember} class="space-y-4">
                <div>
                    <label for="inviteEmail" class="block text-sm font-medium text-gray-300 mb-2">
                        Email Address
                    </label>
                    <input
                        type="email"
                        id="inviteEmail"
                        bind:value={inviteEmail}
                        required
                        class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
                        placeholder="user@example.com"
                    />
                </div>
                <div class="flex gap-2">
                    <button
                        type="submit"
                        class="flex-1 bg-primary text-dark py-2.5 px-4 rounded-xl font-semibold hover:bg-primary-400 transition"
                    >
                        Send Invitation
                    </button>
                    <button
                        type="button"
                        on:click={() => (showInviteMember = false)}
                        class="flex-1 bg-dark-200 text-white py-2.5 px-4 rounded-xl font-semibold hover:bg-dark-100 transition"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}

{#if showScanReceipt && group}
    <div class="fixed inset-0 bg-black/80 flex items-end md:items-center justify-center p-4 z-50">
        <div
            class="bg-dark-300 p-6 rounded-t-3xl md:rounded-2xl max-w-md w-full border border-dark-100 shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
        >
            <div class="flex items-center justify-between mb-4">
                <div>
                    <div class="text-xs uppercase tracking-[0.3em] text-gray-500">Receipt</div>
                    <h3 class="text-2xl font-bold text-white">Scan Receipt</h3>
                </div>
            </div>
            <p class="text-sm text-gray-400 mb-4">
                Upload a photo of your receipt and we'll automatically extract the items and amounts.
            </p>
            <div class="space-y-4">
                <div>
                    <label
                        for="receiptUpload"
                        class="block w-full px-4 py-8 bg-dark-200 border-2 border-dashed border-dark-100 rounded-lg text-center cursor-pointer hover:border-primary transition"
                    >
                        {#if scanningReceipt}
                            <div class="flex flex-col items-center gap-2">
                                <div
                                    class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"
                                ></div>
                                <span class="text-gray-400">Analyzing receipt...</span>
                            </div>
                        {:else}
                            <div class="flex flex-col items-center gap-2">
                                <svg
                                    class="w-12 h-12 text-primary"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
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
                                <span class="text-gray-300">Click to upload receipt image</span>
                                <span class="text-xs text-gray-400">JPG, PNG, or HEIC</span>
                            </div>
                        {/if}
                        <input
                            id="receiptUpload"
                            type="file"
                            accept="image/*"
                            on:change={handleReceiptUpload}
                            disabled={scanningReceipt}
                            class="hidden"
                        />
                    </label>
                </div>
                <div class="flex gap-2">
                    <button
                        type="button"
                        on:click={() => (showScanReceipt = false)}
                        class="flex-1 bg-dark-200 text-white py-2.5 px-4 rounded-xl font-semibold hover:bg-dark-100 transition"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}

{#if previewImageUrl}
    <div
        class="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50"
        on:click={() => (previewImageUrl = null)}
        role="button"
        tabindex="0"
        on:keydown={(e) => e.key === "Escape" && (previewImageUrl = null)}
    >
        <div class="max-w-4xl max-h-full" on:click|stopPropagation role="presentation">
            <img
                src={`/api/receipts/view/${encodeURIComponent(previewImageUrl)}`}
                alt="Preview"
                class="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            <button
                on:click={() => (previewImageUrl = null)}
                class="mt-4 w-full bg-dark-300 text-white py-2 px-4 rounded-lg font-semibold hover:bg-dark-200 transition"
            >
                Close
            </button>
        </div>
    </div>
{/if}

{#if showReceiptPreview !== null}
    {@const expense = expenses.find((e) => e.id === showReceiptPreview)}
    {#if expense && expense.receiptImageUrl}
        <div
            class="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50"
            on:click={() => (showReceiptPreview = null)}
        >
            <div class="max-w-4xl max-h-full" on:click|stopPropagation>
                <img
                    src={`/api/receipts/view/${encodeURIComponent(expense.receiptImageUrl)}`}
                    alt="Receipt"
                    class="max-w-full max-h-[90vh] object-contain rounded-lg"
                />
                <button
                    on:click={() => (showReceiptPreview = null)}
                    class="mt-4 w-full bg-dark-300 text-white py-2 px-4 rounded-lg font-semibold hover:bg-dark-200 transition"
                >
                    Close
                </button>
            </div>
        </div>
    {/if}
{/if}

{#if showEditExpense && group}
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
                            on:click={() => setSplitMode("amounts")}
                            class="rounded-full px-4 py-1.5 text-xs font-semibold transition {splitMode === 'amounts'
                                ? 'bg-primary text-dark'
                                : 'bg-dark-200 text-gray-300 hover:text-white'}"
                        >
                            Amounts
                        </button>
                        <button
                            type="button"
                            on:click={() => setSplitMode("percent")}
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
                <form on:submit|preventDefault={updateExpense} class="space-y-4">
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
                            <span class="text-sm text-gray-400">{expenseCurrency}</span>
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
                            {#each supportedCurrencies as curr}
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
                        {#each allMembers as member}
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
                <!-- Attachments Section -->
                <div>
                    <div class="flex justify-between items-center mb-2">
                        <label class="block text-sm font-medium text-gray-300">
                            Attachments ({expenseAttachments.length}/5)
                        </label>
                        {#if expenseAttachments.length < 5}
                            <label class="text-xs text-primary hover:text-primary-400 cursor-pointer">
                                + Add File
                                <input
                                    type="file"
                                    multiple
                                    accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.csv,.xlsx,.xls,.doc,.docx"
                                    on:change={handleAttachmentUpload}
                                    class="hidden"
                                />
                            </label>
                        {/if}
                    </div>
                    {#if expenseAttachments.length > 0}
                        <AttachmentPreview
                            attachments={expenseAttachments}
                            onRemove={removeAttachment}
                            onImageClick={handleImagePreview}
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
                <div>
                    <div class="flex justify-between items-center mb-2">
                        <label class="block text-sm font-medium text-gray-300">Split with</label>
                        <button
                            type="button"
                            on:click={selectAllMembers}
                            class="text-xs text-primary hover:text-primary-400"
                        >
                            Select All
                        </button>
                    </div>
                    <div class="grid gap-2 sm:grid-cols-2 max-h-48 overflow-y-auto">
                        {#each allMembers as member}
                            <label
                                class="flex items-center space-x-2 p-2 bg-dark-200 rounded-lg cursor-pointer border border-dark-100 hover:border-primary/50 transition"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedMembers.includes(member.id)}
                                    on:change={() => toggleMember(member.id)}
                                    class="w-4 h-4 text-primary bg-dark border-dark-100 rounded focus:ring-primary"
                                />
                                <span class="text-white">{getMemberName(member)}</span>
                            </label>
                        {/each}
                    </div>
                    {#if selectedMembers.length > 0}
                        <div class="mt-3 p-3 bg-dark-200 rounded-lg">
                            {#if splitMode === "percent"}
                                <div class="space-y-2 mb-2">
                                    <div class="flex justify-between items-center">
                                        <span class="text-xs font-medium text-gray-300">Custom percentages</span>
                                        <button
                                            type="button"
                                            on:click={distributePercentEvenly}
                                            class="text-xs text-primary hover:text-primary-400"
                                        >
                                            Auto-fill evenly
                                        </button>
                                    </div>
                                    {#each selectedMembers as memberId}
                                        {@const member = allMembers.find((m) => m.id === memberId)}
                                        {#if member}
                                            {@const total = Number.parseFloat(expenseAmount || "0")}
                                            {@const percent = Number.parseFloat(percentShares[memberId] || "0")}
                                            <div class="flex items-center space-x-2">
                                                <span class="text-xs text-gray-400 flex-1">{getMemberName(member)}</span>
                                                <span class="text-[11px] text-gray-500">
                                                    {formatCurrency((total * percent) / 100)} {expenseCurrency}
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
                                        <span>{getPercentRemaining().toFixed(2)}%</span>
                                    </div>
                                </div>
                            {:else}
                                <label class="flex items-center space-x-2 mb-3">
                                    <input
                                        type="checkbox"
                                        bind:checked={splitEvenly}
                                        class="w-4 h-4 text-primary bg-dark border-dark-100 rounded focus:ring-primary"
                                    />
                                    <span class="text-sm text-gray-300">Split evenly</span>
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
                                            <span class="text-xs font-medium text-gray-300">Custom amounts</span>
                                            <button
                                                type="button"
                                                on:click={distributeEvenly}
                                                class="text-xs text-primary hover:text-primary-400"
                                            >
                                                Auto-fill evenly
                                            </button>
                                        </div>
                                        {#each selectedMembers as memberId}
                                            {@const member = allMembers.find((m) => m.id === memberId)}
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
                                            <span>{formatCurrency(getCustomSharesTotal())} {expenseCurrency}</span>
                                        </div>
                                        <div
                                            class="flex justify-between {Math.abs(getCustomSharesRemaining()) < 0.01
                                                ? 'text-green-400'
                                                : 'text-red-400'}"
                                        >
                                            <span>Remaining:</span>
                                            <span>{formatCurrency(getCustomSharesRemaining())} {expenseCurrency}</span>
                                        </div>
                                    </div>
                                {/if}
                            {/if}
                        </div>
                    {/if}
                </div>

                <!-- Receipt Image Display -->
                {#if receiptImageUrl}
                    <div class="border border-dark-100 rounded-lg p-3">
                        <h4 class="text-sm font-medium text-white mb-2">Receipt Image</h4>
                        <img
                            src={`/api/receipts/view/${encodeURIComponent(receiptImageUrl)}`}
                            alt="Receipt"
                            class="w-full rounded-lg cursor-pointer hover:opacity-90 transition"
                            on:click={() => (showReceiptPreview = editingExpenseId)}
                        />
                    </div>
                {/if}

                <!-- Receipt Items Section -->
                {#if receiptItems.length > 0 && splitMode === "amounts"}
                    <div class="border border-dark-100 rounded-lg p-3">
                        <div class="flex justify-between items-center mb-3">
                            <h4 class="text-sm font-medium text-white">Receipt Items</h4>
                            <button
                                type="button"
                                on:click={addReceiptItem}
                                class="text-xs text-primary hover:text-primary-400"
                            >
                                + Add Item
                            </button>
                        </div>
                        <!-- Column Headers - Hidden on mobile -->
                        <div class="hidden md:flex gap-2 mb-2 px-3 py-2 bg-dark-300 rounded-lg">
                            <div class="flex-1 text-xs font-medium text-gray-400">Name</div>
                            <div class="w-16 text-xs font-medium text-gray-400 text-center">Qty</div>
                            <div class="w-20 text-xs font-medium text-gray-400 text-center">Price</div>
                            <div class="w-6"></div>
                        </div>
                        <div class="space-y-3 max-h-64 overflow-y-auto">
                            {#each receiptItems as item, index}
                                <div class="bg-dark-200 p-3 rounded-lg">
                                    <!-- Mobile Layout: Stacked -->
                                    <div class="md:hidden space-y-2">
                                        <div class="flex items-center justify-between mb-2">
                                            <span class="text-xs text-gray-400">Item {index + 1}</span>
                                            <button
                                                type="button"
                                                on:click={() => deleteReceiptItem(index)}
                                                class="text-red-400 hover:text-red-300 text-xs w-6 h-6 flex items-center justify-center"
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
                                            <label class="text-xs text-gray-400 block mb-1">Name</label>
                                            <input
                                                type="text"
                                                bind:value={item.description}
                                                on:input={updateTotalFromItems}
                                                placeholder="Item name"
                                                class="w-full px-2 py-1.5 text-sm bg-dark-300 border border-dark-100 rounded text-white focus:outline-none focus:border-primary"
                                            />
                                        </div>
                                        <div class="grid grid-cols-2 gap-2">
                                            <div>
                                                <label class="text-xs text-gray-400 block mb-1">Qty</label>
                                                <input
                                                    type="number"
                                                    bind:value={item.quantity}
                                                    on:input={updateTotalFromItems}
                                                    min="1"
                                                    placeholder="1"
                                                    class="w-full px-2 py-1.5 text-sm bg-dark-300 border border-dark-100 rounded text-white focus:outline-none focus:border-primary"
                                                />
                                            </div>
                                            <div>
                                                <label class="text-xs text-gray-400 block mb-1">Price</label>
                                                <input
                                                    type="number"
                                                    bind:value={item.price}
                                                    on:input={updateTotalFromItems}
                                                    step="0.01"
                                                    min="0"
                                                    placeholder="0.00"
                                                    class="w-full px-2 py-1.5 text-sm bg-dark-300 border border-dark-100 rounded text-white focus:outline-none focus:border-primary"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Desktop Layout: Row -->
                                    <div class="hidden md:flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            bind:value={item.description}
                                            on:input={updateTotalFromItems}
                                            placeholder="Item description"
                                            class="flex-1 px-2 py-1 text-sm bg-dark-300 border border-dark-100 rounded text-white focus:outline-none focus:border-primary"
                                        />
                                        <input
                                            type="number"
                                            bind:value={item.quantity}
                                            on:input={updateTotalFromItems}
                                            min="1"
                                            placeholder="Qty"
                                            class="w-16 px-2 py-1 text-sm bg-dark-300 border border-dark-100 rounded text-white focus:outline-none focus:border-primary"
                                        />
                                        <input
                                            type="number"
                                            bind:value={item.price}
                                            on:input={updateTotalFromItems}
                                            step="0.01"
                                            min="0"
                                            placeholder="Price"
                                            class="w-20 px-2 py-1 text-sm bg-dark-300 border border-dark-100 rounded text-white focus:outline-none focus:border-primary"
                                        />
                                        <button
                                            type="button"
                                            on:click={() => deleteReceiptItem(index)}
                                            class="text-red-400 hover:text-red-300 text-xs"
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
                                        <span class="text-xs text-gray-400">Assign to:</span>
                                        {#each allMembers as member}
                                            <label class="flex items-center gap-1">
                                                <input
                                                    type="checkbox"
                                                    checked={item.assignedTo.includes(member.id)}
                                                    on:change={() => toggleItemAssignment(index, member.id)}
                                                    class="w-3 h-3 text-primary bg-dark border-dark-100 rounded"
                                                />
                                                <span class="text-xs text-gray-300">{getMemberName(member)}</span>
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

                <div class="flex gap-2">
                    <button
                        type="submit"
                        class="flex-1 bg-primary text-dark py-2.5 px-4 rounded-xl font-semibold hover:bg-primary-400 transition"
                    >
                        Save Changes
                    </button>
                    <button
                        type="button"
                        on:click={() => {
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

{#if previewImageUrl}
    <div
        class="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50"
        on:click={() => (previewImageUrl = null)}
        role="button"
        tabindex="0"
        on:keydown={(e) => e.key === "Escape" && (previewImageUrl = null)}
    >
        <div class="max-w-4xl max-h-full" on:click|stopPropagation role="presentation">
            <img
                src={`/api/receipts/view/${encodeURIComponent(previewImageUrl)}`}
                alt="Preview"
                class="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            <button
                on:click={() => (previewImageUrl = null)}
                class="mt-4 w-full bg-dark-300 text-white py-2 px-4 rounded-lg font-semibold hover:bg-dark-200 transition"
            >
                Close
            </button>
        </div>
    </div>
{/if}
