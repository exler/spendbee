<script lang="ts">
    import { page } from "$app/state";
    import { browser } from "$app/environment";
    import { api } from "$lib/api";
    import GroupMembersSection from "$lib/components/groups/GroupMembersSection.svelte";
    import { getGroupLayoutContext } from "$lib/components/groups/group-layout-context";
    import { user } from "$lib/stores/auth";

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
    let shareLoading = $state(false);
    let shareError = $state("");
    let shareStatus = $state("");
    let shareInfo = $state<{ enabled: boolean; code: string | null }>({
        enabled: false,
        code: null,
    });

    const isOwner = $derived($group?.createdBy === $user?.id);
    const shareUrl = $derived(
        browser && shareInfo.code ? `${window.location.origin}/join/${shareInfo.code}` : "",
    );

    $effect(() => {
        if (page.state?.openInviteMember) {
            showInviteMember = true;
        }
        if (page.state?.openAddGuestMember) {
            showAddGuestMember = true;
        }
    });

    $effect(() => {
        if (!isOwner) return;
        void loadShareLink();
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

    async function loadShareLink() {
        shareError = "";
        try {
            const response = await api.groups.shareLink.get(groupUuid);
            shareInfo = response;
        } catch (e) {
            shareError = e instanceof Error ? e.message : "Failed to load share link";
        }
    }

    async function handleGenerateLink(regenerate = false) {
        shareLoading = true;
        shareError = "";
        shareStatus = "";
        try {
            const response = await api.groups.shareLink.create(groupUuid, regenerate);
            shareInfo = response;
            shareStatus = "Share link is ready";
        } catch (e) {
            shareError = e instanceof Error ? e.message : "Failed to generate share link";
        } finally {
            shareLoading = false;
        }
    }

    async function handleDisableLink() {
        shareLoading = true;
        shareError = "";
        shareStatus = "";
        try {
            const response = await api.groups.shareLink.disable(groupUuid);
            shareInfo = response;
            shareStatus = "Share link disabled";
        } catch (e) {
            shareError = e instanceof Error ? e.message : "Failed to disable share link";
        } finally {
            shareLoading = false;
        }
    }

    async function handleCopy() {
        if (!browser || !shareUrl) return;
        try {
            await navigator.clipboard.writeText(shareUrl);
            shareStatus = "Link copied to clipboard";
            setTimeout(() => {
                shareStatus = "";
            }, 2000);
        } catch (e) {
            shareError = e instanceof Error ? e.message : "Failed to copy link";
        }
    }
</script>

<svelte:head>
    <title>{$group?.name || "Group"} - Spendbee</title>
</svelte:head>

{#if isOwner}
    <div class="bg-dark-300 p-6 rounded-2xl border border-dark-100 mb-6">
        <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
                <h2 class="text-2xl font-bold text-white">Share Link</h2>
                <p class="text-sm text-gray-400 mt-1">
                    Generate a link to invite people to this group. The link stays active until you disable it.
                </p>
            </div>
            <div class="flex flex-wrap gap-2">
                {#if shareInfo.enabled && shareInfo.code}
                    <button
                        type="button"
                        onclick={() => handleGenerateLink(true)}
                        disabled={shareLoading}
                        class="rounded-xl border border-dark-100 bg-dark-200/80 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-dark-100 transition disabled:opacity-50"
                    >
                        Regenerate
                    </button>
                    <button
                        type="button"
                        onclick={handleDisableLink}
                        disabled={shareLoading}
                        class="rounded-xl bg-red-500/80 px-4 py-2 text-sm font-semibold text-dark hover:bg-red-400 transition disabled:opacity-50"
                    >
                        Disable
                    </button>
                {:else}
                    <button
                        type="button"
                        onclick={() => handleGenerateLink(false)}
                        disabled={shareLoading}
                        class="rounded-xl bg-primary text-dark px-4 py-2 text-sm font-semibold hover:bg-primary-400 transition disabled:opacity-50"
                    >
                        Generate Link
                    </button>
                {/if}
            </div>
        </div>

        {#if shareError}
            <div class="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded mt-4">
                {shareError}
            </div>
        {/if}

        {#if shareStatus}
            <div class="bg-green-900/40 border border-green-500 text-green-200 p-3 rounded mt-4">
                {shareStatus}
            </div>
        {/if}

        <div class="mt-6">
            {#if shareInfo.enabled && shareInfo.code}
                <label for="shareLinkUrl" class="block text-sm font-medium text-gray-300 mb-2">
                    Shareable URL
                </label>
                <div class="flex flex-wrap gap-3">
                    <input
                        id="shareLinkUrl"
                        type="text"
                        readonly
                        value={shareUrl}
                        class="flex-1 min-w-[220px] px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-gray-200"
                    />
                    <button
                        type="button"
                        onclick={handleCopy}
                        class="rounded-xl border border-dark-100 bg-dark-200/80 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-dark-100 transition"
                    >
                        Copy Link
                    </button>
                </div>
                <p class="text-xs text-gray-500 mt-2">
                    Anyone with this link can join. Disable it anytime to stop new members from joining.
                </p>
            {:else}
                <div class="bg-dark-200/70 border border-dark-100 text-gray-300 p-4 rounded-lg text-sm">
                    No active share link. Generate one to invite people with a single URL.
                </div>
            {/if}
        </div>
    </div>
{/if}

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
