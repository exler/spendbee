<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { user, logout } from '$lib/stores/auth';
	import { notifications, unreadCount } from '$lib/stores/notifications';
	import { api } from '$lib/api';

	interface Group {
		id: number;
		name: string;
		description: string | null;
		createdBy: number;
		createdAt: Date;
	}

	let groups: Group[] = [];
	let loading = true;
	let showCreateModal = false;
	let showNotifications = false;
	let newGroupName = '';
	let newGroupDescription = '';
	let newGroupCurrency = 'EUR';
	let error = '';
	let supportedCurrencies: string[] = [];

	onMount(() => {
		if (!$user) {
			goto('/login');
			return;
		}
		loadGroups();
		loadCurrencies();
		loadNotifications();

		// Poll for notifications every 30 seconds
		const interval = setInterval(loadNotifications, 30000);
		return () => clearInterval(interval);
	});

	async function loadNotifications() {
		try {
			const [notifs, count] = await Promise.all([
				api.notifications.list(),
				api.notifications.unreadCount(),
			]);
			notifications.set(notifs);
			unreadCount.set(count.count);
		} catch (e) {
			console.error('Failed to load notifications:', e);
		}
	}

	async function loadCurrencies() {
		try {
			const response = await api.groups.currencies();
			supportedCurrencies = response.currencies;
		} catch (e) {
			console.error('Failed to load currencies:', e);
		}
	}

	async function loadGroups() {
		try {
			groups = await api.groups.list();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load groups';
		} finally {
			loading = false;
		}
	}

	async function createGroup() {
		if (!newGroupName) return;

		try {
			await api.groups.create({
				name: newGroupName,
				description: newGroupDescription || undefined,
				baseCurrency: newGroupCurrency,
			});
			newGroupName = '';
			newGroupDescription = '';
			newGroupCurrency = 'EUR';
			showCreateModal = false;
			loadGroups();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to create group';
		}
	}

	async function acceptInvitation(notificationId: number) {
		try {
			const result = await api.notifications.accept(notificationId);
			await loadNotifications();
			await loadGroups();
			if (result.groupId) {
				goto(`/groups/${result.groupId}`);
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to accept invitation';
		}
	}

	async function declineInvitation(notificationId: number) {
		try {
			await api.notifications.decline(notificationId);
			await loadNotifications();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to decline invitation';
		}
	}

	async function markAsRead(notificationId: number) {
		try {
			await api.notifications.markAsRead(notificationId);
			await loadNotifications();
		} catch (e) {
			console.error('Failed to mark as read:', e);
		}
	}

	function handleLogout() {
		logout();
		goto('/');
	}
</script>

<svelte:head>
	<title>Groups - Spendbee</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-b from-dark to-dark-300">
	<div class="max-w-4xl mx-auto p-4">
		<div class="flex items-center justify-between mb-8 pt-4">
			<div>
				<h1 class="text-3xl font-bold text-primary">🐝 Spendbee</h1>
				<p class="text-gray-300">Welcome, {$user?.name}</p>
			</div>
			<div class="flex items-center gap-3">
				<div class="relative">
					<button
						on:click={() => (showNotifications = !showNotifications)}
						class="relative px-4 py-2 bg-dark-200 text-white rounded-lg hover:bg-dark-100 transition"
					>
						🔔
						{#if $unreadCount > 0}
							<span
								class="absolute -top-1 -right-1 bg-primary text-dark text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
							>
								{$unreadCount}
							</span>
						{/if}
					</button>

					{#if showNotifications}
						<div
							class="absolute right-0 mt-2 w-96 bg-dark-300 rounded-lg shadow-xl border border-dark-100 z-50 max-h-96 overflow-y-auto"
						>
							{#if $notifications.length === 0}
								<div class="p-4 text-center text-gray-400">No notifications</div>
							{:else}
								<div class="divide-y divide-dark-100">
									{#each $notifications as notification}
										<div
											class="p-4 hover:bg-dark-200 {!notification.read
												? 'bg-dark-200/50'
												: ''}"
										>
											<div class="flex justify-between items-start mb-2">
												<h4 class="font-semibold text-white">
													{notification.title}
												</h4>
												{#if !notification.read}
													<button
														on:click={() => markAsRead(notification.id)}
														class="text-xs text-primary hover:text-primary-400"
													>
														Mark read
													</button>
												{/if}
											</div>
											<p class="text-sm text-gray-300 mb-3">
												{notification.message}
											</p>
											{#if notification.type === 'group_invite'}
												<div class="flex gap-2">
													<button
														on:click={() =>
															acceptInvitation(notification.id)}
														class="flex-1 bg-primary text-dark py-1 px-3 rounded text-sm font-semibold hover:bg-primary-400 transition"
													>
														Accept
													</button>
													<button
														on:click={() =>
															declineInvitation(notification.id)}
														class="flex-1 bg-dark-100 text-white py-1 px-3 rounded text-sm hover:bg-dark transition"
													>
														Decline
													</button>
												</div>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</div>
				<button
					on:click={handleLogout}
					class="px-4 py-2 bg-dark-200 text-white rounded-lg hover:bg-dark-100 transition"
				>
					Logout
				</button>
			</div>
		</div>

		{#if error}
			<div class="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded mb-4">
				{error}
			</div>
		{/if}

		<div class="mb-6">
			<h2 class="text-2xl font-bold text-white mb-4">Your Groups</h2>
			<div class="flex gap-2 mb-4">
				<button
					on:click={() => (showCreateModal = true)}
					class="w-full bg-primary text-dark py-3 px-6 rounded-lg font-semibold hover:bg-primary-400 transition"
				>
					Create Group
				</button>
			</div>
		</div>

		{#if loading}
			<div class="text-center py-12">
				<div class="text-gray-400">Loading groups...</div>
			</div>
		{:else if groups.length === 0}
			<div class="text-center py-12 bg-dark-300 rounded-lg">
				<p class="text-gray-400">You haven't joined any groups yet.</p>
				<p class="text-gray-400">Create or join a group to get started!</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#each groups as group}
					<a
						href="/groups/{group.id}"
						class="block bg-dark-300 p-4 rounded-lg hover:bg-dark-200 transition border border-dark-100 hover:border-primary"
					>
						<h3 class="text-xl font-semibold text-white">{group.name}</h3>
						{#if group.description}
							<p class="text-gray-400 mt-1">{group.description}</p>
						{/if}
					</a>
				{/each}
			</div>
		{/if}
	</div>
</div>

{#if showCreateModal}
	<div class="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
		<div class="bg-dark-300 p-6 rounded-lg max-w-md w-full">
			<h3 class="text-2xl font-bold text-white mb-4">Create Group</h3>
			<form on:submit|preventDefault={createGroup} class="space-y-4">
				<div>
					<label for="groupName" class="block text-sm font-medium text-gray-300 mb-2">
						Group Name
					</label>
					<input
						type="text"
						id="groupName"
						bind:value={newGroupName}
						required
						class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
						placeholder="e.g., Roommates, Trip to Paris"
					/>
				</div>
				<div>
					<label for="groupDesc" class="block text-sm font-medium text-gray-300 mb-2">
						Description (optional)
					</label>
					<textarea
						id="groupDesc"
						bind:value={newGroupDescription}
						rows="3"
						class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
						placeholder="What is this group for?"
					></textarea>
				</div>
				<div>
					<label for="groupCurrency" class="block text-sm font-medium text-gray-300 mb-2">
						Base Currency
					</label>
					<select
						id="groupCurrency"
						bind:value={newGroupCurrency}
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
						Create
					</button>
					<button
						type="button"
						on:click={() => (showCreateModal = false)}
						class="flex-1 bg-dark-200 text-white py-2 px-4 rounded-lg font-semibold hover:bg-dark-100 transition"
					>
						Cancel
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
