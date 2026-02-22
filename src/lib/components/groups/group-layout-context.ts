import { getContext, setContext } from "svelte";
import type { Writable } from "svelte/store";
import type {
    Balance,
    Expense,
    Group,
    GroupMember,
    PendingInvitation,
    Settlement,
} from "./group-context";

export interface GroupLayoutContext {
    groupUuid: string;
    groupId: Writable<number | null>;
    group: Writable<Group | null>;
    allMembers: Writable<GroupMember[]>;
    pendingInvitations: Writable<PendingInvitation[]>;
    expenses: Writable<Expense[]>;
    balances: Writable<Balance[]>;
    settlements: Writable<Settlement[]>;
    supportedCurrencies: Writable<string[]>;
    loading: Writable<boolean>;
    error: Writable<string>;
    refresh: () => Promise<void>;
    formatDate: (date: Date) => string;
    formatCurrency: (amount: number) => string;
    getMemberName: (member: GroupMember) => string;
    getMemberAvatar: (member: GroupMember) => string | null;
    exportExpenses: () => void;
}

const GROUP_LAYOUT_CONTEXT_KEY = Symbol("group-layout-context");

export function setGroupLayoutContext(context: GroupLayoutContext) {
    setContext(GROUP_LAYOUT_CONTEXT_KEY, context);
}

export function getGroupLayoutContext() {
    return getContext(GROUP_LAYOUT_CONTEXT_KEY) as GroupLayoutContext;
}
