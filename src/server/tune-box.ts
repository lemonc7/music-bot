import type { TuneBoxSearchResult, TuneBoxTrack } from "../contract";

type RawTrack = {
  id?: unknown;
  provider?: unknown;
  name?: unknown;
  artists?: unknown;
  album?: unknown;
  cover_url?: unknown;
};

type RawSearchResult = {
  page?: unknown;
  total?: unknown;
  tracks?: unknown;
};

const SEARCH_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 1_000_000;

const normalizeBaseUrl = (value: string): string => {
  const trimmed = value.trim().replace(/\/+$/, "");

  if (!trimmed) {
    throw new Error("Tune Box Base URL is not configured.");
  }

  const url = new URL(trimmed);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Tune Box Base URL must use HTTP or HTTPS.");
  }

  return url.toString().replace(/\/$/, "");
};

const parseTrack = (value: unknown): TuneBoxTrack | null => {
  if (!value || typeof value !== "object") return null;

  const track = value as RawTrack;

  if (
    typeof track.id !== "string" ||
    !track.id.trim() ||
    typeof track.provider !== "string" ||
    !track.provider.trim() ||
    typeof track.name !== "string" ||
    !track.name.trim()
  ) {
    return null;
  }

  const artists = Array.isArray(track.artists)
    ? track.artists.filter(
        (artist): artist is string =>
          typeof artist === "string" && artist.trim().length > 0,
      )
    : [];

  return {
    id: track.id.trim(),
    provider: track.provider.trim(),
    title: track.name.trim(),
    artists,
    album:
      typeof track.album === "string" && track.album.trim()
        ? track.album.trim()
        : null,
    coverUrl:
      typeof track.cover_url === "string" && track.cover_url.trim()
        ? track.cover_url.trim()
        : null,
    durationSeconds: null,
  };
};

const searchTuneBox = async (
  baseUrl: string,
  provider: string,
  query: string,
  page = 1,
): Promise<TuneBoxSearchResult> => {
  const url = new URL("/api/v1/music/search", normalizeBaseUrl(baseUrl));

  url.searchParams.set("provider", provider.trim());
  url.searchParams.set("q", query.trim());
  url.searchParams.set("page", String(Math.max(1, Math.floor(page))));
  url.searchParams.set("limit", "20");

  const response = await fetch(url, {
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(
      detail || `Tune Box search failed with HTTP ${response.status}.`,
    );
  }

  const contentLength = Number(response.headers.get("content-length"));

  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    throw new Error("Tune Box search response is too large.");
  }

  const body = await response.text();

  if (body.length > MAX_RESPONSE_BYTES) {
    throw new Error("Tune Box search response is too large.");
  }

  const parsed = JSON.parse(body) as RawSearchResult;
  const tracks = Array.isArray(parsed.tracks)
    ? parsed.tracks
        .map(parseTrack)
        .filter((track): track is TuneBoxTrack => track !== null)
    : [];

  return {
    tracks,
    page:
      typeof parsed.page === "number" && Number.isFinite(parsed.page)
        ? parsed.page
        : page,
    total:
      typeof parsed.total === "number" && Number.isFinite(parsed.total)
        ? parsed.total
        : tracks.length,
  };
};

const getTuneBoxPreviewUrl = (
  baseUrl: string,
  track: Pick<TuneBoxTrack, "id" | "provider">,
): string => {
  const url = new URL("/api/preview", normalizeBaseUrl(baseUrl));

  url.searchParams.set("provider", track.provider);
  url.searchParams.set("track_id", track.id);

  return url.toString();
};

export { getTuneBoxPreviewUrl, normalizeBaseUrl, searchTuneBox };
