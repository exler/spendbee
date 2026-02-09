<script lang="ts">
    import { user, logout } from "$lib/stores/auth";

    export let active: "groups" | "activity" | "account" = "groups";

    let avatarPreviewUrl: string | null = null;

    $: {
        const userAvatar = ($user as { avatarUrl?: string | null } | null)?.avatarUrl;
        avatarPreviewUrl = userAvatar ? `/api/receipts/view/${encodeURIComponent(userAvatar)}` : null;
    }
</script>

<aside
    class="hidden lg:flex w-80 flex-col rounded-3xl border border-dark-100/70 bg-dark-400/40 backdrop-blur px-5 py-6 mt-6 mb-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
>
    <a href="/groups" class="inline-flex items-center gap-3">
        <img src="/android-chrome-512x512.png" alt="Spendbee Logo" class="w-10 h-10" />
        <span class="text-xl font-semibold">Spendbee</span>
    </a>
    <div class="mt-8 space-y-1 text-sm">
        <a
            href="/groups"
            class="flex items-center gap-2 rounded-lg px-3 py-2 {active === 'groups'
                ? 'text-white bg-dark-300/70'
                : 'text-gray-200 hover:bg-dark-300/70'}"
        >
            Dashboard
        </a>
        <a
            href="/activity"
            class="flex items-center gap-2 rounded-lg px-3 py-2 {active === 'activity'
                ? 'text-white bg-dark-300/70'
                : 'text-gray-200 hover:bg-dark-300/70'}"
        >
            Recent activity
        </a>
        <a
            href="/account"
            class="flex items-center gap-2 rounded-lg px-3 py-2 {active === 'account'
                ? 'text-white bg-dark-300/70'
                : 'text-gray-200 hover:bg-dark-300/70'}"
        >
            Account
        </a>
    </div>

    <div class="mt-10 space-y-4">
        <slot />
    </div>

    <div class="mt-auto">
        <div class="bg-dark-300/50 p-5 rounded-2xl border border-dark-100/70">
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
                    <button
                        on:click={() => logout()}
                        class="mt-3 w-full rounded-lg border border-dark-100/70 px-3 py-2 text-xs uppercase tracking-[0.25em] text-gray-300 hover:bg-dark-200/70 hover:text-white transition"
                    >
                        Logout
                    </button>
                </div>
            </div>
        </div>
        <div class="mt-6 text-xs text-gray-500 text-center">Split smarter together.</div>
    </div>
</aside>
