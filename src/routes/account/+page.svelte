<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { user } from "$lib/stores/auth";
    import LeftSidebar from "$lib/components/LeftSidebar.svelte";
    import MobileNavbar from "$lib/components/MobileNavbar.svelte";

    let loading = true;
    let savingProfile = false;
    let savingPassword = false;
    let uploadingAvatar = false;
    let error = "";
    let success = "";

    let name = "";
    let email = "";
    let avatarUrl: string | null = null;

    let currentPassword = "";
    let newPassword = "";
    let confirmPassword = "";

    onMount(async () => {
        if (!$user) {
            goto("/login");
            return;
        }

        try {
            const response = await fetchAccount("/account");
            name = response.user.name;
            email = response.user.email;
            avatarUrl = response.user.avatarUrl || null;
            user.set(response.user);
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to load account";
        } finally {
            loading = false;
        }
    });

    function avatarPreview() {
        if (!avatarUrl) return null;
        if (avatarUrl.startsWith("http")) return avatarUrl;
        return `/api/receipts/view/${encodeURIComponent(avatarUrl)}`;
    }

    async function saveProfile() {
        error = "";
        success = "";
        savingProfile = true;

        try {
            const response = await fetchAccount("/account", {
                method: "PATCH",
                body: JSON.stringify({ name }),
            });
            user.set(response.user);
            success = "Profile updated.";
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to update profile";
        } finally {
            savingProfile = false;
        }
    }

    async function changePassword() {
        error = "";
        success = "";

        if (!currentPassword || !newPassword) {
            error = "Fill in your current and new password.";
            return;
        }

        if (newPassword !== confirmPassword) {
            error = "New passwords do not match.";
            return;
        }

        savingPassword = true;

        try {
            await fetchAccount("/account", {
                method: "PATCH",
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            currentPassword = "";
            newPassword = "";
            confirmPassword = "";
            success = "Password updated.";
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to update password";
        } finally {
            savingPassword = false;
        }
    }

    async function handleAvatarChange(event: Event) {
        const input = event.currentTarget as HTMLInputElement;
        if (!input.files?.length) return;

        error = "";
        success = "";
        uploadingAvatar = true;

        try {
            const file = input.files[0];
            const base64 = await readAsDataUrl(file);
            const response = await fetchAccount("/account/avatar", {
                method: "POST",
                body: JSON.stringify({ file: base64, filename: file.name }),
            });
            avatarUrl = response.user.avatarUrl || null;
            user.set(response.user);
            success = "Avatar updated.";
        } catch (e) {
            error = e instanceof Error ? e.message : "Failed to upload avatar";
        } finally {
            uploadingAvatar = false;
            input.value = "";
        }
    }

    function readAsDataUrl(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("Failed to read file"));
            reader.readAsDataURL(file);
        });
    }

    async function fetchAccount(endpoint: string, options: RequestInit = {}) {
        const response = await fetch(`/api${endpoint}`, {
            ...options,
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                ...options.headers,
            },
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || "Request failed");
        }

        return response.json();
    }
</script>

<svelte:head>
    <title>Account - Spendbee</title>
</svelte:head>

<div class="min-h-screen bg-dark-500 text-white">
    <div class="max-w-7xl mx-auto px-4 pb-12">
        <div class="flex min-h-screen gap-6">
            <LeftSidebar active="account" />

            <main class="flex-1">
                <MobileNavbar backHref="/groups" backLabel="Back to dashboard" />
                <div class="hidden lg:block pt-6"></div>
                <div class="pt-6">
                    <div class="mb-8 flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <div class="text-sm uppercase tracking-[0.35em] text-gray-500">Settings</div>
                            <h1 class="text-3xl font-semibold">Your account</h1>
                        </div>
                        <a
                            href="/groups"
                            class="inline-flex items-center gap-2 rounded-xl border border-dark-100/70 bg-dark-300/60 px-4 py-2 text-sm text-gray-200 hover:bg-dark-200/70"
                        >
                            Back to dashboard
                        </a>
                    </div>

                    {#if error}
                        <div class="mb-4 rounded-xl border border-red-500/60 bg-red-900/50 px-4 py-3 text-sm text-red-200">
                            {error}
                        </div>
                    {/if}

                    {#if success}
                        <div class="mb-4 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary">
                            {success}
                        </div>
                    {/if}

                    {#if loading}
                        <div class="rounded-3xl border border-dark-100/60 bg-dark-300/60 p-8 text-gray-400">Loading...</div>
                    {:else}
                        <div class="grid gap-6 lg:grid-cols-[260px,1fr]">
                            <section class="rounded-3xl border border-dark-100/70 bg-dark-300/60 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
                                <div class="text-xs uppercase tracking-[0.3em] text-gray-500">Profile</div>
                                <div class="mt-4 flex flex-col items-center text-center">
                                    <div class="relative">
                                        {#if avatarPreview()}
                                            <img
                                                src={avatarPreview()}
                                                alt="Account avatar"
                                                class="h-40 w-40 rounded-3xl object-cover border border-dark-100"
                                            />
                                        {:else}
                                            <div
                                                class="h-40 w-40 rounded-3xl bg-dark-200 border border-dark-100 flex items-center justify-center text-4xl font-semibold text-primary"
                                            >
                                                {name?.slice(0, 1) || "U"}
                                            </div>
                                        {/if}
                                        <label
                                            class="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-dark shadow-lg cursor-pointer"
                                        >
                                            {uploadingAvatar ? "Uploading..." : "Change"}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                class="hidden"
                                                on:change={handleAvatarChange}
                                                disabled={uploadingAvatar}
                                            />
                                        </label>
                                    </div>
                                    <div class="mt-6 text-lg font-semibold">{name}</div>
                                    <div class="text-sm text-gray-400">{email}</div>
                                </div>
                            </section>

                            <section class="space-y-6">
                                <div class="rounded-3xl border border-dark-100/70 bg-dark-300/60 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
                                    <div class="flex items-center justify-between">
                                        <div>
                                            <div class="text-xs uppercase tracking-[0.3em] text-gray-500">Personal</div>
                                            <h2 class="text-2xl font-semibold mt-2">Profile details</h2>
                                        </div>
                                        <div class="text-xs text-gray-400">Keep your info fresh</div>
                                    </div>

                                    <div class="mt-6 grid gap-5 md:grid-cols-2">
                                        <div>
                                            <label class="text-sm text-gray-300">Name</label>
                                            <input
                                                type="text"
                                                bind:value={name}
                                                class="mt-2 w-full rounded-xl border border-dark-100 bg-dark-200 px-4 py-2 text-white focus:border-primary focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label class="text-sm text-gray-300">Email address</label>
                                            <input
                                                type="email"
                                                value={email}
                                                disabled
                                                class="mt-2 w-full rounded-xl border border-dark-100 bg-dark-200/70 px-4 py-2 text-gray-400"
                                            />
                                            <div class="mt-1 text-xs text-gray-500">
                                                Email changes are managed by admins.
                                            </div>
                                        </div>
                                    </div>

                                    <div class="mt-6 flex justify-end">
                                        <button
                                            on:click={saveProfile}
                                            disabled={savingProfile}
                                            class="rounded-xl bg-primary px-6 py-2 font-semibold text-dark hover:bg-primary-400 disabled:opacity-60"
                                        >
                                            {savingProfile ? "Saving..." : "Save changes"}
                                        </button>
                                    </div>
                                </div>

                                <div class="rounded-3xl border border-dark-100/70 bg-dark-300/60 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
                                    <div class="text-xs uppercase tracking-[0.3em] text-gray-500">Security</div>
                                    <h2 class="text-2xl font-semibold mt-2">Password</h2>
                                    <p class="mt-2 text-sm text-gray-400">
                                        Enter your current password to set a new one.
                                    </p>

                                    <div class="mt-6 grid gap-4 md:grid-cols-3">
                                        <div>
                                            <label class="text-sm text-gray-300">Current password</label>
                                            <input
                                                type="password"
                                                bind:value={currentPassword}
                                                class="mt-2 w-full rounded-xl border border-dark-100 bg-dark-200 px-4 py-2 text-white focus:border-primary focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label class="text-sm text-gray-300">New password</label>
                                            <input
                                                type="password"
                                                bind:value={newPassword}
                                                class="mt-2 w-full rounded-xl border border-dark-100 bg-dark-200 px-4 py-2 text-white focus:border-primary focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label class="text-sm text-gray-300">Confirm new password</label>
                                            <input
                                                type="password"
                                                bind:value={confirmPassword}
                                                class="mt-2 w-full rounded-xl border border-dark-100 bg-dark-200 px-4 py-2 text-white focus:border-primary focus:outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div class="mt-6 flex justify-end">
                                        <button
                                            on:click={changePassword}
                                            disabled={savingPassword}
                                            class="rounded-xl bg-primary px-6 py-2 font-semibold text-dark hover:bg-primary-400 disabled:opacity-60"
                                        >
                                            {savingPassword ? "Updating..." : "Update password"}
                                        </button>
                                    </div>
                                </div>
                            </section>
                        </div>
                    {/if}
                </div>
            </main>
        </div>
    </div>
</div>
