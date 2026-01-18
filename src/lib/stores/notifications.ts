import { writable } from "svelte/store";

export interface Notification {
    id: number;
    userId: number;
    type: string;
    title: string;
    message: string;
    data: string;
    read: boolean;
    createdAt: Date;
}

export const notifications = writable<Notification[]>([]);
export const unreadCount = writable<number>(0);
