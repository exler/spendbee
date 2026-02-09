<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { user } from "$lib/stores/auth";
    import LeftSidebar from "$lib/components/LeftSidebar.svelte";
    import MobileNavbar from "$lib/components/MobileNavbar.svelte";

    interface ActivityItem {
        id: number;
        type: string;
        groupUuid?: string;
        groupName: string;
        title: string;
        detail: string;
        amount?: number | null;
        currency?: string | null;
        createdAt: Date;
        dateLabel: string;
    }

    let activities: ActivityItem[] = [];
    let loading = true;
    let error = "";

    onMount(() => {
        if (!$user) {
            goto("/login");
            return;
        }
        loadActivity();
    });

    async function loadActivity() {
        loading = true;
        try {
            const response = await fetch("/api/activity?limit=120", {
                credentials: "include",
            });

            if (!response.ok) {
                const errorResponse = await response.json();
                throw new Error(errorResponse.error || "Request failed");
            }

            const data = await response.json();
            activities = data.activities || [];
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to load activity";
        } finally {
            loading = false;
        }
    }

    function iconFor(type: string) {
        if (type.startsWith("settlement")) return "settlement";
        return "expense";
    }

    function detailTone(detail: string) {
        if (detail.toLowerCase().includes("receive")) return "text-orange-500";
        if (detail.toLowerCase().includes("back")) return "text-emerald-500";
        return "text-gray-500";
    }
</script>

<svelte:head>
    <title>Recent activity - Spendbee</title>
</svelte:head>

<div class="min-h-screen bg-dark-500 text-white">
    <div class="max-w-7xl mx-auto px-4 pb-12">
        <div class="flex min-h-screen gap-6">
            <LeftSidebar active="activity" />

            <main class="flex-1">
                <MobileNavbar backHref="/groups" backLabel="Back to dashboard" />
                <div class="hidden lg:flex pt-6 mb-6 items-center justify-between">
                    <a href="/groups" class="inline-flex items-center gap-3 hover:opacity-80 transition">
                        <img src="/android-chrome-512x512.png" alt="Spendbee Logo" class="w-10 h-10" />
                        <span class="text-2xl font-semibold">Spendbee</span>
                    </a>
                </div>

                <div class="bg-dark-300/60 border border-dark-100/70 rounded-3xl shadow-[0_0_30px_rgba(0,0,0,0.25)]">
                    <div class="px-6 py-4 border-b border-dark-100/70">
                        <h1 class="text-2xl font-semibold">Recent activity</h1>
                    </div>

                    {#if error}
                        <div class="px-6 pt-4">
                            <div class="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded">{error}</div>
                        </div>
                    {/if}

                    {#if loading}
                        <div class="text-center py-16">
                            <div class="text-gray-400">Loading activity...</div>
                        </div>
                    {:else if activities.length === 0}
                        <div class="text-center py-16 text-gray-400">
                            No recent activity yet.
                        </div>
                    {:else}
                        <div class="divide-y divide-dark-100/80">
                            {#each activities as activity}
                                {#if activity.groupUuid}
                                    <a
                                        href={`/groups/${activity.groupUuid}`}
                                        class="flex gap-4 px-6 py-4 transition hover:bg-dark-200/40"
                                    >
                                        <div class="pt-1">
                                            {#if iconFor(activity.type) === "expense"}
                                                <div class="h-10 w-10 rounded-xl bg-dark-200 flex items-center justify-center text-primary">
                                                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path
                                                            stroke-linecap="round"
                                                            stroke-linejoin="round"
                                                            stroke-width="2"
                                                            d="M8 7h8M8 11h8M8 15h5m-7 6h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v14a2 2 0 002 2z"
                                                        />
                                                    </svg>
                                                </div>
                                            {:else}
                                                <div class="h-10 w-10 rounded-xl bg-dark-200 flex items-center justify-center text-emerald-400">
                                                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path
                                                            stroke-linecap="round"
                                                            stroke-linejoin="round"
                                                            stroke-width="2"
                                                            d="M17 9V7a5 5 0 00-10 0v2H5a1 1 0 00-1 1v8a1 1 0 001 1h14a1 1 0 001-1v-8a1 1 0 00-1-1h-2zm-8 0V7a3 3 0 016 0v2H9z"
                                                        />
                                                    </svg>
                                                </div>
                                            {/if}
                                        </div>
                                        <div class="flex-1">
                                            <div class="text-sm sm:text-base text-white">{activity.title}</div>
                                            <div class={`text-sm ${detailTone(activity.detail)}`}>{activity.detail}</div>
                                            <div class="text-xs text-gray-500">{activity.dateLabel}</div>
                                        </div>
                                    </a>
                                {:else}
                                    <div class="flex gap-4 px-6 py-4">
                                        <div class="pt-1">
                                            {#if iconFor(activity.type) === "expense"}
                                                <div class="h-10 w-10 rounded-xl bg-dark-200 flex items-center justify-center text-primary">
                                                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path
                                                            stroke-linecap="round"
                                                            stroke-linejoin="round"
                                                            stroke-width="2"
                                                            d="M8 7h8M8 11h8M8 15h5m-7 6h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v14a2 2 0 002 2z"
                                                        />
                                                    </svg>
                                                </div>
                                            {:else}
                                                <div class="h-10 w-10 rounded-xl bg-dark-200 flex items-center justify-center text-emerald-400">
                                                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path
                                                            stroke-linecap="round"
                                                            stroke-linejoin="round"
                                                            stroke-width="2"
                                                            d="M17 9V7a5 5 0 00-10 0v2H5a1 1 0 00-1 1v8a1 1 0 001 1h14a1 1 0 001-1v-8a1 1 0 00-1-1h-2zm-8 0V7a3 3 0 016 0v2H9z"
                                                        />
                                                    </svg>
                                                </div>
                                            {/if}
                                        </div>
                                        <div class="flex-1">
                                            <div class="text-sm sm:text-base text-white">{activity.title}</div>
                                            <div class={`text-sm ${detailTone(activity.detail)}`}>{activity.detail}</div>
                                            <div class="text-xs text-gray-500">{activity.dateLabel}</div>
                                        </div>
                                    </div>
                                {/if}
                            {/each}
                        </div>
                    {/if}
                </div>
            </main>
        </div>
    </div>
</div>
