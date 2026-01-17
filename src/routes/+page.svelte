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

<div class="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-dark to-dark-300">
    <div class="text-center max-w-md w-full">
        <div class="mb-8">
            <h1 class="text-6xl font-bold text-primary mb-2">🐝</h1>
            <h2 class="text-4xl font-bold text-primary mb-2">Spendbee</h2>
            <p class="text-gray-300">Split bills and track expenses with friends</p>
        </div>

        <div class="space-y-4">
            <a
                href="/login"
                class="block w-full bg-primary text-dark py-3 px-6 rounded-lg font-semibold hover:bg-primary-400 transition"
            >
                Login
            </a>
            <a
                href="/register"
                class="block w-full bg-dark-200 text-white py-3 px-6 rounded-lg font-semibold hover:bg-dark-100 transition border border-primary"
            >
                Register
            </a>
        </div>

        <div class="mt-12 space-y-4 text-left bg-dark-300 p-6 rounded-lg">
            <h3 class="text-xl font-semibold text-primary">Features</h3>
            <ul class="space-y-2 text-gray-300">
                <li class="flex items-start">
                    <span class="text-primary mr-2">✓</span>
                    <span>Create and join groups with friends</span>
                </li>
                <li class="flex items-start">
                    <span class="text-primary mr-2">✓</span>
                    <span>Track expenses and split bills easily</span>
                </li>
                <li class="flex items-start">
                    <span class="text-primary mr-2">✓</span>
                    <span>See who owes what at a glance</span>
                </li>
                <li class="flex items-start">
                    <span class="text-primary mr-2">✓</span>
                    <span>Record payments to settle debts</span>
                </li>
            </ul>
        </div>
    </div>
</div>
