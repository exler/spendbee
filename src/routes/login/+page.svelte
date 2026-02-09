<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { user } from "$lib/stores/auth";
    import { api } from "$lib/api";

    let email = "";
    let password = "";
    let error = "";
    let loading = false;

    async function handleLogin() {
        error = "";
        loading = true;

        try {
            const response = await api.auth.login({ email, password });
            user.set(response.user);

            // Check if there's a redirect URL (e.g., from invitation email)
            const redirectUrl = $page.url.searchParams.get("redirect");
            if (redirectUrl) {
                goto(redirectUrl);
            } else {
                goto("/groups");
            }
        } catch (e) {
            error = e instanceof Error ? e.message : "Login failed";
        } finally {
            loading = false;
        }
    }
</script>

<svelte:head>
    <title>Login - Spendbee</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center p-4 bg-dark-500">
    <div class="w-full max-w-md">
        <div class="text-center mb-8">
            <a href="/" class="inline-block">
                <img src="/android-chrome-512x512.png" alt="Spendbee Logo" class="w-28 h-28 mx-auto" />
            </a>
            <h2 class="text-3xl font-semibold text-white mt-4">Welcome back</h2>
            <p class="text-sm text-gray-400 mt-2">Sign in to track shared expenses.</p>
        </div>

        <form
            on:submit|preventDefault={handleLogin}
            class="bg-dark-300 p-6 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.35)] space-y-4 border border-dark-100"
        >
            {#if error}
                <div class="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded">
                    {error}
                </div>
            {/if}

            <div>
                <label for="email" class="block text-sm font-medium text-gray-300 mb-2"> Email </label>
                <input
                    type="email"
                    id="email"
                    bind:value={email}
                    required
                    class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
                    placeholder="your@email.com"
                />
            </div>

            <div>
                <label for="password" class="block text-sm font-medium text-gray-300 mb-2"> Password </label>
                <input
                    type="password"
                    id="password"
                    bind:value={password}
                    required
                    class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
                    placeholder="••••••••"
                />
            </div>

            <button
                type="submit"
                disabled={loading}
                class="w-full bg-primary text-dark py-3 px-6 rounded-xl font-semibold hover:bg-primary-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? "Logging in..." : "Login"}
            </button>

            <div class="rounded-xl bg-dark-200/70 p-3 text-sm text-gray-400">
                Invitation-only access. Ask an existing member to invite you.
            </div>
        </form>
    </div>
</div>
