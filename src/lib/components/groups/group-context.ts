import { getContext, setContext } from "svelte";
import type { Writable } from "svelte/store";

export interface GroupMember {
    id: number;
    userId: number | null;
    name: string | null;
    user?: {
        id: number;
        name: string;
        email: string;
        avatarUrl?: string | null;
    };
}

export interface Group {
    id: number;
    uuid: string;
    name: string;
    description: string | null;
    baseCurrency?: string;
    archived?: boolean;
    createdBy?: number;
    imageUrl?: string | null;
    members: GroupMember[];
}

export interface CurrencyBalance {
    currency: string;
    amount: number;
}

export interface Expense {
    id: number;
    description: string;
    note?: string;
    amount: number;
    currency?: string;
    exchangeRate?: number;
    paidBy: number;
    createdAt: Date;
    payer: GroupMember;
    shares: Array<{ member: GroupMember; share: number }>;
    receiptImageUrl?: string;
    receiptItems?: string;
    attachments?: string;
}

export interface Balance {
    memberId: number;
    memberName: string;
    balance: number;
    balanceByCurrency?: CurrencyBalance[];
    balanceInBaseCurrency?: number;
    isGuest?: boolean;
    avatarUrl?: string | null;
}

export interface Settlement {
    id: number;
    fromMember: GroupMember;
    toMember: GroupMember;
    amount: number;
    currency?: string;
    exchangeRate?: number;
    createdAt: Date;
}

export interface PendingInvitation {
    id: number;
    email: string;
    type: "notification" | "token";
    invitedBy: {
        id: number;
        name: string;
        email: string;
    };
    createdAt: Date;
}

export interface GroupContext {
    groupUuid: string;
    groupId: () => number | null;
    group: Writable<Group | null>;
    allMembers: Writable<GroupMember[]>;
    pendingInvitations: Writable<PendingInvitation[]>;
    expenses: Writable<Expense[]>;
    balances: Writable<Balance[]>;
    settlements: Writable<Settlement[]>;
    supportedCurrencies: Writable<string[]>;
    loading: Writable<boolean>;
    error: Writable<string>;
    editGroupName: Writable<string>;
    editGroupDescription: Writable<string>;
    editGroupCurrency: Writable<string>;
    settingsSaved: Writable<boolean>;
    uploadingGroupImage: Writable<boolean>;
    refresh: () => Promise<void>;
    formatDate: (date: Date) => string;
    formatCurrency: (amount: number) => string;
    getMemberName: (member: GroupMember) => string;
    getMemberAvatar: (member: GroupMember) => string | null;
    exportExpenses: () => void;
    startEditExpense: (expense: Expense) => void;
    deleteExpense: (expenseId: number) => Promise<void>;
    openAddExpense: () => void;
    openScanReceipt: () => void;
    openSettleDebt: () => void;
    openInviteMember: () => void;
    openAddGuestMember: () => void;
    revokeInvitation: (invitationId: number, type: string) => Promise<void>;
    deleteGuestMember: (memberId: number) => Promise<void>;
    saveGroupSettings: () => Promise<void>;
    toggleArchive: () => Promise<void>;
    handleGroupImageChange: (event: Event) => Promise<void>;
}

const GROUP_CONTEXT_KEY = Symbol("group-context");

export function setGroupContext(context: GroupContext) {
    setContext(GROUP_CONTEXT_KEY, context);
}

export function getGroupContext() {
    return getContext(GROUP_CONTEXT_KEY) as GroupContext;
}
