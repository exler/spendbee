<script lang="ts">
	import { goto } from '$app/navigation';
	import { user, token } from '$lib/stores/auth';
	import { api } from '$lib/api';

	let email = '';
	let password = '';
	let error = '';
	let loading = false;

	async function handleLogin() {
		error = '';
		loading = true;

		try {
			const response = await api.auth.login({ email, password });
			token.set(response.token);
			user.set(response.user);
			goto('/groups');
		} catch (e) {
			error = e instanceof Error ? e.message : 'Login failed';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Login - Spendbee</title>
</svelte:head>

<div
	class="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-dark to-dark-300"
>
	<div class="w-full max-w-md">
		<div class="text-center mb-8">
			<a href="/" class="inline-block">
				<h1 class="text-4xl font-bold text-primary">🐝 Spendbee</h1>
			</a>
			<h2 class="text-2xl font-semibold text-white mt-4">Login</h2>
		</div>

		<form
			on:submit|preventDefault={handleLogin}
			class="bg-dark-300 p-6 rounded-lg shadow-lg space-y-4"
		>
			{#if error}
				<div class="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded">
					{error}
				</div>
			{/if}

			<div>
				<label for="email" class="block text-sm font-medium text-gray-300 mb-2">
					Email
				</label>
				<input
					type="email"
					id="email"
					bind:value={email}
					required
					class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
					placeholder="your@email.com"
				/>
			</div>

			<div>
				<label for="password" class="block text-sm font-medium text-gray-300 mb-2">
					Password
				</label>
				<input
					type="password"
					id="password"
					bind:value={password}
					required
					class="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg text-white focus:outline-none focus:border-primary"
					placeholder="••••••••"
				/>
			</div>

			<button
				type="submit"
				disabled={loading}
				class="w-full bg-primary text-dark py-3 px-6 rounded-lg font-semibold hover:bg-primary-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{loading ? 'Logging in...' : 'Login'}
			</button>

			<p class="text-center text-gray-400">
				Don't have an account?
				<a href="/register" class="text-primary hover:text-primary-400">Register</a>
			</p>
		</form>
	</div>
</div>
