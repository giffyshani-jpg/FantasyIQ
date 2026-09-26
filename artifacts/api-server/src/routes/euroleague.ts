import { Router, type IRouter } from "express";
import { GetEuroleagueResultsResponseItem } from "@workspace/api-zod";

const router: IRouter = Router();
const OFFICIAL_RESULTS_URL = "https://api-live.euroleague.net/v1/results";

function textOf(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, "i"));
  return match?.[1]?.trim() ?? "";
}

function numberOrNull(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && value !== "" ? parsed : null;
}

function boolOf(value: string): boolean {
  return value.toLowerCase() === "true" || value === "1";
}

function parseGames(xml: string, seasonCode: string) {
  return [...xml.matchAll(/<game>([\s\S]*?)<\/game>/gi)].map((match, index) => {
    const body = match[1] ?? "";
    const gameCode = textOf(body, "gamecode") || `${seasonCode}_${index + 1}`;
    return GetEuroleagueResultsResponseItem.parse({
      id: `euroleague:${gameCode}`,
      seasonCode,
      date: textOf(body, "date"),
      time: textOf(body, "time"),
      gameCode,
      round: textOf(body, "round"),
      gameDay: numberOrNull(textOf(body, "gameday")) ?? 0,
      group: textOf(body, "group"),
      homeTeam: {
        name: textOf(body, "hometeam"),
        code: textOf(body, "homecode"),
        score: numberOrNull(textOf(body, "homescore")),
      },
      awayTeam: {
        name: textOf(body, "awayteam"),
        code: textOf(body, "awaycode"),
        score: numberOrNull(textOf(body, "awayscore")),
      },
      played: boolOf(textOf(body, "played")),
    });
  });
}

router.get("/euroleague/results", async (req, res) => {
  const seasonCode = typeof req.query.seasoncode === "string" && /^[A-Z][A-Z0-9]{4,7}$/.test(req.query.seasoncode)
    ? req.query.seasoncode
    : "E2026";
  try {
    const response = await fetch(`${OFFICIAL_RESULTS_URL}?seasoncode=${encodeURIComponent(seasonCode)}`, {
      headers: { Accept: "application/xml" },
    });
    if (!response.ok) {
      req.log.error({ status: response.status, seasonCode }, "EuroLeague official feed failed");
      return res.status(502).json({ error: "The official EuroLeague feed is unavailable." });
    }
    const xml = await response.text();
    return res.json(parseGames(xml, seasonCode));
  } catch (error) {
    req.log.error({ err: error, seasonCode }, "EuroLeague proxy request failed");
    return res.status(502).json({ error: "The official EuroLeague feed is unavailable." });
  }
});

export default router;