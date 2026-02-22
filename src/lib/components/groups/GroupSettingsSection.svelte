<script lang="ts">
    import type { Group } from "./group-context";

    export let group: Group | null;
    export let supportedCurrencies: string[];
    export let editGroupName: string;
    export let editGroupDescription: string;
    export let editGroupCurrency: string;
    export let settingsSaved: boolean;
    export let uploadingGroupImage: boolean;
    export let isOwner: boolean;
    export let onSave: () => void;
    export let onToggleArchive: () => void;
    export let onGroupImageChange: (event: Event) => void;
</script>

{#if isOwner}
    <div class="bg-dark-300 p-6 rounded-2xl border border-dark-100">
        <div class="flex flex-wrap gap-6 items-start">
            {#if group?.imageUrl}
                <img
                    src={`/api/receipts/view/${encodeURIComponent(group.imageUrl)}`}
                    alt={group?.name || "Group"}
                    class="w-28 h-28 rounded-3xl object-cover border border-dark-100"
                />
            {:else}
                <div
                    class="w-28 h-28 rounded-3xl bg-gradient-to-br from-primary/80 to-primary-600 flex items-center justify-center text-4xl font-bold text-dark"
                >
                    {group?.name?.slice(0, 1) || "G"}
                </div>
            {/if}
            <div class="flex-1 min-w-[220px]">
                <h3 class="text-2xl font-bold text-white mb-2">
                    Group Settings
                </h3>
                <p class="text-sm text-gray-400">
                    Manage your group details and members.
                </p>
            </div>
        </div>

        {#if settingsSaved}
            <div
                class="bg-green-900/50 border border-green-500 text-green-200 p-3 rounded mb-4 mt-4"
            >
                Settings saved successfully!
            </div>
        {/if}

        <form
            onsubmit={(event) => {
                event.preventDefault();
                onSave();
            }}
            class="space-y-6 mt-6"
        >
            <div>
                <div class="block text-sm font-medium text-gray-300 mb-2">
                    Group Image
                </div>
                <div class="flex flex-wrap items-center gap-4">
                    {#if group?.imageUrl}
                        <img
                            src={`/api/receipts/view/${encodeURIComponent(group.imageUrl)}`}
                            alt={group?.name || "Group"}
                            class="h-16 w-16 rounded-2xl object-cover border border-dark-100"
                        />
                    {:else}
                        <div
                            class="h-16 w-16 rounded-2xl bg-dark-200 text-primary flex items-center justify-center font-semibold"
                        >
                            {group?.name?.slice(0, 1) || "G"}
                        </div>
                    {/if}
                    <label
                        class="inline-flex items-center gap-2 rounded-lg border border-dark-100 bg-dark-200/70 px-4 py-2 text-sm text-gray-200 hover:bg-dark-100 cursor-pointer"
                    >
                        {uploadingGroupImage ? "Uploading..." : "Upload image"}
                        <input
                            type="file"
                            accept="image/*"
                            class="hidden"
                            disabled={uploadingGroupImage}
                            onchange={onGroupImageChange}
                        />
                    </label>
                    <div class="text-xs text-gray-500">
                        JPG, PNG, GIF, or WebP. Max 8MB.
                    </div>
                </div>
            </div>

            <div>
                <label
                    for="settingsGroupName"
                    class="block text-sm font-medium text-gray-300 mb-2"
                >
                    Group Name
                </label>
                <input
                    type="text"
                    id="settingsGroupName"
                    bind:value={editGroupName}
                    required
                    class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
                    placeholder="e.g., Roommates, Trip to Paris"
                />
            </div>

            <div>
                <label
                    for="settingsGroupDescription"
                    class="block text-sm font-medium text-gray-300 mb-2"
                >
                    Description
                </label>
                <textarea
                    id="settingsGroupDescription"
                    bind:value={editGroupDescription}
                    rows="3"
                    class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
                    placeholder="What is this group for?"
                ></textarea>
            </div>

            <div>
                <label
                    for="settingsBaseCurrency"
                    class="block text-sm font-medium text-gray-300 mb-2"
                >
                    Base Currency
                </label>
                <select
                    id="settingsBaseCurrency"
                    bind:value={editGroupCurrency}
                    class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
                >
                    {#each supportedCurrencies as curr (curr)}
                        <option value={curr}>{curr}</option>
                    {/each}
                </select>
                <p class="text-xs text-gray-400 mt-1">
                    The base currency is used to display total balances when
                    multiple currencies are used.
                </p>
            </div>

            <button
                type="submit"
                class="w-full bg-primary text-dark py-3 px-6 rounded-lg font-semibold hover:bg-primary-400 transition"
            >
                Save Settings
            </button>
        </form>

        <div class="mt-6 pt-6 border-t border-dark-100">
            <h4 class="text-lg font-semibold text-white mb-3">
                Archive Group
            </h4>
            <p class="text-sm text-gray-400 mb-4">
                {#if group?.archived}
                    This group is currently archived. Unarchive it to add
                    expenses or settle debts.
                {:else}
                    Archive this group to hide it from your groups list. You can
                    unarchive it later if needed.
                {/if}
            </p>
            <button
                type="button"
                onclick={onToggleArchive}
                class="w-full {group?.archived
                    ? 'bg-primary text-dark'
                    : 'bg-dark-200 text-white'} py-3 px-6 rounded-lg font-semibold hover:opacity-80 transition"
            >
                {group?.archived ? "Unarchive Group" : "Archive Group"}
            </button>
        </div>
    </div>
{:else}
    <div class="text-center py-12 bg-dark-300 rounded-2xl">
        <p class="text-gray-400">
            Only the group creator can modify settings.
        </p>
    </div>
{/if}
