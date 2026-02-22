<script lang="ts">
    import { goto } from "$app/navigation";
    import { resolve } from "$app/paths";
    import { page } from "$app/state";

    const groupId = $derived(page.params.id ?? "");

    $effect(() => {
        if (!groupId) return;
        goto(resolve(`/groups/${groupId}/expenses`), { replaceState: true });
    });
</script>

<div class="min-h-screen bg-dark-500 text-white">
    <div class="max-w-7xl mx-auto px-4 py-12 text-center text-gray-400">Redirecting to expenses...</div>
</div>
