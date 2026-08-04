const DEFAULT_MAERSK_API_URL = "https://api.maersk.com";

export class MaerskApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "MaerskApiError";
  }
}

function configuration() {
  const consumerKey = process.env.MAERSK_CONSUMER_KEY?.trim();
  if (!consumerKey) throw new MaerskApiError("Maersk is not configured", 503);

  return {
    consumerKey,
    baseUrl: (process.env.MAERSK_API_BASE_URL || DEFAULT_MAERSK_API_URL).replace(/\/$/, ""),
  };
}

async function maerskGet(path: string, query: URLSearchParams) {
  const { consumerKey, baseUrl } = configuration();
  const response = await fetch(`${baseUrl}${path}?${query}`, {
    headers: { "Consumer-Key": consumerKey },
    signal: AbortSignal.timeout(10_000),
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new MaerskApiError(`Maersk returned HTTP ${response.status}`, response.status);
  }

  return response.json() as Promise<unknown>;
}

export function searchMaerskLocations(cityName: string) {
  return maerskGet("/reference-data/locations", new URLSearchParams({ cityName }));
}

export function getMaerskVessels(imoNumbers: string[]) {
  return maerskGet(
    "/reference-data/vessels",
    new URLSearchParams({ vesselIMONumbers: imoNumbers.join(",") }),
  );
}
