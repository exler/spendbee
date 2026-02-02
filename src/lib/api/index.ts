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
        register: (data: { email: string; password: string; name: string }) =>
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
        get: (id: number) => fetchAPI(`/groups/${id}`),
        create: (data: { name: string; description?: string; baseCurrency?: string }) =>
            fetchAPI("/groups", {
                method: "POST",
                body: JSON.stringify(data),
            }),
        update: (id: number, data: { name?: string; description?: string; baseCurrency?: string }) =>
            fetchAPI(`/groups/${id}`, {
                method: "PATCH",
                body: JSON.stringify(data),
            }),
        archive: (id: number, archived: boolean) =>
            fetchAPI(`/groups/${id}/archive`, {
                method: "PATCH",
                body: JSON.stringify({ archived }),
            }),
        invite: (id: number, email: string) =>
            fetchAPI(`/groups/${id}/invite`, {
                method: "POST",
                body: JSON.stringify({ email }),
            }),
        updateCurrency: (id: number, baseCurrency: string) =>
            fetchAPI(`/groups/${id}/currency`, {
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
        analyzeReceipt: (data: { groupId: number; image: string }) =>
            fetchAPI("/expenses/analyze-receipt", {
                method: "POST",
                body: JSON.stringify(data),
            }),
        list: (groupId: number) => fetchAPI(`/expenses/group/${groupId}`),
        balances: (groupId: number) => fetchAPI(`/expenses/group/${groupId}/balances`),
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
        settlements: (groupId: number) => fetchAPI(`/expenses/group/${groupId}/settlements`),
    },
    members: {
        create: (groupId: number, data: { name: string }) =>
            fetchAPI(`/groups/${groupId}/members`, {
                method: "POST",
                body: JSON.stringify(data),
            }),
        list: (groupId: number) => fetchAPI(`/groups/${groupId}/members`),
        delete: (groupId: number, memberId: number) =>
            fetchAPI(`/groups/${groupId}/members/${memberId}`, {
                method: "DELETE",
            }),
    },
};
