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
            <img src="/logo-1024x1024.png" alt="Spendbee Logo" class="w-48 h-48 mx-auto mb-4" />
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
                    <svg class="w-5 h-5 text-primary mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Create and join groups with friends</span>
                </li>
                <li class="flex items-start">
                    <svg class="w-5 h-5 text-primary mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Track expenses and split bills easily</span>
                </li>
                <li class="flex items-start">
                    <svg class="w-5 h-5 text-primary mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>See who owes what at a glance</span>
                </li>
                <li class="flex items-start">
                    <svg class="w-5 h-5 text-primary mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Record payments to settle debts</span>
                </li>
            </ul>
        </div>
    </div>
</div>
