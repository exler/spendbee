import type { GroupMember } from "./group-context";

export function formatDate(date: Date) {
    return new Date(date).toLocaleDateString();
}

export function formatCurrency(amount: number) {
    return amount.toFixed(2);
}

export function getMemberName(member: GroupMember) {
    if (member.user?.name) return member.user.name;
    if (member.name) return `${member.name} (guest)`;
    return "Unknown";
}

export function getMemberAvatar(member: GroupMember) {
    const avatar = member.user?.avatarUrl;
    if (!avatar) return null;
    if (avatar.startsWith("http")) return avatar;
    return `/api/receipts/view/${encodeURIComponent(avatar)}`;
}

export function exportExpenses(groupUuid: string) {
    if (!groupUuid) return;
    window.location.href = `/api/expenses/group/${groupUuid}/export`;
}
