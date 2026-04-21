import {
  ConnectivityIntel,
  Coordinates,
  CrimeIntel,
  EpcIntel,
  LicensingIntel,
  PostcodeIntelBundle,
  SchoolsIntel,
  SourceMeta,
} from "@/lib/intel/types";

type CacheRecord<T> = { value: T; expiresAt: number };

const cache = new Map<string, CacheRecord<unknown>>();

const TTL = {
  geocode: 60 * 60 * 24,
  crime: 60 * 60 * 6,
  epc: 60 * 60 * 24,
  schools: 60 * 60 * 24,
  connectivity: 60 * 60 * 24,
  intelBundle: 60 * 30,
} as const;

function getCached<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return null;
  }
  return hit.value as T;
}

function setCached<T>(key: string, value: T, ttlSeconds: number): T {
  cache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  return value;
}

function normalizePostcode(postcode: string): string {
  return postcode.trim().toUpperCase().replace(/\s+/g, " ");
}

function buildSource(
  provider: string,
  status: SourceMeta["status"],
  confidence: SourceMeta["confidence"],
  ttlSeconds: number,
  notes?: string,
  cacheHit?: boolean,
): SourceMeta {
  return {
    provider,
    status,
    confidence,
    fetchedAt: new Date().toISOString(),
    ttlSeconds,
    notes,
    cacheHit,
  };
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

export async function resolveCoordinates(postcode: string): Promise<Coordinates | null> {
  const normalized = normalizePostcode(postcode);
  const cacheKey = `geocode:${normalized}`;
  const cached = getCached<Coordinates | null>(cacheKey);
  if (cached !== null) return cached;

  try {
    const encoded = encodeURIComponent(normalized);
    const data = (await fetchJson(`https://api.postcodes.io/postcodes/${encoded}`)) as {
      status?: number;
      result?: { latitude?: number; longitude?: number };
    };

    const coords =
      data.status === 200 && data.result?.latitude && data.result?.longitude
        ? { latitude: data.result.latitude, longitude: data.result.longitude }
        : null;
    return setCached(cacheKey, coords, TTL.geocode);
  } catch {
    return null;
  }
}

export async function getCrimeIntel(postcode: string): Promise<CrimeIntel> {
  const normalized = normalizePostcode(postcode);
  const coordinates = await resolveCoordinates(normalized);
  if (!coordinates) {
    return {
      incidentsLastMonth: null,
      topCategories: [],
      period: null,
      source: buildSource("police.uk", "fallback", "low", TTL.crime, "No coordinate lookup for postcode"),
    };
  }

  const cacheKey = `crime:${coordinates.latitude},${coordinates.longitude}`;
  const cached = getCached<CrimeIntel>(cacheKey);
  if (cached) return { ...cached, source: { ...cached.source, cacheHit: true } };

  try {
    const url = `https://data.police.uk/api/crimes-street/all-crime?lat=${coordinates.latitude}&lng=${coordinates.longitude}`;
    const crimes = (await fetchJson(url)) as Array<{ category?: string; month?: string }>;

    const byCategory = new Map<string, number>();
    for (const row of crimes) {
      const c = row.category ?? "other";
      byCategory.set(c, (byCategory.get(c) ?? 0) + 1);
    }

    const topCategories = [...byCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));

    const result: CrimeIntel = {
      incidentsLastMonth: crimes.length,
      topCategories,
      period: crimes[0]?.month ?? null,
      source: buildSource("police.uk", "live", "high", TTL.crime),
    };
    return setCached(cacheKey, result, TTL.crime);
  } catch {
    return {
      incidentsLastMonth: null,
      topCategories: [],
      period: null,
      source: buildSource("police.uk", "unavailable", "low", TTL.crime, "Police API request failed"),
    };
  }
}

export async function getEpcIntel(postcode: string): Promise<EpcIntel> {
  const normalized = normalizePostcode(postcode);
  const cacheKey = `epc:${normalized}`;
  const cached = getCached<EpcIntel>(cacheKey);
  if (cached) return { ...cached, source: { ...cached.source, cacheHit: true } };

  const apiKey = process.env.EPC_API_KEY;
  if (!apiKey) {
    const fallback: EpcIntel = {
      currentRating: null,
      potentialRating: null,
      currentEfficiency: null,
      potentialEfficiency: null,
      source: buildSource("epc.opendatacommunities.org", "fallback", "low", TTL.epc, "EPC_API_KEY not configured"),
    };
    return setCached(cacheKey, fallback, TTL.epc);
  }

  try {
    const url = `https://epc.opendatacommunities.org/api/v1/domestic/search?postcode=${encodeURIComponent(normalized)}&size=1`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
      },
    });
    if (!response.ok) throw new Error(`EPC status ${response.status}`);

    const data = (await response.json()) as {
      rows?: Array<{
        current_energy_rating?: string;
        potential_energy_rating?: string;
        current_energy_efficiency?: number;
        potential_energy_efficiency?: number;
      }>;
    };

    const row = data.rows?.[0];
    const result: EpcIntel = {
      currentRating: row?.current_energy_rating ?? null,
      potentialRating: row?.potential_energy_rating ?? null,
      currentEfficiency: row?.current_energy_efficiency ?? null,
      potentialEfficiency: row?.potential_energy_efficiency ?? null,
      source: buildSource("epc.opendatacommunities.org", row ? "live" : "fallback", row ? "high" : "low", TTL.epc, row ? undefined : "No EPC rows found for postcode"),
    };
    return setCached(cacheKey, result, TTL.epc);
  } catch {
    const fallback: EpcIntel = {
      currentRating: null,
      potentialRating: null,
      currentEfficiency: null,
      potentialEfficiency: null,
      source: buildSource("epc.opendatacommunities.org", "unavailable", "low", TTL.epc, "EPC API request failed"),
    };
    return setCached(cacheKey, fallback, TTL.epc);
  }
}

export async function getSchoolsIntel(postcode: string): Promise<SchoolsIntel> {
  const normalized = normalizePostcode(postcode);
  const coordinates = await resolveCoordinates(normalized);
  const cacheKey = `schools:${normalized}`;
  const cached = getCached<SchoolsIntel>(cacheKey);
  if (cached) return { ...cached, source: { ...cached.source, cacheHit: true } };

  if (!coordinates) {
    const fallback: SchoolsIntel = {
      radiusMiles: 1,
      totalSchoolsConsidered: null,
      goodOrOutstandingCount: null,
      outstandingCount: null,
      source: buildSource("education.data.gov.uk", "fallback", "low", TTL.schools, "No coordinate lookup for postcode"),
    };
    return setCached(cacheKey, fallback, TTL.schools);
  }

  const apiBase = process.env.SCHOOLS_API_BASE_URL;
  if (!apiBase) {
    const fallback: SchoolsIntel = {
      radiusMiles: 1,
      totalSchoolsConsidered: null,
      goodOrOutstandingCount: null,
      outstandingCount: null,
      source: buildSource(
        "education.data.gov.uk",
        "fallback",
        "low",
        TTL.schools,
        "SCHOOLS_API_BASE_URL not configured; unable to reliably derive Good/Outstanding counts",
      ),
    };
    return setCached(cacheKey, fallback, TTL.schools);
  }

  try {
    const url = `${apiBase}?lat=${coordinates.latitude}&lng=${coordinates.longitude}&radiusMiles=1`;
    const data = (await fetchJson(url)) as {
      total?: number;
      goodOrOutstanding?: number;
      outstanding?: number;
    };

    const result: SchoolsIntel = {
      radiusMiles: 1,
      totalSchoolsConsidered: data.total ?? null,
      goodOrOutstandingCount: data.goodOrOutstanding ?? null,
      outstandingCount: data.outstanding ?? null,
      source: buildSource("education.data.gov.uk", "live", "medium", TTL.schools),
    };
    return setCached(cacheKey, result, TTL.schools);
  } catch {
    const fallback: SchoolsIntel = {
      radiusMiles: 1,
      totalSchoolsConsidered: null,
      goodOrOutstandingCount: null,
      outstandingCount: null,
      source: buildSource("education.data.gov.uk", "unavailable", "low", TTL.schools, "Schools API request failed"),
    };
    return setCached(cacheKey, fallback, TTL.schools);
  }
}

export async function getConnectivityIntel(postcode: string): Promise<ConnectivityIntel> {
  const normalized = normalizePostcode(postcode);
  const cacheKey = `connectivity:${normalized}`;
  const cached = getCached<ConnectivityIntel>(cacheKey);
  if (cached) return { ...cached, source: { ...cached.source, cacheHit: true } };

  const endpoint = process.env.CONNECTIVITY_API_URL;
  if (!endpoint) {
    const fallback: ConnectivityIntel = {
      ultrafastAvailable: null,
      technology: [],
      source: buildSource("connectivity-adapter", "fallback", "low", TTL.connectivity, "CONNECTIVITY_API_URL not configured"),
    };
    return setCached(cacheKey, fallback, TTL.connectivity);
  }

  try {
    const data = (await fetchJson(`${endpoint}?postcode=${encodeURIComponent(normalized)}`)) as {
      ultrafastAvailable?: boolean;
      technology?: string[];
    };

    const result: ConnectivityIntel = {
      ultrafastAvailable: data.ultrafastAvailable ?? null,
      technology: data.technology ?? [],
      source: buildSource("connectivity-adapter", "live", "medium", TTL.connectivity),
    };
    return setCached(cacheKey, result, TTL.connectivity);
  } catch {
    const fallback: ConnectivityIntel = {
      ultrafastAvailable: null,
      technology: [],
      source: buildSource("connectivity-adapter", "unavailable", "low", TTL.connectivity, "Connectivity adapter request failed"),
    };
    return setCached(cacheKey, fallback, TTL.connectivity);
  }
}

export function getLicensingProvision(postcode: string): LicensingIntel {
  const normalized = normalizePostcode(postcode);
  const overrideEnv = process.env.LICENSING_OVERRIDES_JSON;

  const defaultVal = { y1: 750, y6: 750, y11: 750 };
  if (!overrideEnv) {
    return {
      knownOverride: false,
      ...defaultVal,
      notes: "Default licensing provision rule applied",
      source: buildSource("local-policy", "fallback", "medium", TTL.intelBundle),
    };
  }

  try {
    const overrides = JSON.parse(overrideEnv) as Record<string, { y1?: number; y6?: number; y11?: number }>;
    const value = overrides[normalized];
    if (!value) {
      return {
        knownOverride: false,
        ...defaultVal,
        notes: "Default licensing provision rule applied",
        source: buildSource("local-policy", "fallback", "medium", TTL.intelBundle),
      };
    }

    return {
      knownOverride: true,
      y1: value.y1 ?? defaultVal.y1,
      y6: value.y6 ?? defaultVal.y6,
      y11: value.y11 ?? defaultVal.y11,
      notes: "Known postcode override applied",
      source: buildSource("local-policy", "live", "high", TTL.intelBundle),
    };
  } catch {
    return {
      knownOverride: false,
      ...defaultVal,
      notes: "Invalid LICENSING_OVERRIDES_JSON. Default rule applied",
      source: buildSource("local-policy", "fallback", "low", TTL.intelBundle),
    };
  }
}

export async function getPostcodeIntel(postcode: string): Promise<PostcodeIntelBundle> {
  const normalized = normalizePostcode(postcode);
  const cacheKey = `intel-bundle:${normalized}`;
  const cached = getCached<PostcodeIntelBundle>(cacheKey);
  if (cached) return cached;

  const [coordinates, crime, epc, schools, connectivity] = await Promise.all([
    resolveCoordinates(normalized),
    getCrimeIntel(normalized),
    getEpcIntel(normalized),
    getSchoolsIntel(normalized),
    getConnectivityIntel(normalized),
  ]);

  const bundle: PostcodeIntelBundle = {
    postcode,
    normalizedPostcode: normalized,
    coordinates,
    crime,
    epc,
    schools,
    connectivity,
    licensing: getLicensingProvision(normalized),
    generatedAt: new Date().toISOString(),
  };

  return setCached(cacheKey, bundle, TTL.intelBundle);
}
