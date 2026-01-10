<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { user } from '$lib/stores/auth';
	import { api } from '$lib/api';

	interface Member {
		id: number;
		name: string;
		email: string;
	}

	interface MockUser {
		id: number;
		name: string;
	}

	interface Group {
		id: number;
		name: string;
		description: string | null;
		members: Array<{ user: Member }>;
	}

	interface Expense {
		id: number;
		description: string;
		amount: number;
		paidBy: number;
		createdAt: Date;
		payer: Member;
		shares: Array<{ user: Member; share: number }>;
		mockShares: Array<{ mockUser: MockUser; share: number }>;
	}

	interface Balance {
		userId: number;
		userName: string;
		balance: number;
		isMock?: boolean;
	}

	interface Settlement {
		id: number;
		fromUser: Member | null;
		toUser: Member | null;
		fromMockUser: MockUser | null;
		toMockUser: MockUser | null;
		amount: number;
		createdAt: Date;
	}

	let groupId: number;
	let group: Group | null = null;
	let mockUsers: MockUser[] = [];
	let expenses: Expense[] = [];
	let balances: Balance[] = [];
	let settlements: Settlement[] = [];
	let loading = true;
	let error = '';
	let activeTab: 'expenses' | 'balances' | 'settlements' | 'members' = 'expenses';

	let showAddExpense = false;
	let showSettleDebt = false;
	let showAddMockUser = false;
	let expenseDescription = '';
	let expenseAmount = '';
	let selectedMembers: number[] = [];
	let selectedMockMembers: number[] = [];
	let settleFromUser = 0;
	let settleToUser = 0;
	let settleFromMockUser = 0;
	let settleToMockUser = 0;
	let settleFromIsMock = false;
	let settleToIsMock = false;
	let settleAmount = '';
	let newMockUserName = '';

	onMount(() => {
		if (!$user) {
			goto('/login');
			return;
		}
		groupId = parseInt($page.params.id);
		loadGroupData();
	});

	async function loadGroupData() {
		loading = true;
		try {
			[group, mockUsers, expenses, balances, settlements] = await Promise.all([
				api.groups.get(groupId),
				api.mockUsers.list(groupId),
				api.expenses.list(groupId),
				api.expenses.balances(groupId),
				api.expenses.settlements(groupId),
			]);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load group data';
		} finally {
			loading = false;
		}
	}

	async function addExpense() {
		if (!expenseDescription || !expenseAmount || (selectedMembers.length === 0 && selectedMockMembers.length === 0)) return;

		try {
			await api.expenses.create({
				groupId,
				description: expenseDescription,
				amount: parseFloat(expenseAmount),
				sharedWith: selectedMembers,
				sharedWithMock: selectedMockMembers,
			});
			expenseDescription = '';
			expenseAmount = '';
			selectedMembers = [];
			selectedMockMembers = [];
			showAddExpense = false;
			loadGroupData();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to add expense';
		}
	}

	async function settleDebt() {
		if (!settleAmount) return;
		if (!settleFromIsMock && !settleFromUser) return;
		if (!settleToIsMock && !settleToUser) return;

		try {
			await api.expenses.settle({
				groupId,
				fromUserId: settleFromIsMock ? undefined : settleFromUser,
				toUserId: settleToIsMock ? undefined : settleToUser,
				fromMockUserId: settleFromIsMock ? settleFromMockUser : undefined,
				toMockUserId: settleToIsMock ? settleToMockUser : undefined,
				amount: parseFloat(settleAmount),
			});
			settleFromUser = 0;
			settleToUser = 0;
			settleFromMockUser = 0;
			settleToMockUser = 0;
			settleFromIsMock = false;
			settleToIsMock = false;
			settleAmount = '';
			showSettleDebt = false;
			loadGroupData();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to settle debt';
		}
	}

	async function addMockUser() {
		if (!newMockUserName) return;

		try {
			await api.mockUsers.create({
				groupId,
				name: newMockUserName,
			});
			newMockUserName = '';
			showAddMockUser = false;
			loadGroupData();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to add mock user';
		}
	}

	async function deleteMockUser(id: number) {
		if (!confirm('Are you sure? This will remove all their expense shares and settlements.')) return;

		try {
			await api.mockUsers.delete(id);
			loadGroupData();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to delete mock user';
		}
	}

	function toggleMember(memberId: number) {
		if (selectedMembers.includes(memberId)) {
			selectedMembers = selectedMembers.filter((id) => id !== memberId);
		} else {
			selectedMembers = [...selectedMembers, memberId];
		}
	}

	function toggleMockMember(mockUserId: number) {
		if (selectedMockMembers.includes(mockUserId)) {
			selectedMockMembers = selectedMockMembers.filter((id) => id !== mockUserId);
		} else {
			selectedMockMembers = [...selectedMockMembers, mockUserId];
		}
	}

	function selectAllMembers() {
		if (!group) return;
		selectedMembers = group.members.map((m) => m.user.id);
		selectedMockMembers = mockUsers.map((m) => m.id);
	}

	function formatDate(date: Date) {
		return new Date(date).toLocaleDateString();
	}

	function formatCurrency(amount: number) {
		return amount.toFixed(2);
	}

	function getSettlementParticipant(fromUser: Member | null, fromMockUser: MockUser | null) {
		if (fromUser) return fromUser.name;
		if (fromMockUser) return `${fromMockUser.name} (guest)`;
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
					Group ID: {group.id} • {group.members.length} members • {mockUsers.length} guests
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
					class="px-4 py-2 rounded-lg font-semibold transition whitespace-nowrap {activeTab === 'expenses'
						? 'bg-primary text-dark'
						: 'bg-dark-300 text-gray-400'}"
				>
					Expenses
				</button>
				<button
					on:click={() => (activeTab = 'balances')}
					class="px-4 py-2 rounded-lg font-semibold transition whitespace-nowrap {activeTab === 'balances'
						? 'bg-primary text-dark'
						: 'bg-dark-300 text-gray-400'}"
				>
					Balances
				</button>
				<button
					on:click={() => (activeTab = 'settlements')}
					class="px-4 py-2 rounded-lg font-semibold transition whitespace-nowrap {activeTab === 'settlements'
						? 'bg-primary text-dark'
						: 'bg-dark-300 text-gray-400'}"
				>
					Settlements
				</button>
				<button
					on:click={() => (activeTab = 'members')}
					class="px-4 py-2 rounded-lg font-semibold transition whitespace-nowrap {activeTab === 'members'
						? 'bg-primary text-dark'
						: 'bg-dark-300 text-gray-400'}"
				>
					Members
				</button>
			</div>

			{#if activeTab === 'expenses'}
				<div class="mb-4">
					<button
						on:click={() => (showAddExpense = true)}
						class="w-full bg-primary text-dark py-3 px-6 rounded-lg font-semibold hover:bg-primary-400 transition"
					>
						Add Expense
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
										<h3 class="text-lg font-semibold text-white">{expense.description}</h3>
										<p class="text-sm text-gray-400">Paid by {expense.payer.name}</p>
									</div>
									<div class="text-right">
										<div class="text-xl font-bold text-primary">${formatCurrency(expense.amount)}</div>
										<div class="text-xs text-gray-400">{formatDate(expense.createdAt)}</div>
									</div>
								</div>
								<div class="text-sm text-gray-400">
									Split with: {[
										...expense.shares.map((s) => s.user.name),
										...expense.mockShares.map((s) => s.mockUser.name + ' (guest)')
									].join(', ')}
								</div>
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
							<div class="flex justify-between items-center">
								<div>
									<div class="font-semibold text-white">{balance.userName}</div>
									{#if balance.isMock}
										<div class="text-xs text-gray-500">Guest member</div>
									{/if}
								</div>
								<div
									class="text-lg font-bold {balance.balance > 0
										? 'text-green-400'
										: balance.balance < 0
											? 'text-red-400'
											: 'text-gray-400'}"
								>
									{#if balance.balance > 0}
										+${formatCurrency(balance.balance)}
									{:else if balance.balance < 0}
										-${formatCurrency(Math.abs(balance.balance))}
									{:else}
										Settled
									{/if}
								</div>
							</div>
							<div class="text-sm text-gray-400 mt-1">
								{#if balance.balance > 0}
									Is owed
								{:else if balance.balance < 0}
									Owes
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
											<span class="font-semibold">{getSettlementParticipant(settlement.fromUser, settlement.fromMockUser)}</span>
											<span class="text-gray-400"> paid </span>
											<span class="font-semibold">{getSettlementParticipant(settlement.toUser, settlement.toMockUser)}</span>
										</div>
										<div class="text-xs text-gray-400 mt-1">{formatDate(settlement.createdAt)}</div>
									</div>
									<div class="text-lg font-bold text-primary">${formatCurrency(settlement.amount)}</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{/if}

			{#if activeTab === 'members'}
				<div class="mb-4">
					<button
						on:click={() => (showAddMockUser = true)}
						class="w-full bg-primary text-dark py-3 px-6 rounded-lg font-semibold hover:bg-primary-400 transition"
					>
						Add Guest Member
					</button>
				</div>

				<div class="space-y-4">
					<div>
						<h3 class="text-lg font-semibold text-white mb-3">Registered Members</h3>
						<div class="space-y-2">
							{#each group.members as member}
								<div class="bg-dark-300 p-4 rounded-lg border border-dark-100">
									<div class="flex justify-between items-center">
										<div>
											<div class="font-semibold text-white">{member.user.name}</div>
											<div class="text-sm text-gray-400">{member.user.email}</div>
										</div>
										<div class="text-xs text-primary">Registered</div>
									</div>
								</div>
							{/each}
						</div>
					</div>

					{#if mockUsers.length > 0}
						<div>
							<h3 class="text-lg font-semibold text-white mb-3">Guest Members</h3>
							<div class="space-y-2">
								{#each mockUsers as mockUser}
									<div class="bg-dark-300 p-4 rounded-lg border border-dark-100">
										<div class="flex justify-between items-center">
											<div>
												<div class="font-semibold text-white">{mockUser.name}</div>
												<div class="text-sm text-gray-400">No account required</div>
											</div>
											<button
												on:click={() => deleteMockUser(mockUser.id)}
												class="text-red-400 hover:text-red-300 text-sm"
											>
												Remove
											</button>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/if}
		{/if}
	</div>
</div>

{#if showAddExpense && group}
	<div class="fixed inset-0 bg-black/80 flex items-end md:items-center justify-center p-4 z-50">
		<div class="bg-dark-300 p-6 rounded-t-2xl md:rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
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
					<div class="flex justify-between items-center mb-2">
						<label class="block text-sm font-medium text-gray-300">
							Split with
						</label>
						<button
							type="button"
							on:click={selectAllMembers}
							class="text-xs text-primary hover:text-primary-400"
						>
							Select All
						</button>
					</div>
					<div class="space-y-2 max-h-48 overflow-y-auto">
						{#each group.members as member}
							<label class="flex items-center space-x-2 p-2 bg-dark-200 rounded cursor-pointer">
								<input
									type="checkbox"
									checked={selectedMembers.includes(member.user.id)}
									on:change={() => toggleMember(member.user.id)}
									class="w-4 h-4 text-primary bg-dark border-dark-100 rounded focus:ring-primary"
								/>
								<span class="text-white">{member.user.name}</span>
							</label>
						{/each}
						{#if mockUsers.length > 0}
							<div class="border-t border-dark-100 pt-2 mt-2">
								<p class="text-xs text-gray-400 mb-2">Guest Members</p>
								{#each mockUsers as mockUser}
									<label class="flex items-center space-x-2 p-2 bg-dark-200 rounded cursor-pointer">
										<input
											type="checkbox"
											checked={selectedMockMembers.includes(mockUser.id)}
											on:change={() => toggleMockMember(mockUser.id)}
											class="w-4 h-4 text-primary bg-dark border-dark-100 rounded focus:ring-primary"
										/>
										<span class="text-gray-300">{mockUser.name}</span>
									</label>
								{/each}
							</div>
						{/if}
					</div>
					{#if selectedMembers.length > 0 || selectedMockMembers.length > 0}
						<p class="text-xs text-gray-400 mt-2">
							{selectedMembers.length + selectedMockMembers.length} member(s) selected • ${formatCurrency(
								parseFloat(expenseAmount || '0') / (selectedMembers.length + selectedMockMembers.length)
							)} each
						</p>
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
					<label for="fromUser" class="block text-sm font-medium text-gray-300 mb-2">
						From (who paid)
					</label>
					<select
						id="fromUser"
						on:change={(e) => {
							const value = e.currentTarget.value;
							if (value.startsWith('mock-')) {
								settleFromIsMock = true;
								settleFromMockUser = parseInt(value.replace('mock-', ''));
								settleFromUser = 0;
							} else {
								settleFromIsMock = false;
								settleFromUser = parseInt(value);
								settleFromMockUser = 0;
							}
						}}
						required
						class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
					>
						<option value="">Select person</option>
						<optgroup label="Registered Members">
							{#each group.members as member}
								<option value={member.user.id}>{member.user.name}</option>
							{/each}
						</optgroup>
						{#if mockUsers.length > 0}
							<optgroup label="Guest Members">
								{#each mockUsers as mockUser}
									<option value="mock-{mockUser.id}">{mockUser.name}</option>
								{/each}
							</optgroup>
						{/if}
					</select>
				</div>
				<div>
					<label for="toUser" class="block text-sm font-medium text-gray-300 mb-2">
						To (who received)
					</label>
					<select
						id="toUser"
						on:change={(e) => {
							const value = e.currentTarget.value;
							if (value.startsWith('mock-')) {
								settleToIsMock = true;
								settleToMockUser = parseInt(value.replace('mock-', ''));
								settleToUser = 0;
							} else {
								settleToIsMock = false;
								settleToUser = parseInt(value);
								settleToMockUser = 0;
							}
						}}
						required
						class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
					>
						<option value="">Select person</option>
						<optgroup label="Registered Members">
							{#each group.members as member}
								<option value={member.user.id}>{member.user.name}</option>
							{/each}
						</optgroup>
						{#if mockUsers.length > 0}
							<optgroup label="Guest Members">
								{#each mockUsers as mockUser}
									<option value="mock-{mockUser.id}">{mockUser.name}</option>
								{/each}
							</optgroup>
						{/if}
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

{#if showAddMockUser && group}
	<div class="fixed inset-0 bg-black/80 flex items-end md:items-center justify-center p-4 z-50">
		<div class="bg-dark-300 p-6 rounded-t-2xl md:rounded-lg max-w-md w-full">
			<h3 class="text-2xl font-bold text-white mb-4">Add Guest Member</h3>
			<p class="text-sm text-gray-400 mb-4">
				Guest members don't need an account. Perfect for visitors or people who don't want to register.
			</p>
			<form on:submit|preventDefault={addMockUser} class="space-y-4">
				<div>
					<label for="mockUserName" class="block text-sm font-medium text-gray-300 mb-2">
						Name
					</label>
					<input
						type="text"
						id="mockUserName"
						bind:value={newMockUserName}
						required
						class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
						placeholder="e.g., John (visiting)"
					/>
					<p class="text-xs text-gray-400 mt-1">Add a note like "(guest)" or "(visiting)" to remember who they are</p>
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
						on:click={() => (showAddMockUser = false)}
						class="flex-1 bg-dark-200 text-white py-2 px-4 rounded-lg font-semibold hover:bg-dark-100 transition"
					>
						Cancel
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
