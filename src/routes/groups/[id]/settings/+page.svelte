<script lang="ts">
    import { api } from "$lib/api";
    import GroupSettingsSection from "$lib/components/groups/GroupSettingsSection.svelte";
    import { getGroupLayoutContext } from "$lib/components/groups/group-layout-context";
    import { user } from "$lib/stores/auth";

    const { groupUuid, group, supportedCurrencies, error, refresh } =
        getGroupLayoutContext();

    let editGroupName = $state("");
    let editGroupDescription = $state("");
    let editGroupCurrency = $state("EUR");
    let settingsSaved = $state(false);
    let uploadingGroupImage = $state(false);

    $effect(() => {
        if ($group) {
            editGroupName = $group.name;
            editGroupDescription = $group.description || "";
            editGroupCurrency = $group.baseCurrency || "EUR";
        }
    });

    async function saveGroupSettings() {
        if (!editGroupName) {
            $error = "Group name is required";
            return;
        }

        try {
            await api.groups.update(groupUuid, {
                name: editGroupName,
                description: editGroupDescription || undefined,
                baseCurrency: editGroupCurrency,
            });
            settingsSaved = true;
            setTimeout(() => {
                settingsSaved = false;
            }, 3000);
            refresh();
        } catch (e) {
            $error =
                e instanceof Error ? e.message : "Failed to update group settings";
        }
    }

    async function handleGroupImageChange(event: Event) {
        const input = event.currentTarget as HTMLInputElement;
        if (!input.files?.length || !$group) return;

        uploadingGroupImage = true;
        $error = "";

        try {
            const file = input.files[0];
            const base64 = await readAsDataUrl(file);
            const updated = await uploadGroupImage($group.uuid, base64, file.name);
            $group = { ...$group, imageUrl: updated.imageUrl };
        } catch (e) {
            $error =
                e instanceof Error
                    ? e.message
                    : "Failed to upload group image";
        } finally {
            uploadingGroupImage = false;
            input.value = "";
        }
    }

    async function toggleArchive() {
        if (!$group) return;

        const newArchivedState = !$group.archived;
        const action = newArchivedState ? "archive" : "unarchive";

        if (
            !confirm(
                `Are you sure you want to ${action} this group? ${newArchivedState ? "Archived groups cannot have expenses added or debts settled until unarchived." : ""}`,
            )
        ) {
            return;
        }

        try {
            await api.groups.archive(groupUuid, newArchivedState);
            refresh();
        } catch (e) {
            $error =
                e instanceof Error ? e.message : `Failed to ${action} group`;
        }
    }

    function readAsDataUrl(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("Failed to read file"));
            reader.readAsDataURL(file);
        });
    }

    async function uploadGroupImage(
        groupId: string,
        file: string,
        filename: string,
    ) {
        const response = await fetch(`/api/groups/${groupId}/image`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ file, filename }),
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || "Failed to upload group image");
        }

        return response.json();
    }
</script>

<svelte:head>
    <title>{$group?.name || "Group"} - Spendbee</title>
</svelte:head>

<GroupSettingsSection
    group={$group}
    supportedCurrencies={$supportedCurrencies}
    {editGroupName}
    {editGroupDescription}
    {editGroupCurrency}
    {settingsSaved}
    {uploadingGroupImage}
    isOwner={$group?.createdBy === $user?.id}
    onSave={saveGroupSettings}
    onToggleArchive={toggleArchive}
    onGroupImageChange={handleGroupImageChange}
/>
