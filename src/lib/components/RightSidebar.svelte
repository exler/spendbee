<script lang="ts">
    import { goto } from "$app/navigation";
    import { api } from "$lib/api";
    import { notifications } from "$lib/stores/notifications";

    const currentYear = new Date().getFullYear();

    let showAllNotifications = false;

    $: visibleNotifications = $notifications.slice(0, 3);
    $: remainingNotifications = $notifications.slice(3);

    async function loadNotifications() {
        try {
            const notifs = await api.notifications.list();
            notifications.set(notifs);
        } catch (e) {
            console.error("Failed to load notifications:", e);
        }
    }

    async function acceptInvitation(notificationId: number) {
        try {
            const result = await api.notifications.accept(notificationId);
            await loadNotifications();
            if (result.groupUuid) {
                goto(`/groups/${result.groupUuid}`);
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
</script>

<aside
    class="hidden xl:flex w-80 flex-col rounded-3xl border border-dark-100/70 bg-dark-400/40 backdrop-blur px-5 py-6 mt-6 mb-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
>
    <div class="bg-dark-300/50 p-5 rounded-2xl border border-dark-100/70">
        <div class="flex items-center justify-between text-xs uppercase text-gray-500">
            <span class="tracking-[0.3em]">Notifications</span>
            <span
                class="text-xs font-bold {$notifications.length > 0
                    ? 'bg-primary text-dark'
                    : 'text-gray-500'} rounded-full w-5 h-5 flex items-center justify-center"
            >
                {$notifications.length}
            </span>
        </div>
        {#if $notifications.length > 0}
            <div class="mt-4 space-y-3">
                {#each visibleNotifications as notification}
                    <div class="flex items-start gap-3">
                        <div
                            class="h-9 w-9 rounded-xl bg-dark-200 flex items-center justify-center text-sm font-semibold text-primary"
                        >
                            {notification.title.slice(0, 1).toUpperCase()}
                        </div>
                        <div class="flex-1">
                            <div class="text-sm text-white">{notification.title}</div>
                            <div class="text-xs text-gray-500">{notification.message}</div>
                            {#if notification.type === "group_invite"}
                                <div class="mt-3 flex gap-2">
                                    <button
                                        on:click={() => acceptInvitation(notification.id)}
                                        class="flex-1 bg-primary text-dark py-1 px-3 rounded text-xs font-semibold hover:bg-primary-400 transition"
                                    >
                                        Accept
                                    </button>
                                    <button
                                        on:click={() => declineInvitation(notification.id)}
                                        class="flex-1 bg-dark-100 text-white py-1 px-3 rounded text-xs hover:bg-dark transition"
                                    >
                                        Decline
                                    </button>
                                </div>
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>
            {#if remainingNotifications.length > 0}
                <div class="mt-4 border-t border-dark-100/70 pt-3">
                    <button
                        on:click={() => (showAllNotifications = !showAllNotifications)}
                        class="w-full text-xs uppercase tracking-[0.3em] text-gray-500 hover:text-gray-300 transition"
                    >
                        {showAllNotifications
                            ? "Hide older notifications"
                            : `Show ${remainingNotifications.length} more`}
                    </button>
                    {#if showAllNotifications}
                        <div class="mt-3 space-y-3">
                            {#each remainingNotifications as notification}
                                <div class="flex items-start gap-3">
                                    <div
                                        class="h-9 w-9 rounded-xl bg-dark-200 flex items-center justify-center text-sm font-semibold text-primary"
                                    >
                                        {notification.title.slice(0, 1).toUpperCase()}
                                    </div>
                                    <div class="flex-1">
                                        <div class="text-sm text-white">{notification.title}</div>
                                        <div class="text-xs text-gray-500">{notification.message}</div>
                                        {#if notification.type === "group_invite"}
                                            <div class="mt-3 flex gap-2">
                                                <button
                                                    on:click={() => acceptInvitation(notification.id)}
                                                    class="flex-1 bg-primary text-dark py-1 px-3 rounded text-xs font-semibold hover:bg-primary-400 transition"
                                                >
                                                    Accept
                                                </button>
                                                <button
                                                    on:click={() => declineInvitation(notification.id)}
                                                    class="flex-1 bg-dark-100 text-white py-1 px-3 rounded text-xs hover:bg-dark transition"
                                                >
                                                    Decline
                                                </button>
                                            </div>
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>
            {/if}
        {:else}
            <div class="mt-4 space-y-3 text-sm text-gray-400">
                <div>Nothing in the inbox!</div>
            </div>
        {/if}
    </div>

    <div class="mt-6">
        <slot />
    </div>

    <div class="mt-auto p-2 text-xs text-gray-500 text-center">
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
</aside>
