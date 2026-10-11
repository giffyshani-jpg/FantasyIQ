import { Router, type IRouter, type Response } from "express";

type CricketDataMatch = {
  id: string;
  dateTimeGMT: string | null;
  matchType: string | null;
  status: string | null;
  matchStatus: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  homeScore: string | null;
  awayScore: string | null;
  series: string | null;
};

type CricketFeed = {
  matches: CricketDataMatch[];
  fetchedAt: number;
};

const router: IRouter = Router();
const CRICKETDATA_URL = "https://api.cricapi.com/v1/cricScore";
// The free plan allows 100 calls/day. A 16-minute shared server cache uses at
// most about 90 calls/day during continuous traffic and leaves room for restarts.
const CACHE_TTL_MS = 16 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;

let cache: CricketFeed | null = null;
let inFlight: Promise<CricketFeed> | null = null;

function recordOf(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function textOf(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function sanitizeMatch(value: unknown): CricketDataMatch | null {
  const row = recordOf(value);
  if (!row) return null;

  const id = textOf(row.id);
  if (!id) return null;

  return {
    id,
    dateTimeGMT: textOf(row.dateTimeGMT),
    matchType: textOf(row.matchType),
    status: textOf(row.status),
    matchStatus: textOf(row.ms),
    homeTeam: textOf(row.t1),
    awayTeam: textOf(row.t2),
    homeScore: textOf(row.t1s),
    awayScore: textOf(row.t2s),
    series: textOf(row.series),
  };
}

async function requestFeed(apiKey: string): Promise<CricketFeed> {
  const url = new URL(CRICKETDATA_URL);
  url.searchParams.set("apikey", apiKey);

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`CricketData returned HTTP ${response.status}`);
  }

  const payload = recordOf(await response.json());
  if (payload?.status !== "success" || !Array.isArray(payload.data)) {
    throw new Error("CricketData returned an invalid feed");
  }

  const matches = payload.data
    .map(sanitizeMatch)
    .filter((match): match is CricketDataMatch => match !== null);
  const feed = { matches, fetchedAt: Date.now() };
  cache = feed;
  return feed;
}

function refreshFeed(apiKey: string): Promise<CricketFeed> {
  if (inFlight) return inFlight;

  const request = requestFeed(apiKey);
  inFlight = request;
  void request.then(
    () => {
      if (inFlight === request) inFlight = null;
    },
    () => {
      if (inFlight === request) inFlight = null;
    },
  );
  return request;
}

function sendFeed(res: Response, feed: CricketFeed, stale = false) {
  return res.json({
    matches: feed.matches,
    fetchedAt: feed.fetchedAt,
    stale,
  });
}

router.get("/cricket/overview", async (req, res) => {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return sendFeed(res, cache);
  }

  const apiKey = process.env.CRICKETDATA_API_KEY;
  if (!apiKey) {
    if (cache) return sendFeed(res, cache, true);
    return res.status(503).json({ error: "Cricket data is not configured." });
  }

  try {
    const feed = await refreshFeed(apiKey);
    return sendFeed(res, feed);
  } catch {
    // Never include request URLs or upstream payloads in logs: the API key is
    // sent as a query parameter and must remain server-side.
    req.log.error("CricketData overview request failed");
    if (cache) return sendFeed(res, cache, true);
    return res.status(502).json({ error: "The cricket data feed is unavailable." });
  }
});

export default router;
