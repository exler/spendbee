<script lang="ts">
    import type { Group } from "./group-context";

    export let group: Group;
    export let memberCount = 0;
    export let onInvite: () => void;
</script>

<div>
    <div class="text-xs uppercase tracking-[0.2em] text-gray-500">
        Current group
    </div>
    <div class="mt-3 rounded-2xl border border-dark-100/70 bg-dark-300/50 p-4">
        <div class="flex items-center gap-3">
            {#if group.imageUrl}
                <img
                    src={`/api/receipts/view/${encodeURIComponent(group.imageUrl)}`}
                    alt={group.name}
                    class="h-10 w-10 rounded-xl object-cover border border-dark-100"
                />
            {:else}
                <div
                    class="h-10 w-10 rounded-xl bg-primary text-dark flex items-center justify-center font-semibold"
                >
                    {group.name?.slice(0, 1) || "G"}
                </div>
            {/if}
            <div>
                <div class="font-semibold text-white">{group.name}</div>
                <div class="text-xs text-gray-400">{memberCount} members</div>
            </div>
        </div>
        <button
            onclick={onInvite}
            class="mt-4 w-full rounded-lg bg-primary text-dark py-2 text-sm font-semibold hover:bg-primary-400"
        >
            Invite friends
        </button>
    </div>
</div>
