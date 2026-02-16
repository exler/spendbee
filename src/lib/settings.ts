import { env } from "$env/dynamic/public";

export const inviteOnly = env.PUBLIC_IS_INVITE_ONLY?.toLowerCase() !== "false";
