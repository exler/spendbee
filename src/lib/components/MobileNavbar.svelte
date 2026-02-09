<script lang="ts">
    import { onMount } from "svelte";
    import { api } from "$lib/api";
    import { notifications, unreadCount } from "$lib/stores/notifications";
    import { logout } from "$lib/stores/auth";

    export let backHref: string | null = null;
    export let backLabel = "Back";
    export let showNotifications = true;
    export let showLogout = true;

    let showNotificationsPanel = false;

    onMount(() => {
        if (!showNotifications) return;
        loadNotifications();
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

    async function acceptInvitation(notificationId: number) {
        try {
            const result = await api.notifications.accept(notificationId);
            await loadNotifications();
            if (result.groupUuid) {
                window.location.href = `/groups/${result.groupUuid}`;
            }
        } catch (e) {
            console.error("Failed to accept invitation:", e);
        }
    }

    async function declineInvitation(notificationId: number) {
        try {
            await api.notifications.decline(notificationId);
            await loadNotifications();
        } catch (e) {
            console.error("Failed to decline invitation:", e);
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

<nav class="lg:hidden sticky top-0 z-40 mb-4 border-b border-dark-100/70 bg-dark-500/95 backdrop-blur">
    <div class="flex items-center justify-between px-4 py-3">
        {#if backHref}
            <a
                href={backHref}
                class="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition"
                aria-label={backLabel}
            >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M15 19l-7-7 7-7"
                    />
                </svg>
                <span>{backLabel}</span>
            </a>
        {:else}
            <a href="/groups" class="inline-flex items-center gap-2">
                <img src="/android-chrome-512x512.png" alt="Spendbee Logo" class="w-8 h-8" />
                <span class="text-base font-semibold">Spendbee</span>
            </a>
        {/if}

        <div class="flex items-center gap-2">
            {#if showNotifications}
                <div class="relative">
                    <button
                        on:click={() => (showNotificationsPanel = !showNotificationsPanel)}
                        class="relative px-3 py-2 bg-dark-200 text-white rounded-lg hover:bg-dark-100 transition"
                        aria-label="Notifications"
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

                    {#if showNotificationsPanel}
                        <div
                            class="absolute right-0 mt-2 w-80 max-w-[90vw] bg-dark-300 rounded-2xl shadow-xl border border-dark-100 z-50 max-h-96 overflow-y-auto"
                        >
                            {#if $notifications.length === 0}
                                <div class="p-4 text-center text-gray-400">No notifications</div>
                            {:else}
                                <div class="divide-y divide-dark-100">
                                    {#each $notifications as notification}
                                        <div
                                            class="p-4 hover:bg-dark-200 {!notification.read ? 'bg-dark-200/50' : ''}"
                                        >
                                            <div class="flex justify-between items-start mb-2">
                                                <h4 class="font-semibold text-white">{notification.title}</h4>
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
            {/if}

            <a
                href="/account"
                class="px-3 py-2 bg-dark-200 text-white rounded-lg hover:bg-dark-100 transition"
                aria-label="Account"
            >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                </svg>
            </a>

            {#if showLogout}
                <button
                    on:click={handleLogout}
                    class="px-3 py-2 bg-dark-200 text-white rounded-lg hover:bg-dark-100 transition text-sm"
                >
                    Logout
                </button>
            {/if}
        </div>
    </div>
</nav>
