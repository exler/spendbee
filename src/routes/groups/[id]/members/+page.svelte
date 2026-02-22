<script lang="ts">
    import { page } from "$app/state";
    import { api } from "$lib/api";
    import GroupMembersSection from "$lib/components/groups/GroupMembersSection.svelte";
    import { getGroupLayoutContext } from "$lib/components/groups/group-layout-context";

    const {
        groupUuid,
        group,
        allMembers,
        pendingInvitations,
        expenses,
        balances,
        error,
        refresh,
        formatDate,
        getMemberAvatar,
        getMemberName,
    } = getGroupLayoutContext();

    let showAddGuestMember = $state(false);
    let showInviteMember = $state(false);
    let newGuestMemberName = $state("");
    let inviteEmail = $state("");

    $effect(() => {
        if (page.state?.openInviteMember) {
            showInviteMember = true;
        }
        if (page.state?.openAddGuestMember) {
            showAddGuestMember = true;
        }
    });

    async function addGuestMember() {
        if (!newGuestMemberName) return;

        try {
            await api.members.create(groupUuid, {
                name: newGuestMemberName,
            });
            newGuestMemberName = "";
            showAddGuestMember = false;
            refresh();
        } catch (e) {
            $error =
                e instanceof Error ? e.message : "Failed to add guest member";
        }
    }

    async function inviteMember() {
        if (!inviteEmail) return;

        try {
            await api.groups.invite(groupUuid, inviteEmail);
            inviteEmail = "";
            showInviteMember = false;
            $error = "";
            $error = "Invitation sent successfully!";
            setTimeout(() => {
                if ($error === "Invitation sent successfully!") $error = "";
            }, 3000);
        } catch (e) {
            $error =
                e instanceof Error ? e.message : "Failed to send invitation";
        }
    }

    async function deleteGuestMember(memberId: number) {
        if (
            !confirm(
                "Are you sure? This will remove all their expense shares and settlements.",
            )
        )
            return;

        try {
            await api.members.delete(groupUuid, memberId);
            refresh();
        } catch (e) {
            $error =
                e instanceof Error ? e.message : "Failed to delete guest member";
        }
    }

    async function revokeInvitation(invitationId: number, type: string) {
        if (!confirm("Are you sure you want to revoke this invitation?")) return;

        try {
            await api.groups.revokeInvitation(groupUuid, invitationId, type);
            refresh();
        } catch (e) {
            $error =
                e instanceof Error ? e.message : "Failed to revoke invitation";
        }
    }
</script>

<svelte:head>
    <title>{$group?.name || "Group"} - Spendbee</title>
</svelte:head>

<GroupMembersSection
    pendingInvitations={$pendingInvitations}
    allMembers={$allMembers}
    {formatDate}
    {getMemberName}
    {getMemberAvatar}
    onInviteMember={() => (showInviteMember = true)}
    onAddGuestMember={() => (showAddGuestMember = true)}
    onRevokeInvitation={revokeInvitation}
    onDeleteGuestMember={deleteGuestMember}
/>

{#if showAddGuestMember && $group}
    <div
        class="fixed inset-0 bg-black/80 flex items-end md:items-center justify-center p-4 z-50"
    >
        <div
            class="bg-dark-300 p-6 rounded-t-3xl md:rounded-2xl max-w-md w-full border border-dark-100 shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
        >
            <div class="flex items-center justify-between mb-4">
                <div>
                    <div class="text-xs uppercase tracking-[0.3em] text-gray-500">
                        Add member
                    </div>
                    <h3 class="text-2xl font-bold text-white">Guest Member</h3>
                </div>
                <div
                    class="h-10 w-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-semibold"
                >
                    G
                </div>
            </div>
            <form
                onsubmit={(event) => {
                    event.preventDefault();
                    addGuestMember();
                }}
                class="space-y-4"
            >
                <div>
                    <label
                        for="guestName"
                        class="block text-sm font-medium text-gray-300 mb-2"
                    >
                        Guest Name
                    </label>
                    <input
                        type="text"
                        id="guestName"
                        bind:value={newGuestMemberName}
                        required
                        class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
                        placeholder="e.g., Sam"
                    />
                </div>
                <div class="flex gap-2">
                    <button
                        type="submit"
                        class="flex-1 bg-primary text-dark py-2.5 px-4 rounded-xl font-semibold hover:bg-primary-400 transition"
                    >
                        Add Member
                    </button>
                    <button
                        type="button"
                        onclick={() => (showAddGuestMember = false)}
                        class="flex-1 bg-dark-200 text-white py-2.5 px-4 rounded-xl font-semibold hover:bg-dark-100 transition"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}

{#if showInviteMember && $group}
    <div
        class="fixed inset-0 bg-black/80 flex items-end md:items-center justify-center p-4 z-50"
    >
        <div
            class="bg-dark-300 p-6 rounded-t-3xl md:rounded-2xl max-w-md w-full border border-dark-100 shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
        >
            <div class="flex items-center justify-between mb-4">
                <div>
                    <div class="text-xs uppercase tracking-[0.3em] text-gray-500">
                        Invite
                    </div>
                    <h3 class="text-2xl font-bold text-white">Invite Member</h3>
                </div>
                <div
                    class="h-10 w-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-semibold"
                >
                    @
                </div>
            </div>
            <form
                onsubmit={(event) => {
                    event.preventDefault();
                    inviteMember();
                }}
                class="space-y-4"
            >
                <div>
                    <label
                        for="inviteEmail"
                        class="block text-sm font-medium text-gray-300 mb-2"
                    >
                        Email
                    </label>
                    <input
                        type="email"
                        id="inviteEmail"
                        bind:value={inviteEmail}
                        required
                        class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
                        placeholder="friend@example.com"
                    />
                </div>
                <div class="flex gap-2">
                    <button
                        type="submit"
                        class="flex-1 bg-primary text-dark py-2.5 px-4 rounded-xl font-semibold hover:bg-primary-400 transition"
                    >
                        Send Invite
                    </button>
                    <button
                        type="button"
                        onclick={() => (showInviteMember = false)}
                        class="flex-1 bg-dark-200 text-white py-2.5 px-4 rounded-xl font-semibold hover:bg-dark-100 transition"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}
