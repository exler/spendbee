<script lang="ts">
    import type { GroupMember, PendingInvitation } from "./group-context";

    export let pendingInvitations: PendingInvitation[];
    export let allMembers: GroupMember[];
    export let getMemberName: (member: GroupMember) => string;
    export let getMemberAvatar: (member: GroupMember) => string | null;
    export let formatDate: (date: Date) => string;
    export let onInviteMember: () => void;
    export let onAddGuestMember: () => void;
    export let onRevokeInvitation: (id: number, type: string) => void;
    export let onDeleteGuestMember: (memberId: number) => void;
</script>

<div class="mb-4 flex flex-wrap gap-2">
    <button
        onclick={onInviteMember}
        class="flex-1 bg-primary text-dark py-3 px-6 rounded-xl font-semibold hover:bg-primary-400 transition"
    >
        Invite Member
    </button>
    <button
        onclick={onAddGuestMember}
        class="flex-1 bg-dark-200 text-white py-3 px-6 rounded-xl font-semibold hover:bg-dark-100 transition border border-primary"
    >
        Add Guest Member
    </button>
</div>

<div class="space-y-4">
    {#if pendingInvitations.length > 0}
        <div>
            <h3 class="text-lg font-semibold text-white mb-3">
                Pending Invitations
            </h3>
            <div class="space-y-2">
                {#each pendingInvitations as invitation (invitation.id)}
                    <div
                        class="bg-dark-300/70 p-4 rounded-2xl border border-dark-100/70"
                    >
                        <div class="flex justify-between items-center">
                            <div>
                                <div class="font-semibold text-white">
                                    {invitation.email}
                                </div>
                                <div class="text-sm text-gray-400">
                                    Invited by {invitation.invitedBy.name}
                                    {#if invitation.type === "token"}
                                        • New user
                                    {:else}
                                        • Existing user
                                    {/if}
                                </div>
                                <div class="text-xs text-gray-500 mt-1">
                                    {formatDate(invitation.createdAt)}
                                </div>
                            </div>
                            <button
                                onclick={() =>
                                    onRevokeInvitation(
                                        invitation.id,
                                        invitation.type,
                                    )}
                                class="text-red-400 hover:text-red-300 text-sm"
                            >
                                Revoke
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    {/if}

    <div>
        <h3 class="text-lg font-semibold text-white mb-3">All Members</h3>
        <div class="space-y-2">
            {#each allMembers as member (member.id)}
                <div
                    class="bg-dark-300/70 p-4 rounded-2xl border border-dark-100/70"
                >
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-3">
                            {#if getMemberAvatar(member)}
                                <img
                                    src={getMemberAvatar(member)}
                                    alt="Member avatar"
                                    class="h-11 w-11 rounded-2xl object-cover border border-dark-100"
                                />
                            {:else}
                                <div
                                    class="h-11 w-11 rounded-2xl bg-dark-200 text-primary flex items-center justify-center text-sm font-semibold"
                                >
                                    {getMemberName(member).slice(0, 1).toUpperCase()}
                                </div>
                            {/if}
                            <div>
                                <div class="font-semibold text-white">
                                    {getMemberName(member)}
                                </div>
                                {#if member.user}
                                    <div class="text-sm text-gray-400">
                                        {member.user.email}
                                    </div>
                                {:else}
                                    <div class="text-sm text-gray-400">
                                        Guest user
                                    </div>
                                {/if}
                            </div>
                        </div>
                        {#if member.userId !== null}
                            <div class="text-xs text-primary">Registered</div>
                        {:else}
                            <button
                                onclick={() => onDeleteGuestMember(member.id)}
                                class="text-red-400 hover:text-red-300 text-sm"
                            >
                                Remove
                            </button>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
    </div>
</div>
