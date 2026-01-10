<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { user, logout } from '$lib/stores/auth';
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
	let showJoinModal = false;
	let newGroupName = '';
	let newGroupDescription = '';
	let joinGroupId = '';
	let error = '';

	onMount(() => {
		if (!$user) {
			goto('/login');
			return;
		}
		loadGroups();
	});

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
			});
			newGroupName = '';
			newGroupDescription = '';
			showCreateModal = false;
			loadGroups();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to create group';
		}
	}

	async function joinGroup() {
		if (!joinGroupId) return;

		try {
			await api.groups.join(parseInt(joinGroupId));
			joinGroupId = '';
			showJoinModal = false;
			loadGroups();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to join group';
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
			<button
				on:click={handleLogout}
				class="px-4 py-2 bg-dark-200 text-white rounded-lg hover:bg-dark-100 transition"
			>
				Logout
			</button>
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
					class="flex-1 bg-primary text-dark py-3 px-6 rounded-lg font-semibold hover:bg-primary-400 transition"
				>
					Create Group
				</button>
				<button
					on:click={() => (showJoinModal = true)}
					class="flex-1 bg-dark-200 text-white py-3 px-6 rounded-lg font-semibold hover:bg-dark-100 transition border border-primary"
				>
					Join Group
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

{#if showJoinModal}
	<div class="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
		<div class="bg-dark-300 p-6 rounded-lg max-w-md w-full">
			<h3 class="text-2xl font-bold text-white mb-4">Join Group</h3>
			<form on:submit|preventDefault={joinGroup} class="space-y-4">
				<div>
					<label for="groupId" class="block text-sm font-medium text-gray-300 mb-2">
						Group ID
					</label>
					<input
						type="number"
						id="groupId"
						bind:value={joinGroupId}
						required
						class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
						placeholder="Enter group ID"
					/>
					<p class="text-xs text-gray-400 mt-1">Ask the group creator for the ID</p>
				</div>
				<div class="flex gap-2">
					<button
						type="submit"
						class="flex-1 bg-primary text-dark py-2 px-4 rounded-lg font-semibold hover:bg-primary-400 transition"
					>
						Join
					</button>
					<button
						type="button"
						on:click={() => (showJoinModal = false)}
						class="flex-1 bg-dark-200 text-white py-2 px-4 rounded-lg font-semibold hover:bg-dark-100 transition"
					>
						Cancel
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
