<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { user, logout } from "$lib/stores/auth";
    import { notifications, unreadCount } from "$lib/stores/notifications";
    import { api } from "$lib/api";

    const currentYear = new Date().getFullYear();

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
    let showNotifications = false;
    let showArchivedGroups = false;
    let newGroupName = "";
    let newGroupDescription = "";
    let newGroupCurrency = "EUR";
    let error = "";
    let supportedCurrencies: string[] = [];

    let avatarPreviewUrl: string | null = null;

    $: {
        const userAvatar = ($user as { avatarUrl?: string | null } | null)?.avatarUrl;
        avatarPreviewUrl = userAvatar ? `/api/receipts/view/${encodeURIComponent(userAvatar)}` : null;
    }

    onMount(() => {
        if (!$user) {
            goto("/login");
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
            const [notifs, count] = await Promise.all([api.notifications.list(), api.notifications.unreadCount()]);
            notifications.set(notifs);
            unreadCount.set(count.count);
        } catch (e) {
            console.error("Failed to load notifications:", e);
        }
    }

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

    async function acceptInvitation(notificationId: number) {
        try {
            const result = await api.notifications.accept(notificationId);
            await loadNotifications();
            await loadGroups();
            if (result.groupUuid) {
                goto(`/groups/${result.groupUuid}`);
            }
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to accept invitation";
        }
    }

    async function declineInvitation(notificationId: number) {
        try {
            await api.notifications.decline(notificationId);
            await loadNotifications();
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to decline invitation";
        }
    }

    async function markAsRead(notificationId: number) {
        try {
            await api.notifications.markAsRead(notificationId);
            await loadNotifications();
        } catch (e) {
            console.error("Failed to mark as read:", e);
        }
    }

    function handleLogout() {
        logout();
    }
</script>

<svelte:head>
    <title>Groups - Spendbee</title>
</svelte:head>

<div class="min-h-screen bg-dark-500 text-white">
    <div class="max-w-6xl mx-auto px-4 pb-12">
        <div class="flex min-h-screen gap-6">
            <aside
                class="hidden lg:flex w-64 flex-col rounded-3xl border border-dark-100/70 bg-dark-400/40 backdrop-blur px-5 py-6 mt-6 mb-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
            >
                <a href="/groups" class="inline-flex items-center gap-3">
                    <img src="/android-chrome-512x512.png" alt="Spendbee Logo" class="w-10 h-10" />
                    <span class="text-xl font-semibold">Spendbee</span>
                </a>
                <div class="mt-8 space-y-1 text-sm">
                    <a
                        href="/groups"
                        class="flex items-center gap-2 rounded-lg px-3 py-2 text-gray-200 hover:bg-dark-300/70"
                    >
                        Dashboard
                    </a>
                    <a
                        href="/activity"
                        class="flex items-center gap-2 rounded-lg px-3 py-2 text-gray-200 hover:bg-dark-300/70"
                    >
                        Recent activity
                    </a>
                    <a
                        href="/account"
                        class="flex items-center gap-2 rounded-lg px-3 py-2 text-gray-200 hover:bg-dark-300/70"
                    >
                        Account
                    </a>
                </div>
                <div class="mt-10 rounded-2xl border border-dark-100/70 bg-dark-300/50 p-4">
                    <div class="text-xs uppercase tracking-[0.2em] text-gray-500">Quick actions</div>
                    <button
                        on:click={() => (showCreateModal = true)}
                        class="mt-4 w-full rounded-lg bg-primary text-dark py-2 text-sm font-semibold hover:bg-primary-400"
                    >
                        Create group
                    </button>
                </div>
                <div class="mt-auto text-xs text-gray-500">Split smarter together.</div>
            </aside>

            <main class="flex-1">
                <div class="pt-6 mb-6 flex items-center justify-between">
                    <a href="/groups" class="inline-flex items-center gap-3 hover:opacity-80 transition">
                        <img src="/android-chrome-512x512.png" alt="Spendbee Logo" class="w-10 h-10" />
                        <span class="text-2xl font-semibold">Spendbee</span>
                    </a>
                    <div class="flex items-center gap-3">
                        <div class="relative">
                            <button
                                on:click={() => (showNotifications = !showNotifications)}
                                class="relative px-3 py-2 bg-dark-200 text-white rounded-lg hover:bg-dark-100 transition"
                            >
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                                    />
                                </svg>
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
                                    class="absolute right-0 mt-2 w-96 bg-dark-300 rounded-2xl shadow-xl border border-dark-100 z-50 max-h-96 overflow-y-auto"
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
                                                    {#if notification.type === "group_invite"}
                                                        <div class="flex gap-2">
                                                            <button
                                                                on:click={() => acceptInvitation(notification.id)}
                                                                class="flex-1 bg-primary text-dark py-1 px-3 rounded text-sm font-semibold hover:bg-primary-400 transition"
                                                            >
                                                                Accept
                                                            </button>
                                                            <button
                                                                on:click={() => declineInvitation(notification.id)}
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

                <div
                    class="mb-6 rounded-3xl border border-dark-100/70 bg-dark-300/55 p-6 shadow-[0_0_30px_rgba(0,0,0,0.25)]"
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

                <div class="mt-12 pt-6 border-t border-dark-100 text-center text-sm text-gray-400">
                    <p>
                        &copy; {currentYear} Kamil Marut
                        <span class="mx-2">•</span>
                        <a
                            href="https://github.com/exler/spendbee"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-primary hover:text-primary-400 transition"
                        >
                            GitHub
                        </a>
                    </p>
                </div>
            </main>

            <aside
                class="hidden xl:flex w-80 flex-col rounded-3xl border border-dark-100/70 bg-dark-400/40 backdrop-blur px-5 py-6 mt-6 mb-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
            >
                <div class="bg-dark-300/50 p-5 rounded-2xl border border-dark-100/70">
                    <div class="text-xs uppercase tracking-[0.3em] text-gray-500">Recent activity</div>
                    {#if $notifications.length > 0}
                        <div class="mt-4 space-y-3">
                            {#each $notifications.slice(0, 4) as notification}
                                <div class="flex items-start gap-3">
                                    <div
                                        class="h-9 w-9 rounded-xl bg-dark-200 flex items-center justify-center text-sm font-semibold text-primary"
                                    >
                                        {notification.title.slice(0, 1).toUpperCase()}
                                    </div>
                                    <div class="flex-1">
                                        <div class="text-sm text-white">{notification.title}</div>
                                        <div class="text-xs text-gray-500">{notification.message}</div>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {:else}
                        <div class="mt-4 space-y-3 text-sm text-gray-400">
                            <div>Activity feed will show new expenses and settlements here.</div>
                            <div>Invite friends to start seeing updates.</div>
                        </div>
                    {/if}
                </div>

                <div class="mt-6 bg-dark-300/50 p-5 rounded-2xl border border-dark-100/70">
                    <div class="text-xs uppercase tracking-[0.3em] text-gray-500">Account</div>
                    <div class="mt-4 flex items-center gap-3">
                        {#if avatarPreviewUrl}
                            <img
                                src={avatarPreviewUrl}
                                alt="Account avatar"
                                class="h-12 w-12 rounded-2xl object-cover border border-dark-100"
                            />
                        {:else}
                            <div
                                class="h-12 w-12 rounded-2xl bg-primary text-dark flex items-center justify-center text-lg font-bold"
                            >
                                {$user?.name?.slice(0, 1) || "U"}
                            </div>
                        {/if}
                        <div>
                            <div class="text-lg font-semibold text-white">{$user?.name}</div>
                            <div class="text-sm text-gray-400">{$user?.email || "Signed in"}</div>
                        </div>
                    </div>
                    <div class="mt-4 grid gap-2">
                        <button
                            class="w-full rounded-lg border border-dark-100/70 px-3 py-2 text-sm text-gray-200 hover:bg-dark-200/70"
                            disabled
                        >
                            Manage profile (coming soon)
                        </button>
                        <button
                            class="w-full rounded-lg border border-dark-100/70 px-3 py-2 text-sm text-gray-200 hover:bg-dark-200/70"
                            disabled
                        >
                            Notification settings (coming soon)
                        </button>
                    </div>
                </div>
            </aside>
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
