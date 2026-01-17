import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { SUPPORTED_CURRENCIES } from "$lib/server/services/currency";

export const GET: RequestHandler = async () => {
	return json({ currencies: SUPPORTED_CURRENCIES });
};
