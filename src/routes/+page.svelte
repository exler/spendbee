<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { user } from "$lib/stores/auth";

    onMount(() => {
        if ($user) {
            goto("/groups");
        }
    });
</script>

<svelte:head>
    <title>Spendbee - Split bills with friends</title>
</svelte:head>

<div class="min-h-screen flex flex-col items-center justify-center p-4 bg-dark-500">
    <div class="max-w-4xl w-full grid gap-8 lg:grid-cols-[1.1fr_0.9fr] items-center">
        <div class="space-y-6">
            <div class="flex items-center gap-4">
                <img src="/logo-1024x1024.png" alt="Spendbee Logo" class="w-24 h-24" />
                <div>
                    <h1 class="text-4xl font-bold text-white">Spendbee</h1>
                    <p class="text-gray-400">Split bills and track expenses with friends</p>
                </div>
            </div>
            <div class="rounded-3xl border border-dark-100 bg-dark-300/80 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
                <h2 class="text-2xl font-semibold text-white">Your shared money hub</h2>
                <p class="text-gray-400 mt-2">
                    Track expenses, settle balances, and keep every group on the same page.
                </p>
                <div class="mt-6 grid gap-3 sm:grid-cols-2">
                    <a
                        href="/login"
                        class="block w-full bg-primary text-dark py-3 px-6 rounded-xl font-semibold hover:bg-primary-400 transition text-center"
                    >
                        Login
                    </a>
                    <a
                        href="/register"
                        class="block w-full bg-dark-200 text-white py-3 px-6 rounded-xl font-semibold hover:bg-dark-100 transition border border-primary text-center"
                    >
                        Register
                    </a>
                </div>
            </div>
        </div>

        <div class="bg-dark-300/80 border border-dark-100 rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <div class="text-xs uppercase tracking-[0.3em] text-gray-500">What you get</div>
            <h3 class="text-2xl font-semibold text-white mt-2">Features</h3>
            <ul class="space-y-4 text-gray-300 mt-6">
                <li class="flex items-start gap-3">
                    <div class="h-10 w-10 rounded-xl bg-primary text-dark flex items-center justify-center font-bold">
                        1
                    </div>
                    <div>
                        <div class="text-white font-semibold">Create and join groups</div>
                        <div class="text-sm text-gray-400">Invite friends and collaborators instantly.</div>
                    </div>
                </li>
                <li class="flex items-start gap-3">
                    <div class="h-10 w-10 rounded-xl bg-primary text-dark flex items-center justify-center font-bold">
                        2
                    </div>
                    <div>
                        <div class="text-white font-semibold">Track expenses effortlessly</div>
                        <div class="text-sm text-gray-400">Split equally or customize every share.</div>
                    </div>
                </li>
                <li class="flex items-start gap-3">
                    <div class="h-10 w-10 rounded-xl bg-primary text-dark flex items-center justify-center font-bold">
                        3
                    </div>
                    <div>
                        <div class="text-white font-semibold">See balances at a glance</div>
                        <div class="text-sm text-gray-400">Know who owes what in seconds.</div>
                    </div>
                </li>
                <li class="flex items-start gap-3">
                    <div class="h-10 w-10 rounded-xl bg-primary text-dark flex items-center justify-center font-bold">
                        4
                    </div>
                    <div>
                        <div class="text-white font-semibold">Settle up quickly</div>
                        <div class="text-sm text-gray-400">Record payments and close the loop.</div>
                    </div>
                </li>
            </ul>
        </div>
    </div>
</div>
