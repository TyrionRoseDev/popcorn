const BASE_URL = "https://www.doesthedogdie.com";

interface DtddSearchItem {
	id: number;
	tmdbid: number | null;
}

interface DtddSearchResponse {
	items: DtddSearchItem[];
}

/**
 * Look up a title on Does the Dog Die by name and match on TMDB ID.
 * Returns the direct URL if found, null otherwise.
 */
export async function lookupDtddUrl(
	title: string,
	tmdbId: number,
): Promise<string | null> {
	try {
		const url = `${BASE_URL}/dddsearch?q=${encodeURIComponent(title)}`;
		const response = await fetch(url, {
			headers: { Accept: "application/json" },
		});

		if (!response.ok) return null;

		const data = (await response.json()) as DtddSearchResponse;
		const match = data.items.find((item) => item.tmdbid === tmdbId);

		return match ? `${BASE_URL}/media/${match.id}` : null;
	} catch {
		return null;
	}
}
