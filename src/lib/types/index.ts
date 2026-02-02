export interface User {
    id: number;
    email: string;
    name: string;
    createdAt: Date;
}

export interface Group {
    id: number;
    uuid: string;
    name: string;
    description: string | null;
    createdBy: number;
    createdAt: Date;
}

export interface Expense {
    id: number;
    groupId: number;
    description: string;
    amount: number;
    paidBy: number;
    createdAt: Date;
}

export interface Attachment {
    url: string;
    name: string;
    type: string;
}

export interface CurrencyBalance {
    currency: string;
    amount: number;
}

export interface Balance {
    memberId: number;
    memberName: string;
    balance: number;
    balanceByCurrency?: CurrencyBalance[];
    balanceInBaseCurrency?: number;
    isGuest?: boolean;
}

export interface Settlement {
    id: number;
    groupId: number;
    fromMemberId: number;
    toMemberId: number;
    amount: number;
    createdAt: Date;
}
