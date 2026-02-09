<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { user } from "$lib/stores/auth";
    import { api } from "$lib/api";
    import LeftSidebar from "$lib/components/LeftSidebar.svelte";
    import RightSidebar from "$lib/components/RightSidebar.svelte";
    import MobileNavbar from "$lib/components/MobileNavbar.svelte";

    interface Group {
        id: number;
        uuid: string;
        name: string;
        description: string | null;
        createdBy: number;
        createdAt: Date;
        archived?: boolean;
        userBalance?: number;
        baseCurrency?: string;
        imageUrl?: string | null;
    }

    let groups: Group[] = [];
    let loading = true;
    let showCreateModal = false;
    let showArchivedGroups = false;
    let newGroupName = "";
    let newGroupDescription = "";
    let newGroupCurrency = "EUR";
    let error = "";
    let supportedCurrencies: string[] = [];

    onMount(() => {
        if (!$user) {
            goto("/login");
            return;
        }
        loadGroups();
        loadCurrencies();
    });

    async function loadCurrencies() {
        try {
            const response = await api.groups.currencies();
            supportedCurrencies = response.currencies;
        } catch (e) {
            console.error("Failed to load currencies:", e);
        }
    }

    async function loadGroups() {
        try {
            groups = await api.groups.list(showArchivedGroups);
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to load groups";
        } finally {
            loading = false;
        }
    }

    $: if (showArchivedGroups !== undefined) {
        loadGroups();
    }

    async function createGroup() {
        if (!newGroupName) return;

        try {
            await api.groups.create({
                name: newGroupName,
                description: newGroupDescription || undefined,
                baseCurrency: newGroupCurrency,
            });
            newGroupName = "";
            newGroupDescription = "";
            newGroupCurrency = "EUR";
            showCreateModal = false;
            loadGroups();
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to create group";
        }
    }
</script>

<svelte:head>
    <title>Groups - Spendbee</title>
</svelte:head>

<div class="min-h-screen bg-dark-500 text-white">
    <div class="max-w-7xl mx-auto px-4 pb-12">
        <div class="flex min-h-screen gap-6">
            <LeftSidebar active="groups">
                <div class="rounded-2xl border border-dark-100/70 bg-dark-300/50 p-4">
                    <div class="text-xs uppercase tracking-[0.2em] text-gray-500">Quick actions</div>
                    <button
                        on:click={() => (showCreateModal = true)}
                        class="mt-4 w-full rounded-lg bg-primary text-dark py-2 text-sm font-semibold hover:bg-primary-400"
                    >
                        Create group
                    </button>
                </div>
            </LeftSidebar>

            <main class="flex-1">
                <MobileNavbar />

                <div
                    class="my-6 rounded-3xl border border-dark-100/70 bg-dark-300/55 p-6 shadow-[0_0_30px_rgba(0,0,0,0.25)]"
                >
                    <div class="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <div class="text-sm text-gray-400">Welcome back</div>
                            <div class="text-2xl font-semibold">{$user?.name}</div>
                        </div>
                        <div class="flex w-full flex-wrap items-center gap-3">
                            <a
                                href="/activity"
                                class="flex-1 bg-dark-200 text-white py-3 px-6 rounded-xl font-semibold hover:bg-dark-100 transition text-center"
                            >
                                View Activity
                            </a>
                            <button
                                on:click={() => (showCreateModal = true)}
                                class="flex-1 bg-primary text-dark py-3 px-6 rounded-xl font-semibold hover:bg-primary-400 transition"
                            >
                                Create Group
                            </button>
                        </div>
                    </div>
                </div>

                {#if error}
                    <div class="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded mb-4">
                        {error}
                    </div>
                {/if}

                <div class="flex items-center gap-2 mb-4">
                    <input
                        type="checkbox"
                        id="showArchived"
                        bind:checked={showArchivedGroups}
                        class="w-4 h-4 bg-dark-200 border border-dark-100 rounded text-primary focus:ring-primary"
                    />
                    <label for="showArchived" class="text-sm text-gray-300 cursor-pointer">
                        Show archived groups
                    </label>
                </div>

                {#if loading}
                    <div class="text-center py-12">
                        <div class="text-gray-400">Loading groups...</div>
                    </div>
                {:else if groups.length === 0}
                    <div class="text-center py-12 bg-dark-300 rounded-2xl border border-dark-100">
                        <p class="text-gray-400">You haven't joined any groups yet.</p>
                        <p class="text-gray-400">Create or join a group to get started!</p>
                    </div>
                {:else}
                    <div class="grid gap-6">
                        <div class="grid gap-4 md:grid-cols-2">
                            {#each groups as group}
                                <a
                                    href="/groups/{group.uuid}"
                                    class="block bg-dark-300/70 p-5 rounded-2xl hover:border-primary/50 transition border border-dark-100/70 {group.archived
                                        ? 'opacity-60'
                                        : ''}"
                                >
                                    <div class="flex items-start gap-4">
                                        {#if group.imageUrl}
                                            <img
                                                src={`/api/receipts/view/${encodeURIComponent(group.imageUrl)}`}
                                                alt="Group image"
                                                class="h-12 w-12 rounded-2xl object-cover border border-dark-100"
                                            />
                                        {:else}
                                            <div
                                                class="h-12 w-12 rounded-2xl bg-primary text-dark flex items-center justify-center text-xl font-bold"
                                            >
                                                {group.name?.slice(0, 1) || "G"}
                                            </div>
                                        {/if}
                                        <div class="flex-1">
                                            <div class="flex items-center gap-2">
                                                <h3 class="text-xl font-semibold text-white">{group.name}</h3>
                                                {#if group.archived}
                                                    <span
                                                        class="text-[10px] uppercase tracking-[0.2em] bg-dark-100 text-gray-400 px-2 py-1 rounded-full"
                                                    >
                                                        Archived
                                                    </span>
                                                {/if}
                                            </div>
                                            {#if group.description}
                                                <p class="text-gray-400 mt-1">{group.description}</p>
                                            {/if}
                                            {#if group.userBalance !== undefined}
                                                <div class="mt-4 text-sm">
                                                    {#if Math.abs(group.userBalance) >= 0.01}
                                                        {#if group.userBalance > 0}
                                                            <div class="text-gray-500">you are owed</div>
                                                            <div class="text-lg font-semibold text-green-400">
                                                                +{group.userBalance.toFixed(2)}
                                                                {group.baseCurrency || "EUR"}
                                                            </div>
                                                        {:else}
                                                            <div class="text-gray-500">you owe</div>
                                                            <div class="text-lg font-semibold text-red-400">
                                                                {group.userBalance.toFixed(2)}
                                                                {group.baseCurrency || "EUR"}
                                                            </div>
                                                        {/if}
                                                    {:else}
                                                        <div class="text-sm font-semibold text-gray-400">
                                                            All settled up
                                                        </div>
                                                    {/if}
                                                </div>
                                            {/if}
                                        </div>
                                    </div>
                                </a>
                            {/each}
                        </div>
                    </div>
                {/if}
            </main>

            <RightSidebar />
        </div>
    </div>
</div>

{#if showCreateModal}
    <div class="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
        <div class="bg-dark-300 p-6 rounded-lg max-w-md w-full">
            <h3 class="text-2xl font-bold text-white mb-4">Create Group</h3>
            <form on:submit|preventDefault={createGroup} class="space-y-4">
                <div>
                    <label for="groupName" class="block text-sm font-medium text-gray-300 mb-2"> Group Name </label>
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
