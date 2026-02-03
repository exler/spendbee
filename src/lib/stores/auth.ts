import { writable } from "svelte/store";
import { browser } from "$app/environment";
import { goto } from "$app/navigation";

interface User {
    id: number;
    email: string;
    name: string;
    createdAt: Date;
}

const storedUser = browser ? localStorage.getItem("user") : null;

export const user = writable<User | null>(storedUser ? JSON.parse(storedUser) : null);

user.subscribe((value) => {
    if (browser) {
        if (value) {
            localStorage.setItem("user", JSON.stringify(value));
        } else {
            localStorage.removeItem("user");
        }
    }
});

export async function logout() {
    // Call server to clear httpOnly cookie
    try {
        await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "include",
        });
    } catch (error) {
        console.error("Logout error:", error);
    }

    // Clear user from store and localStorage
    user.set(null);

    // Redirect to front page
    goto("/");
}
