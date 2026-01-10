import { get } from 'svelte/store';
import { token } from '$lib/stores/auth';

const API_URL = 'http://localhost:3000';

async function fetchAPI(endpoint: string, options: RequestInit = {}) {
	const $token = get(token);
	const headers: HeadersInit = {
		'Content-Type': 'application/json',
		...options.headers,
	};

	if ($token) {
		headers['Authorization'] = `Bearer ${$token}`;
	}

	const response = await fetch(`${API_URL}${endpoint}`, {
		...options,
		headers,
	});

	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error || 'Request failed');
	}

	return response.json();
}

export const api = {
	auth: {
		register: (data: { email: string; password: string; name: string }) =>
			fetchAPI('/auth/register', {
				method: 'POST',
				body: JSON.stringify(data),
			}),
		login: (data: { email: string; password: string }) =>
			fetchAPI('/auth/login', {
				method: 'POST',
				body: JSON.stringify(data),
			}),
	},
	groups: {
		list: () => fetchAPI('/groups'),
		get: (id: number) => fetchAPI(`/groups/${id}`),
		create: (data: { name: string; description?: string }) =>
			fetchAPI('/groups', {
				method: 'POST',
				body: JSON.stringify(data),
			}),
		join: (id: number) =>
			fetchAPI(`/groups/${id}/join`, {
				method: 'POST',
			}),
	},
	expenses: {
		create: (data: {
			groupId: number;
			description: string;
			amount: number;
			sharedWith: number[];
			sharedWithMock: number[];
		}) =>
			fetchAPI('/expenses', {
				method: 'POST',
				body: JSON.stringify(data),
			}),
		list: (groupId: number) => fetchAPI(`/expenses/group/${groupId}`),
		balances: (groupId: number) => fetchAPI(`/expenses/group/${groupId}/balances`),
		settle: (data: {
			groupId: number;
			fromUserId?: number;
			toUserId?: number;
			fromMockUserId?: number;
			toMockUserId?: number;
			amount: number;
		}) =>
			fetchAPI('/expenses/settle', {
				method: 'POST',
				body: JSON.stringify(data),
			}),
		settlements: (groupId: number) => fetchAPI(`/expenses/group/${groupId}/settlements`),
	},
	mockUsers: {
		create: (data: { groupId: number; name: string }) =>
			fetchAPI('/mock-users', {
				method: 'POST',
				body: JSON.stringify(data),
			}),
		list: (groupId: number) => fetchAPI(`/mock-users/group/${groupId}`),
		delete: (id: number) =>
			fetchAPI(`/mock-users/${id}`, {
				method: 'DELETE',
			}),
	},
};
