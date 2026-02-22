<script lang="ts">
    import { resolve } from "$app/paths";
    import { cn } from "$lib/utils";

    const { groupUuid, activeSection } = $props<{
        groupUuid: string;
        activeSection: string;
    }>();

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
            class={cn("px-5 py-2 rounded-full text-sm font-medium transition", {
                "bg-primary text-dark": activeSection === tab.key,
                "bg-dark-200 text-gray-300 hover:text-white": activeSection !== tab.key,
            })}
        >
            {tab.label}
        </a>
    {/each}
</div>
