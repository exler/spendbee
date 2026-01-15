<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { user } from '$lib/stores/auth';
	import { api } from '$lib/api';

	interface GroupMember {
		id: number;
		userId: number | null;
		name: string | null;
		user?: {
			id: number;
			name: string;
			email: string;
		};
	}

	interface Group {
		id: number;
		name: string;
		description: string | null;
		baseCurrency?: string;
		createdBy?: number;
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
		paidBy: number;
		createdAt: Date;
		payer: GroupMember;
		shares: Array<{ member: GroupMember; share: number }>;
		receiptImageUrl?: string;
		receiptItems?: string;
	}

	interface Balance {
		memberId: number;
		memberName: string;
		balance: number;
		balanceByCurrency?: CurrencyBalance[];
		balanceInBaseCurrency?: number;
		isGuest?: boolean;
	}

	interface Settlement {
		id: number;
		fromMember: GroupMember;
		toMember: GroupMember;
		amount: number;
		currency?: string;
		createdAt: Date;
	}

	let groupId: number;
	let group: Group | null = null;
	let allMembers: GroupMember[] = [];
	let expenses: Expense[] = [];
	let balances: Balance[] = [];
	let settlements: Settlement[] = [];
	let loading = true;
	let error = '';
	let activeTab: 'expenses' | 'balances' | 'settlements' | 'members' | 'settings' = 'expenses';

	let showAddExpense = false;
	let showSettleDebt = false;
	let showAddGuestMember = false;
	let showInviteMember = false;
	let showChangeCurrency = false;
	let expenseDescription = '';
	let expenseNote = '';
	let expenseAmount = '';
	let expenseCurrency = 'EUR';
	let expenseDate = '';
	let expensePaidBy = 0;
	let selectedMembers: number[] = [];
	let splitEvenly = true;
	let customShares: { [memberId: number]: string } = {};
	let settleFromMember = 0;
	let settleToMember = 0;
	let settleAmount = '';
	let settleCurrency = 'EUR';
	let newGuestMemberName = '';
	let inviteEmail = '';
	let newBaseCurrency = 'EUR';
	let supportedCurrencies: string[] = [];

	let editGroupName = '';
	let editGroupDescription = '';
	let editGroupCurrency = 'EUR';
	let settingsSaved = false;

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

	onMount(() => {
		if (!$user) {
			goto('/login');
			return;
		}
		groupId = Number.parseInt($page.params.id);
		loadGroupData();
	});

	async function loadGroupData() {
		loading = true;
		try {
			[group, allMembers, expenses, balances, settlements, supportedCurrencies] =
				await Promise.all([
					api.groups.get(groupId),
					api.members.list(groupId),
					api.expenses.list(groupId),
					api.expenses.balances(groupId),
					api.expenses.settlements(groupId),
					api.groups.currencies().then((res) => res.currencies),
				]);
			if (group) {
				expenseCurrency = group.baseCurrency || 'EUR';
				settleCurrency = group.baseCurrency || 'EUR';
				newBaseCurrency = group.baseCurrency || 'EUR';
				editGroupName = group.name;
				editGroupDescription = group.description || '';
				editGroupCurrency = group.baseCurrency || 'EUR';
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load group data';
		} finally {
			loading = false;
		}
	}

	async function addExpense() {
		if (!expenseDescription || !expenseAmount || selectedMembers.length === 0) return;

		try {
			const customSharesArray = !splitEvenly
				? selectedMembers.map((memberId) => ({
						memberId,
						amount: Number.parseFloat(customShares[memberId] || '0'),
					}))
				: undefined;

			await api.expenses.create({
				groupId,
				description: expenseDescription,
				note: expenseNote || undefined,
				amount: Number.parseFloat(expenseAmount),
				currency: expenseCurrency,
				createdAt: expenseDate || undefined,
				paidBy: expensePaidBy || undefined,
				sharedWith: selectedMembers,
				receiptImageUrl: receiptImageUrl || undefined,
				receiptItems: receiptItems.length > 0 ? receiptItems : undefined,
				customShares: customSharesArray,
			});
			expenseDescription = '';
			expenseNote = '';
			expenseAmount = '';
			expenseDate = '';
			expensePaidBy = 0;
			selectedMembers = [];
			splitEvenly = true;
			customShares = {};
			receiptImage = null;
			receiptImageUrl = null;
			receiptItems = [];
			showAddExpense = false;
			loadGroupData();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to add expense';
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
			settleAmount = '';
			showSettleDebt = false;
			loadGroupData();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to settle debt';
		}
	}

	async function handleReceiptUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		if (!file.type.startsWith('image/')) {
			error = 'Please upload an image file';
			return;
		}

		const reader = new FileReader();
		reader.onload = async (e) => {
			const imageData = e.target?.result as string;
			receiptImage = imageData;
			scanningReceipt = true;
			error = '';

			try {
				const result = await api.expenses.analyzeReceipt({
					groupId,
					image: imageData,
				});

				expenseDescription = result.businessName || 'Receipt';
				expenseCurrency = result.currency || 'EUR';
				receiptImageUrl = result.imageUrl;

				receiptItems = result.items.map((item: any) => ({
					description: item.description,
					quantity: item.quantity,
					price: item.price,
					assignedTo: [],
				}));

				const total =
					result.total ||
					receiptItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
				expenseAmount = total.toFixed(2);

				showScanReceipt = false;
				showAddExpense = true;
			} catch (e) {
				error = e instanceof Error ? e.message : 'Failed to scan receipt';
			} finally {
				scanningReceipt = false;
			}
		};
		reader.readAsDataURL(file);
	}

	function addReceiptItem() {
		receiptItems = [
			...receiptItems,
			{ description: '', quantity: 1, price: 0, assignedTo: [] },
		];
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
			await api.members.create(groupId, {
				name: newGuestMemberName,
			});
			newGuestMemberName = '';
			showAddGuestMember = false;
			loadGroupData();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to add guest member';
		}
	}

	async function inviteMember() {
		if (!inviteEmail) return;

		try {
			await api.groups.invite(groupId, inviteEmail);
			inviteEmail = '';
			showInviteMember = false;
			error = '';
			// Show success message
			const successMsg = error;
			error = '✓ Invitation sent successfully!';
			setTimeout(() => {
				if (error === '✓ Invitation sent successfully!') error = '';
			}, 3000);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to send invitation';
		}
	}

	async function deleteGuestMember(memberId: number) {
		if (!confirm('Are you sure? This will remove all their expense shares and settlements.'))
			return;

		try {
			await api.members.delete(groupId, memberId);
			loadGroupData();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to delete guest member';
		}
	}

	async function updateBaseCurrency() {
		if (!newBaseCurrency) return;

		try {
			await api.groups.updateCurrency(groupId, newBaseCurrency);
			showChangeCurrency = false;
			loadGroupData();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to update base currency';
		}
	}

	async function saveGroupSettings() {
		if (!editGroupName) {
			error = 'Group name is required';
			return;
		}

		try {
			await api.groups.update(groupId, {
				name: editGroupName,
				description: editGroupDescription || undefined,
				baseCurrency: editGroupCurrency,
			});
			settingsSaved = true;
			setTimeout(() => (settingsSaved = false), 3000);
			loadGroupData();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to update group settings';
		}
	}

	function toggleMember(memberId: number) {
		if (selectedMembers.includes(memberId)) {
			selectedMembers = selectedMembers.filter((id) => id !== memberId);
			delete customShares[memberId];
			customShares = customShares;
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
			return sum + Number.parseFloat(customShares[memberId] || '0');
		}, 0);
	}

	function getCustomSharesRemaining(): number {
		const total = Number.parseFloat(expenseAmount || '0');
		const allocated = getCustomSharesTotal();
		return total - allocated;
	}

	function distributeEvenly() {
		if (!expenseAmount || selectedMembers.length === 0) return;
		const total = Number.parseFloat(expenseAmount);
		const perPerson = total / selectedMembers.length;
		customShares = {};
		selectedMembers.forEach((memberId) => {
			customShares[memberId] = perPerson.toFixed(2);
		});
		customShares = customShares;
	}

	function formatDate(date: Date) {
		return new Date(date).toLocaleDateString();
	}

	function formatCurrency(amount: number) {
		return amount.toFixed(2);
	}

	function getMemberName(member: GroupMember) {
		if (member.user && member.user.name) return member.user.name;
		if (member.name) return `${member.name} (guest)`;
		return 'Unknown';
	}
</script>

<svelte:head>
	<title>{group?.name || 'Group'} - Spendbee</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-b from-dark to-dark-300 pb-20">
	<div class="max-w-4xl mx-auto p-4">
		<div class="mb-4">
			<a href="/groups" class="text-primary hover:text-primary-400">← Back to Groups</a>
		</div>

		{#if loading}
			<div class="text-center py-12">
				<div class="text-gray-400">Loading...</div>
			</div>
		{:else if group}
			<div class="mb-6">
				<h1 class="text-3xl font-bold text-white mb-2">{group.name}</h1>
				{#if group.description}
					<p class="text-gray-400">{group.description}</p>
				{/if}
				<div class="mt-2 text-sm text-gray-400">
					Group ID: {group.id} • {allMembers.length} members ({allMembers.filter(
						(m) => m.userId === null
					).length} guests)
				</div>
			</div>

			{#if error}
				<div class="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded mb-4">
					{error}
				</div>
			{/if}

			<div class="flex gap-2 mb-4 overflow-x-auto">
				<button
					on:click={() => (activeTab = 'expenses')}
					class="px-4 py-2 rounded-lg font-semibold transition whitespace-nowrap {activeTab ===
					'expenses'
						? 'bg-primary text-dark'
						: 'bg-dark-300 text-gray-400'}"
				>
					Expenses
				</button>
				<button
					on:click={() => (activeTab = 'balances')}
					class="px-4 py-2 rounded-lg font-semibold transition whitespace-nowrap {activeTab ===
					'balances'
						? 'bg-primary text-dark'
						: 'bg-dark-300 text-gray-400'}"
				>
					Balances
				</button>
				<button
					on:click={() => (activeTab = 'settlements')}
					class="px-4 py-2 rounded-lg font-semibold transition whitespace-nowrap {activeTab ===
					'settlements'
						? 'bg-primary text-dark'
						: 'bg-dark-300 text-gray-400'}"
				>
					Settlements
				</button>
				<button
					on:click={() => (activeTab = 'members')}
					class="px-4 py-2 rounded-lg font-semibold transition whitespace-nowrap {activeTab ===
					'members'
						? 'bg-primary text-dark'
						: 'bg-dark-300 text-gray-400'}"
				>
					Members
				</button>
				{#if group.createdBy === $user?.id}
					<button
						on:click={() => (activeTab = 'settings')}
						class="px-4 py-2 rounded-lg font-semibold transition whitespace-nowrap {activeTab ===
						'settings'
							? 'bg-primary text-dark'
							: 'bg-dark-300 text-gray-400'}"
					>
						Settings
					</button>
				{/if}
			</div>

			{#if activeTab === 'expenses'}
				<div class="mb-4 flex gap-2">
					<button
						on:click={() => (showAddExpense = true)}
						class="flex-1 bg-primary text-dark py-3 px-6 rounded-lg font-semibold hover:bg-primary-400 transition"
					>
						Add Expense
					</button>
					<button
						on:click={() => (showScanReceipt = true)}
						class="flex-1 bg-dark-200 text-white py-3 px-6 rounded-lg font-semibold hover:bg-dark-100 transition border border-primary"
					>
						📷 Scan Receipt
					</button>
				</div>

				{#if expenses.length === 0}
					<div class="text-center py-12 bg-dark-300 rounded-lg">
						<p class="text-gray-400">No expenses yet.</p>
					</div>
				{:else}
					<div class="space-y-3">
						{#each expenses as expense}
							<div class="bg-dark-300 p-4 rounded-lg border border-dark-100">
								<div class="flex justify-between items-start mb-2">
									<div class="flex-1">
										<h3 class="text-lg font-semibold text-white">
											{expense.description}
										</h3>
										{#if expense.note}
											<p class="text-sm text-gray-300 mt-1 italic">
												{expense.note}
											</p>
										{/if}
										<p class="text-sm text-gray-400 mt-1">
											Paid by {getMemberName(expense.payer)}
										</p>
									</div>
									<div class="text-right">
										<div class="text-xl font-bold text-primary">
											{formatCurrency(expense.amount)}
											{expense.currency || 'EUR'}
										</div>
										<div class="text-xs text-gray-400">
											{formatDate(expense.createdAt)}
										</div>
									</div>
								</div>
								<div class="text-sm text-gray-400">
									Split with: {expense.shares
										.map((s) => getMemberName(s.member))
										.join(', ')}
								</div>
								{#if expense.receiptImageUrl}
									<div class="mt-3 pt-3 border-t border-dark-100">
										<div class="flex items-center gap-2">
											<img
												src={`http://localhost:3000${expense.receiptImageUrl}`}
												alt="Receipt"
												class="w-16 h-16 object-cover rounded cursor-pointer hover:opacity-80 transition"
												on:click={() => (showReceiptPreview = expense.id)}
											/>
											<button
												on:click={() => (showReceiptPreview = expense.id)}
												class="text-xs text-primary hover:text-primary-400"
											>
												View receipt
											</button>
										</div>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			{/if}

			{#if activeTab === 'balances'}
				<div class="mb-4">
					<button
						on:click={() => (showSettleDebt = true)}
						class="w-full bg-primary text-dark py-3 px-6 rounded-lg font-semibold hover:bg-primary-400 transition"
					>
						Settle Debt
					</button>
				</div>

				<div class="space-y-3">
					{#each balances as balance}
						<div class="bg-dark-300 p-4 rounded-lg border border-dark-100">
							<div class="flex justify-between items-start mb-2">
								<div class="flex-1">
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
														? 'Owed: +'
														: 'Owes: '}{formatCurrency(
														Math.abs(currBal.amount)
													)}
													{currBal.currency}
												</div>
											{/each}
											{#if balance.balanceByCurrency.length > 1}
												<div
													class="text-xs text-gray-500 mt-1 pt-1 border-t border-dark-100"
												>
													Total in {group?.baseCurrency || 'EUR'}: {balance.balance >
													0
														? '+'
														: ''}{formatCurrency(
														Math.abs(balance.balance)
													)}
												</div>
											{/if}
										</div>
									{/if}
								</div>
								<div class="text-right">
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
										{group?.baseCurrency || 'EUR'}
									</div>
								</div>
							</div>
							<div class="text-sm text-gray-400 border-t border-dark-100 pt-2">
								{#if balance.balance > 0}
									Is owed in total
								{:else if balance.balance < 0}
									Owes in total
								{:else}
									All settled up
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}

			{#if activeTab === 'settlements'}
				{#if settlements.length === 0}
					<div class="text-center py-12 bg-dark-300 rounded-lg">
						<p class="text-gray-400">No settlements recorded yet.</p>
					</div>
				{:else}
					<div class="space-y-3">
						{#each settlements as settlement}
							<div class="bg-dark-300 p-4 rounded-lg border border-dark-100">
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
										<div class="text-xs text-gray-400 mt-1">
											{formatDate(settlement.createdAt)}
										</div>
									</div>
									<div class="text-lg font-bold text-primary">
										{formatCurrency(settlement.amount)}
										{settlement.currency || 'EUR'}
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{/if}

			{#if activeTab === 'members'}
				<div class="mb-4 flex gap-2">
					<button
						on:click={() => (showInviteMember = true)}
						class="flex-1 bg-primary text-dark py-3 px-6 rounded-lg font-semibold hover:bg-primary-400 transition"
					>
						Invite Member
					</button>
					<button
						on:click={() => (showAddGuestMember = true)}
						class="flex-1 bg-dark-200 text-white py-3 px-6 rounded-lg font-semibold hover:bg-dark-100 transition border border-primary"
					>
						Add Guest Member
					</button>
				</div>

				<div class="space-y-4">
					<div>
						<h3 class="text-lg font-semibold text-white mb-3">All Members</h3>
						<div class="space-y-2">
							{#each allMembers as member}
								<div class="bg-dark-300 p-4 rounded-lg border border-dark-100">
									<div class="flex justify-between items-center">
										<div>
											<div class="font-semibold text-white">
												{getMemberName(member)}
											</div>
											{#if member.user}
												<div class="text-sm text-gray-400">
													{member.user.email}
												</div>
											{:else}
												<div class="text-sm text-gray-400">
													No account required
												</div>
											{/if}
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

			{#if activeTab === 'settings'}
				{#if group.createdBy === $user?.id}
					<div class="bg-dark-300 p-6 rounded-lg border border-dark-100">
						<h3 class="text-2xl font-bold text-white mb-6">Group Settings</h3>

						{#if settingsSaved}
							<div
								class="bg-green-900/50 border border-green-500 text-green-200 p-3 rounded mb-4"
							>
								Settings saved successfully!
							</div>
						{/if}

						<form on:submit|preventDefault={saveGroupSettings} class="space-y-6">
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
									The base currency is used to display total balances when
									multiple currencies are used.
								</p>
							</div>

							<button
								type="submit"
								class="w-full bg-primary text-dark py-3 px-6 rounded-lg font-semibold hover:bg-primary-400 transition"
							>
								Save Settings
							</button>
						</form>
					</div>
				{:else}
					<div class="text-center py-12 bg-dark-300 rounded-lg">
						<p class="text-gray-400">Only the group creator can modify settings.</p>
					</div>
				{/if}
			{/if}
		{/if}
	</div>
</div>

{#if showAddExpense && group}
	<div class="fixed inset-0 bg-black/80 flex items-end md:items-center justify-center p-4 z-50">
		<div
			class="bg-dark-300 p-6 rounded-t-2xl md:rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto"
		>
			<h3 class="text-2xl font-bold text-white mb-4">Add Expense</h3>
			<form on:submit|preventDefault={addExpense} class="space-y-4">
				<div>
					<label for="description" class="block text-sm font-medium text-gray-300 mb-2">
						Description
					</label>
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
					<label for="note" class="block text-sm font-medium text-gray-300 mb-2">
						Note (optional)
					</label>
					<textarea
						id="note"
						bind:value={expenseNote}
						rows="2"
						class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
						placeholder="Add any additional context or details..."
					></textarea>
				</div>
				<div>
					<label for="amount" class="block text-sm font-medium text-gray-300 mb-2">
						Amount
					</label>
					<input
						type="number"
						id="amount"
						bind:value={expenseAmount}
						required
						step="0.01"
						min="0.01"
						class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
						placeholder="0.00"
					/>
				</div>
				<div>
					<label for="currency" class="block text-sm font-medium text-gray-300 mb-2">
						Currency
					</label>
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
				<div>
					<label for="expenseDate" class="block text-sm font-medium text-gray-300 mb-2">
						Date (optional)
					</label>
					<input
						type="date"
						id="expenseDate"
						bind:value={expenseDate}
						max={new Date().toISOString().split('T')[0]}
						class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
					/>
					<p class="text-xs text-gray-400 mt-1">Leave empty to use today's date</p>
				</div>
				<div>
					<label for="paidBy" class="block text-sm font-medium text-gray-300 mb-2">
						Paid by
					</label>
					<select
						id="paidBy"
						bind:value={expensePaidBy}
						class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
					>
						<option value={0}>Me ({$user?.name})</option>
						{#each allMembers as member}
							{#if member.userId && member.userId !== $user?.id}
								<option value={member.id}>{getMemberName(member)}</option>
							{/if}
						{/each}
					</select>
					<p class="text-xs text-gray-400 mt-1">Select who paid for this expense</p>
				</div>
				{#if receiptItems.length > 0}
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
						<div class="space-y-3 max-h-64 overflow-y-auto">
							{#each receiptItems as item, index}
								<div class="bg-dark-200 p-3 rounded-lg">
									<div class="flex gap-2 mb-2">
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
											✕
										</button>
									</div>
									<div class="flex flex-wrap gap-2">
										<span class="text-xs text-gray-400">Assign to:</span>
										{#each allMembers as member}
											<label class="flex items-center gap-1">
												<input
													type="checkbox"
													checked={item.assignedTo.includes(member.id)}
													on:change={() =>
														toggleItemAssignment(index, member.id)}
													class="w-3 h-3 text-primary bg-dark border-dark-100 rounded"
												/>
												<span class="text-xs text-gray-300"
													>{getMemberName(member)}</span
												>
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
						<label class="block text-sm font-medium text-gray-300"> Split with </label>
						<button
							type="button"
							on:click={selectAllMembers}
							class="text-xs text-primary hover:text-primary-400"
						>
							Select All
						</button>
					</div>
					<div class="space-y-2 max-h-48 overflow-y-auto">
						{#each allMembers as member}
							<label
								class="flex items-center space-x-2 p-2 bg-dark-200 rounded cursor-pointer"
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
									{selectedMembers.length} member(s) selected • ${formatCurrency(
										parseFloat(expenseAmount || '0') / selectedMembers.length
									)} each
								</p>
							{:else}
								<div class="space-y-2 mb-2">
									<div class="flex justify-between items-center">
										<span class="text-xs font-medium text-gray-300"
											>Custom amounts</span
										>
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
												<span class="text-xs text-gray-400 flex-1"
													>{getMemberName(member)}</span
												>
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
										<span>${formatCurrency(getCustomSharesTotal())}</span>
									</div>
									<div
										class="flex justify-between {Math.abs(
											getCustomSharesRemaining()
										) < 0.01
											? 'text-green-400'
											: 'text-red-400'}"
									>
										<span>Remaining:</span>
										<span>${formatCurrency(getCustomSharesRemaining())}</span>
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</div>
				<div class="flex gap-2">
					<button
						type="submit"
						class="flex-1 bg-primary text-dark py-2 px-4 rounded-lg font-semibold hover:bg-primary-400 transition"
					>
						Add
					</button>
					<button
						type="button"
						on:click={() => (showAddExpense = false)}
						class="flex-1 bg-dark-200 text-white py-2 px-4 rounded-lg font-semibold hover:bg-dark-100 transition"
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
		<div class="bg-dark-300 p-6 rounded-t-2xl md:rounded-lg max-w-md w-full">
			<h3 class="text-2xl font-bold text-white mb-4">Settle Debt</h3>
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
					<label for="settleAmount" class="block text-sm font-medium text-gray-300 mb-2">
						Amount
					</label>
					<input
						type="number"
						id="settleAmount"
						bind:value={settleAmount}
						required
						step="0.01"
						min="0.01"
						class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
						placeholder="0.00"
					/>
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
						{#each supportedCurrencies as curr}
							<option value={curr}>{curr}</option>
						{/each}
					</select>
				</div>
				<div class="flex gap-2">
					<button
						type="submit"
						class="flex-1 bg-primary text-dark py-2 px-4 rounded-lg font-semibold hover:bg-primary-400 transition"
					>
						Settle
					</button>
					<button
						type="button"
						on:click={() => (showSettleDebt = false)}
						class="flex-1 bg-dark-200 text-white py-2 px-4 rounded-lg font-semibold hover:bg-dark-100 transition"
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
		<div class="bg-dark-300 p-6 rounded-t-2xl md:rounded-lg max-w-md w-full">
			<h3 class="text-2xl font-bold text-white mb-4">Add Guest Member</h3>
			<p class="text-sm text-gray-400 mb-4">
				Guest members don't need an account. Perfect for visitors or people who don't want
				to register.
			</p>
			<form on:submit|preventDefault={addGuestMember} class="space-y-4">
				<div>
					<label
						for="guestMemberName"
						class="block text-sm font-medium text-gray-300 mb-2"
					>
						Name
					</label>
					<input
						type="text"
						id="guestMemberName"
						bind:value={newGuestMemberName}
						required
						class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
						placeholder="e.g., John (visiting)"
					/>
					<p class="text-xs text-gray-400 mt-1">
						Add a note like "(guest)" or "(visiting)" to remember who they are
					</p>
				</div>
				<div class="flex gap-2">
					<button
						type="submit"
						class="flex-1 bg-primary text-dark py-2 px-4 rounded-lg font-semibold hover:bg-primary-400 transition"
					>
						Add
					</button>
					<button
						type="button"
						on:click={() => (showAddGuestMember = false)}
						class="flex-1 bg-dark-200 text-white py-2 px-4 rounded-lg font-semibold hover:bg-dark-100 transition"
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
		<div class="bg-dark-300 p-6 rounded-t-2xl md:rounded-lg max-w-md w-full">
			<h3 class="text-2xl font-bold text-white mb-4">Change Base Currency</h3>
			<p class="text-sm text-gray-400 mb-4">
				The base currency is used to display total balances when multiple currencies are
				used in the group.
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
						class="flex-1 bg-primary text-dark py-2 px-4 rounded-lg font-semibold hover:bg-primary-400 transition"
					>
						Update
					</button>
					<button
						type="button"
						on:click={() => (showChangeCurrency = false)}
						class="flex-1 bg-dark-200 text-white py-2 px-4 rounded-lg font-semibold hover:bg-dark-100 transition"
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
		<div class="bg-dark-300 p-6 rounded-t-2xl md:rounded-lg max-w-md w-full">
			<h3 class="text-2xl font-bold text-white mb-4">Invite Member</h3>
			<p class="text-sm text-gray-400 mb-4">
				Invite a user by their email address. They will receive a notification and can
				accept or decline the invitation.
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
						class="flex-1 bg-primary text-dark py-2 px-4 rounded-lg font-semibold hover:bg-primary-400 transition"
					>
						Send Invitation
					</button>
					<button
						type="button"
						on:click={() => (showInviteMember = false)}
						class="flex-1 bg-dark-200 text-white py-2 px-4 rounded-lg font-semibold hover:bg-dark-100 transition"
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
		<div class="bg-dark-300 p-6 rounded-t-2xl md:rounded-lg max-w-md w-full">
			<h3 class="text-2xl font-bold text-white mb-4">Scan Receipt</h3>
			<p class="text-sm text-gray-400 mb-4">
				Upload a photo of your receipt and we'll automatically extract the items and
				amounts.
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
								<span class="text-4xl">📷</span>
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
						class="flex-1 bg-dark-200 text-white py-2 px-4 rounded-lg font-semibold hover:bg-dark-100 transition"
					>
						Cancel
					</button>
				</div>
			</div>
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
					src={`http://localhost:3000${expense.receiptImageUrl}`}
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
