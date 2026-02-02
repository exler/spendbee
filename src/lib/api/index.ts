const API_URL = "/api";

async function fetchAPI(endpoint: string, options: RequestInit = {}) {
    const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...options.headers,
    };

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
        credentials: "include",
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Request failed");
    }

    return response.json();
}

export const api = {
    auth: {
        register: (data: { email: string; password: string; name: string; token?: string }) =>
            fetchAPI("/auth/register", {
                method: "POST",
                body: JSON.stringify(data),
            }),
        login: (data: { email: string; password: string }) =>
            fetchAPI("/auth/login", {
                method: "POST",
                body: JSON.stringify(data),
            }),
        logout: () =>
            fetchAPI("/auth/logout", {
                method: "POST",
            }),
    },
    groups: {
        list: (includeArchived?: boolean) => fetchAPI(`/groups${includeArchived ? "?includeArchived=true" : ""}`),
        get: (uuid: string) => fetchAPI(`/groups/${uuid}`),
        create: (data: { name: string; description?: string; baseCurrency?: string }) =>
            fetchAPI("/groups", {
                method: "POST",
                body: JSON.stringify(data),
            }),
        update: (uuid: string, data: { name?: string; description?: string; baseCurrency?: string }) =>
            fetchAPI(`/groups/${uuid}`, {
                method: "PATCH",
                body: JSON.stringify(data),
            }),
        archive: (uuid: string, archived: boolean) =>
            fetchAPI(`/groups/${uuid}/archive`, {
                method: "PATCH",
                body: JSON.stringify({ archived }),
            }),
        invite: (uuid: string, email: string) =>
            fetchAPI(`/groups/${uuid}/invite`, {
                method: "POST",
                body: JSON.stringify({ email }),
            }),
        invitations: (uuid: string) => fetchAPI(`/groups/${uuid}/invitations`),
        revokeInvitation: (uuid: string, invitationId: number, type: string) =>
            fetchAPI(`/groups/${uuid}/invitations`, {
                method: "DELETE",
                body: JSON.stringify({ invitationId, type }),
            }),
        updateCurrency: (uuid: string, baseCurrency: string) =>
            fetchAPI(`/groups/${uuid}/currency`, {
                method: "PATCH",
                body: JSON.stringify({ baseCurrency }),
            }),
        currencies: () => fetchAPI("/groups/currencies"),
    },
    notifications: {
        list: () => fetchAPI("/notifications"),
        unreadCount: () => fetchAPI("/notifications/unread-count"),
        markAsRead: (id: number) =>
            fetchAPI(`/notifications/${id}/read`, {
                method: "PATCH",
            }),
        accept: (id: number) =>
            fetchAPI(`/notifications/${id}/accept`, {
                method: "POST",
            }),
        decline: (id: number) =>
            fetchAPI(`/notifications/${id}/decline`, {
                method: "POST",
            }),
    },
    expenses: {
        create: (data: {
            groupId: number;
            description: string;
            note?: string;
            amount: number;
            currency?: string;
            createdAt?: string;
            paidBy?: number;
            sharedWith: number[];
            receiptImageUrl?: string;
            receiptItems?: Array<{
                description: string;
                quantity: number;
                price: number;
                assignedTo?: number[];
            }>;
            attachments?: Array<{ url: string; name: string; type: string }>;
            customShares?: Array<{ memberId: number; amount: number }>;
        }) =>
            fetchAPI("/expenses", {
                method: "POST",
                body: JSON.stringify(data),
            }),
        update: (
            id: number,
            data: {
                description?: string;
                note?: string;
                amount?: number;
                currency?: string;
                createdAt?: string;
                paidBy?: number;
                sharedWith?: number[];
                receiptImageUrl?: string;
                receiptItems?: Array<{
                    description: string;
                    quantity: number;
                    price: number;
                    assignedTo?: number[];
                }>;
                attachments?: Array<{ url: string; name: string; type: string }>;
                customShares?: Array<{ memberId: number; amount: number }>;
            },
        ) =>
            fetchAPI(`/expenses/${id}`, {
                method: "PATCH",
                body: JSON.stringify(data),
            }),
        delete: (id: number) =>
            fetchAPI(`/expenses/${id}`, {
                method: "DELETE",
            }),
        analyzeReceipt: (data: {
            groupId: number;
            image: string;
            additionalFiles?: Array<{ data: string; name: string }>;
        }) =>
            fetchAPI("/expenses/analyze-receipt", {
                method: "POST",
                body: JSON.stringify(data),
            }),
        uploadAttachment: (data: { groupId: number; file: string; filename: string }) =>
            fetchAPI("/expenses/upload-attachment", {
                method: "POST",
                body: JSON.stringify(data),
            }),
        list: (groupUuid: string) => fetchAPI(`/expenses/group/${groupUuid}`),
        balances: (groupUuid: string) => fetchAPI(`/expenses/group/${groupUuid}/balances`),
        settle: (data: {
            groupId: number;
            fromMemberId: number;
            toMemberId: number;
            amount: number;
            currency?: string;
        }) =>
            fetchAPI("/expenses/settle", {
                method: "POST",
                body: JSON.stringify(data),
            }),
        settlements: (groupUuid: string) => fetchAPI(`/expenses/group/${groupUuid}/settlements`),
    },
    members: {
        create: (groupUuid: string, data: { name: string }) =>
            fetchAPI(`/groups/${groupUuid}/members`, {
                method: "POST",
                body: JSON.stringify(data),
            }),
        list: (groupUuid: string) => fetchAPI(`/groups/${groupUuid}/members`),
        delete: (groupUuid: string, memberId: number) =>
            fetchAPI(`/groups/${groupUuid}/members/${memberId}`, {
                method: "DELETE",
            }),
    },
};
