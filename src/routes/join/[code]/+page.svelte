<script lang="ts">
    import { resolve } from "$app/paths";
    import type { PageData } from "./$types";

    const { data } = $props<{ data: PageData }>();

    const loginHref = $derived(
        resolve(`/login?redirect=${encodeURIComponent(`/join/${data.shareCode}`)}`),
    );
    const registerHref = $derived(
        resolve(`/register?share=${encodeURIComponent(data.shareCode)}`),
    );
</script>

<svelte:head>
    <title>Join {data.group.name} - Spendbee</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center p-4 bg-dark-500">
    <div class="w-full max-w-lg">
        <div class="text-center mb-8">
            <a href={resolve("/")} class="inline-block">
                <img src="/android-chrome-512x512.png" alt="Spendbee Logo" class="w-28 h-28 mx-auto" />
            </a>
            <h1 class="text-3xl font-semibold text-white mt-4">Join {data.group.name}</h1>
            <p class="text-sm text-gray-400 mt-2">
                {data.group.description || "Accept the invite to start tracking shared expenses."}
            </p>
        </div>

        <div class="bg-dark-300 p-6 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.35)] space-y-5 border border-dark-100">
            <div class="bg-dark-200/70 border border-dark-100 text-gray-200 p-4 rounded-lg text-sm">
                You were invited to join this group. Sign in or create an account to continue.
            </div>

            <div class="grid gap-3">
                <a
                    href={loginHref}
                    class="w-full text-center bg-primary text-dark py-3 px-6 rounded-xl font-semibold hover:bg-primary-400 transition"
                >
                    Login to Join
                </a>
                <a
                    href={registerHref}
                    class="w-full text-center border border-dark-100 bg-dark-200/80 py-3 px-6 rounded-xl font-semibold text-white hover:bg-dark-100 transition"
                >
                    Create Account
                </a>
            </div>
        </div>
    </div>
</div>
