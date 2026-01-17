interface ExchangeRates {
	[currency: string]: number;
}

let cachedRates: ExchangeRates | null = null;
let lastFetch = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export async function getExchangeRates(): Promise<ExchangeRates> {
	const now = Date.now();

	if (cachedRates && now - lastFetch < CACHE_DURATION) {
		return cachedRates;
	}

	try {
		const response = await fetch("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml");
		const xml = await response.text();

		const rates: ExchangeRates = { EUR: 1 };

		const cubeMatches = xml.matchAll(/<Cube currency='([A-Z]{3})' rate='([0-9.]+)'\/>/g);
		for (const match of cubeMatches) {
			const [, currency, rate] = match;
			rates[currency] = Number.parseFloat(rate);
		}

		cachedRates = rates;
		lastFetch = now;

		return rates;
	} catch (error) {
		console.error("Failed to fetch exchange rates:", error);
		if (cachedRates) {
			return cachedRates;
		}
		return { EUR: 1, USD: 1.1, GBP: 0.85, JPY: 130 };
	}
}

export function convertCurrency(
	amount: number,
	fromCurrency: string,
	toCurrency: string,
	rates: ExchangeRates,
): number {
	if (fromCurrency === toCurrency) {
		return amount;
	}

	const amountInEur = fromCurrency === "EUR" ? amount : amount / rates[fromCurrency];
	const convertedAmount = toCurrency === "EUR" ? amountInEur : amountInEur * rates[toCurrency];

	return Math.round(convertedAmount * 100) / 100;
}

export const SUPPORTED_CURRENCIES = [
	"EUR",
	"USD",
	"GBP",
	"JPY",
	"CHF",
	"CAD",
	"AUD",
	"NZD",
	"SEK",
	"NOK",
	"DKK",
	"PLN",
	"CZK",
	"HUF",
	"RON",
	"BGN",
	"HRK",
	"RUB",
	"TRY",
	"BRL",
	"CNY",
	"INR",
	"IDR",
	"KRW",
	"MXN",
	"MYR",
	"PHP",
	"SGD",
	"THB",
	"ZAR",
];
