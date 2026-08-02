import { useEffect, useMemo, useRef } from "react";
import { Link, useParams } from "wouter";
import { MobileLayout } from "../components/layout";
import { useLiveGame } from "../hooks/use-live-game";
import {
  BasketballPrediction,
  getSavedBasketballPrediction,
} from "../lib/basketball-prediction";
import { calculateFantasyPoints } from "../lib/stats";
import { recordBasketballPredictionEvaluation } from "../lib/basketball-learning";
import { Game, Player } from "../lib/types";

const LINEUP_SIZE = 8;
const MAX_SAME_TEAM = 5;

type ActualPlayer = Player & { teamAbbreviation: string; teamId: string; fantasyPoints: number };

function perfectTeam(game: Game): ActualPlayer[] {
  const allPlayers: ActualPlayer[] = [
    ...game.awayTeam.players.map((player) => ({
      ...player,
      teamAbbreviation: game.awayTeam.abbreviation,
      teamId: game.awayTeam.id,
      fantasyPoints: calculateFantasyPoints(player.stats),
    })),
    ...game.homeTeam.players.map((player) => ({
      ...player,
      teamAbbreviation: game.homeTeam.abbreviation,
      teamId: game.homeTeam.id,
      fantasyPoints: calculateFantasyPoints(player.stats),
    })),
  ].filter((player) => !player.didNotPlay);

  const picked: ActualPlayer[] = [];
  const teamCounts = new Map<string, number>();
  for (const player of allPlayers.sort((a, b) => b.fantasyPoints - a.fantasyPoints)) {
    const count = teamCounts.get(player.teamId) ?? 0;
    if (count >= MAX_SAME_TEAM) continue;
    picked.push(player);
    teamCounts.set(player.teamId, count + 1);
    if (picked.length === LINEUP_SIZE) break;
  }
  return picked;
}

function fmt(value: number | null): string {
  return value === null ? "Unavailable" : value.toFixed(1);
}

function similarity(predictedIds: string[], perfectIds: string[]): number {
  if (predictedIds.length === 0 || perfectIds.length === 0) return 0;
  const actual = new Set(perfectIds);
  return Math.round((predictedIds.filter((id) => actual.has(id)).length / perfectIds.length) * 100);
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-3">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
      {detail && <p className="mt-1 text-[10px] text-muted-foreground">{detail}</p>}
    </div>
  );
}

export default function BasketballAnalysis() {
  const params = useParams();
  const gameId = params.id ?? "";
  const league = params.league as import("../lib/types").LeagueKey;
  const { game, isStale } = useLiveGame(gameId, league);
  const prediction = useMemo(() => getSavedBasketballPrediction(gameId), [gameId]);
  const recorded = useRef(false);
  const actual = useMemo(() => (game?.status === "final" ? perfectTeam(game) : []), [game]);

  useEffect(() => {
    if (!game || game.status !== "final" || !prediction?.available || actual.length < LINEUP_SIZE || recorded.current) return;
    recorded.current = true;
    const perfectFantasyScore = actual.reduce((sum, player) => sum + player.fantasyPoints, 0);
    const predictedIds = prediction.predictedFantasyXi.map((player) => player.playerId);
    recordBasketballPredictionEvaluation({
      gameId,
      league,
      evaluatedAt: new Date().toISOString(),
      predictedPlayerIds: predictedIds,
      perfectPlayerIds: actual.map((player) => player.id),
      predictedFantasyScore: prediction.projectedFantasyScore,
      perfectFantasyScore,
      fantasyPointsDifference: prediction.projectedFantasyScore === null
        ? null
        : round(perfectFantasyScore - prediction.projectedFantasyScore),
      teamSimilarityPercent: similarity(predictedIds, actual.map((player) => player.id)),
      exactTeam: predictedIds.length === actual.length && predictedIds.every((id) => actual.some((player) => player.id === id)),
      featureAvailability: prediction.modelInputs,
    });
  }, [actual, game, gameId, league, prediction]);

  if (!game) {
    return <MobileLayout><div className="p-6 text-sm text-muted-foreground">Loading completed game analysis…</div></MobileLayout>;
  }

  const perfectCaptain = actual[0] ?? null;
  const perfectViceCaptain = actual[1] ?? null;
  const perfectScore = actual.length >= LINEUP_SIZE ? actual.reduce((sum, player) => sum + player.fantasyPoints, 0) : null;
  const predictedIds = new Set(prediction?.predictedFantasyXi.map((player) => player.playerId) ?? []);
  const perfectIds = new Set(actual.map((player) => player.id));
  const correctPicks = actual.filter((player) => predictedIds.has(player.id));
  const missedPicks = actual.filter((player) => !predictedIds.has(player.id));
  const disappointments = (prediction?.predictedFantasyXi ?? [])
    .map((player) => ({ player, actual: game.awayTeam.players.concat(game.homeTeam.players).find((item) => item.id === player.playerId) }))
    .filter((entry) => entry.actual && !entry.actual.didNotPlay)
    .sort((a, b) => calculateFantasyPoints(a.actual!.stats) - calculateFantasyPoints(b.actual!.stats))
    .slice(0, 3);
  const surprises = actual.filter((player) => !predictedIds.has(player.id)).slice(0, 3);
  const exactTeam = actual.length >= LINEUP_SIZE && prediction?.available === true &&
    prediction.predictedFantasyXi.length === actual.length &&
    actual.every((player) => predictedIds.has(player.id));

  return (
    <MobileLayout>
      <div className="px-4 py-5">
        <Link href={`/${league}/game/${gameId}`}>
          <span className="text-xs font-semibold text-primary cursor-pointer">← Match details</span>
        </Link>
        <div className="mt-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">FantasyIQ AI</p>
            <h1 className="mt-1 text-2xl font-bold">Post-game analysis</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {game.awayTeam.abbreviation} at {game.homeTeam.abbreviation} · {isStale ? "provider update may be delayed" : "final box score"}
            </p>
          </div>
        </div>

        {!prediction ? (
          <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-300">
            AI prediction unavailable: no saved pregame prediction was recorded for this match.
          </div>
        ) : prediction.available && actual.length >= LINEUP_SIZE ? (
          <>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <SummaryCard label="Team similarity" value={`${similarity([...predictedIds], [...perfectIds])}%`} />
              <SummaryCard label="AI projected" value={fmt(prediction.projectedFantasyScore)} detail="before tipoff" />
              <SummaryCard label="Perfect XI" value={fmt(perfectScore)} detail="actual points" />
              <SummaryCard
                label="Point difference"
                value={prediction.projectedFantasyScore === null || perfectScore === null ? "Unavailable" : fmt(round(perfectScore - prediction.projectedFantasyScore))}
                detail="perfect minus AI"
              />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="border-b border-border px-3 py-3">
                  <h2 className="text-sm font-bold">AI predicted team</h2>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Captain: {prediction.captain?.name ?? "Unavailable"} · Vice Captain: {prediction.viceCaptain?.name ?? "Unavailable"}
                  </p>
                </div>
                {prediction.predictedFantasyXi.map((player) => (
                  <div key={player.playerId} className="flex items-start justify-between gap-3 border-b border-border px-3 py-3 last:border-b-0">
                    <div>
                      <p className="text-sm font-semibold">{player.name}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">{player.reason}</p>
                    </div>
                    <div className="text-right text-[10px] text-muted-foreground">
                      <p className="font-semibold text-foreground">{fmt(player.projectedFantasyPoints)} projected</p>
                      <p>{player.playerId === prediction.captain?.playerId ? "C" : player.playerId === prediction.viceCaptain?.playerId ? "VC" : "XI"}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="border-b border-border px-3 py-3">
                  <h2 className="text-sm font-bold">Perfect fantasy team</h2>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Captain: {perfectCaptain?.name ?? "Unavailable"} · Vice Captain: {perfectViceCaptain?.name ?? "Unavailable"}
                  </p>
                </div>
                {actual.map((player) => (
                  <div key={player.id} className="flex items-center justify-between gap-3 border-b border-border px-3 py-3 last:border-b-0">
                    <div>
                      <p className="text-sm font-semibold">{player.name}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">{player.teamAbbreviation} · actual box score</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums">{player.fantasyPoints.toFixed(1)}</p>
                      <p className="text-[10px] text-muted-foreground">{player.id === perfectCaptain?.id ? "C" : player.id === perfectViceCaptain?.id ? "VC" : "XI"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-4">
                <h2 className="text-sm font-bold">Correct and missed picks</h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  Correct: {correctPicks.length > 0 ? correctPicks.map((player) => player.name).join(", ") : "None"}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Missed: {missedPicks.length > 0 ? missedPicks.map((player) => player.name).join(", ") : "None"}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Captain comparison: {prediction.captain?.name ?? "Unavailable"} vs {perfectCaptain?.name ?? "Unavailable"}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Vice Captain comparison: {prediction.viceCaptain?.name ?? "Unavailable"} vs {perfectViceCaptain?.name ?? "Unavailable"}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <h2 className="text-sm font-bold">Surprises and disappointments</h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  Biggest surprises: {surprises.length > 0 ? surprises.map((player) => `${player.name} (${player.fantasyPoints.toFixed(1)})`).join(", ") : "None"}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Biggest disappointments: {disappointments.length > 0 ? disappointments.map(({ player, actual: item }) => `${player.name} (${calculateFantasyPoints(item!.stats).toFixed(1)})`).join(", ") : "None"}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-card p-4">
              <h2 className="text-sm font-bold">{exactTeam ? "Why AI succeeded" : "Lessons learned"}</h2>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {exactTeam
                  ? "The AI matched every actual XI slot because the provider supplied enough real historical form, projected minutes, and availability data for the selected rotation."
                  : "This evaluation is stored as a real training example. The next model iteration can compare the available L5/L10/L20, season, home/away, minutes, starter/bench, injury, and rest signals against the players the perfect team required."}
              </p>
            </div>
          </>
        ) : (
          <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-300">
            Perfect-team comparison unavailable: the final provider response did not contain at least {LINEUP_SIZE} players who participated.
          </div>
        )}
      </div>
    </MobileLayout>
  );
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}