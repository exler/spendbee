<script lang="ts">
    import { resolve } from "$app/paths";

    export let groupUuid: string;
    export let activeSection: string;

    const tabs = [
        { key: "expenses", label: "Expenses" },
        { key: "balances", label: "Balances" },
        { key: "settlements", label: "Settlements" },
    ];
</script>

<div class="flex flex-wrap gap-2 mb-6">
    {#each tabs as tab (tab.key)}
        <a
            href={resolve(`/groups/${groupUuid}/${tab.key}`)}
            class="px-5 py-2 rounded-full text-sm font-medium transition {activeSection ===
            tab.key
                ? 'bg-primary text-dark'
                : 'bg-dark-200 text-gray-300 hover:text-white'}"
        >
            {tab.label}
        </a>
    {/each}
</div>
