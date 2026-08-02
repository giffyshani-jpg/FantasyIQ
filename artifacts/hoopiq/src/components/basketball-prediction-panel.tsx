import { useEffect, useMemo } from "react";
import { usePregameIntel } from "../hooks/use-pregame-intel";
import {
  BasketballPrediction,
  BasketballPredictionPlayer,
  buildBasketballPrediction,
  saveBasketballPrediction,
} from "../lib/basketball-prediction";
import { Game } from "../lib/types";

function valueOrUnavailable(value: number | null, suffix = ""): string {
  return value === null ? "Unavailable" : `${value}${suffix}`;
}

function riskClass(risk: BasketballPredictionPlayer["risk"]): string {
  if (risk === "Low") return "text-emerald-400";
  if (risk === "Medium") return "text-amber-400";
  return "text-rose-400";
}

function PlayerRow({
  player,
  role,
}: {
  player: BasketballPredictionPlayer;
  role?: "C" | "VC";
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-3 border-b border-border last:border-b-0">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-sm truncate">{player.name}</span>
          {role && (
            <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary">
              {role}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">{player.teamAbbreviation}</span>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">{player.reason}</p>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
          <span>Min {valueOrUnavailable(player.projectedMinutes)}</span>
          <span>L5 {valueOrUnavailable(player.avgFptsLast5)}</span>
          <span>L10 {valueOrUnavailable(player.avgFptsLast10)}</span>
          <span>Usage {valueOrUnavailable(player.usageProjection, "%")}</span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-bold tabular-nums">
          {valueOrUnavailable(player.projectedFantasyPoints)}
        </div>
        <div className="text-[10px] text-muted-foreground">proj FPTS</div>
        <div className={`mt-1 text-[10px] font-semibold ${riskClass(player.risk)}`}>
          {player.risk ?? "Unavailable"} risk
        </div>
      </div>
    </div>
  );
}

function unavailableBlock(prediction: BasketballPrediction) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4">
      <p className="text-sm font-semibold text-amber-300">AI prediction unavailable</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {prediction.unavailableReason ?? "The provider has not supplied enough real data yet."}
      </p>
      <p className="mt-2 text-[10px] text-muted-foreground">
        No player, score, confidence, or lineup is generated from placeholders.
      </p>
    </div>
  );
}

export function BasketballPredictionPanel({
  game,
  league,
}: {
  game: Game;
  league: import("../lib/types").LeagueKey;
}) {
  const intel = usePregameIntel(game, league);
  const prediction = useMemo(
    () => (intel.away && intel.home
      ? buildBasketballPrediction({ game, away: intel.away, home: intel.home })
      : null),
    [game, intel.away, intel.home],
  );

  useEffect(() => {
    if (prediction?.available) saveBasketballPrediction(prediction);
  }, [prediction]);

  if (game.status !== "scheduled" || !prediction) return null;

  return (
    <section className="border-b border-border bg-background px-4 py-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">FantasyIQ AI</p>
          <h2 className="mt-1 text-lg font-bold">Pregame prediction</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Transparent projection from provider-backed history and availability.
          </p>
        </div>
        {prediction.available && (
          <div className="text-right">
            <div className="text-xl font-bold tabular-nums text-primary">
              {valueOrUnavailable(prediction.projectedFantasyScore)}
            </div>
            <div className="text-[10px] text-muted-foreground">XI projected FPTS</div>
          </div>
        )}
      </div>

      {!prediction.available ? unavailableBlock(prediction) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-lg border border-border bg-card px-2 py-2">
              <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Confidence</div>
              <div className="mt-1 text-sm font-bold">{valueOrUnavailable(prediction.confidencePercent, "%")}</div>
            </div>
            <div className="rounded-lg border border-border bg-card px-2 py-2">
              <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Risk</div>
              <div className={`mt-1 text-sm font-bold ${riskClass(prediction.risk)}`}>{prediction.risk}</div>
            </div>
            <div className="rounded-lg border border-border bg-card px-2 py-2">
              <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Usage</div>
              <div className="mt-1 text-sm font-bold">Unavailable</div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <span className="text-xs font-bold">Best predicted fantasy XI</span>
              <span className="text-[10px] text-muted-foreground">C ×2 · VC ×1.5</span>
            </div>
            {prediction.predictedFantasyXi.map((player) => (
              <PlayerRow
                key={player.playerId}
                player={player}
                role={player.playerId === prediction.captain?.playerId ? "C" : player.playerId === prediction.viceCaptain?.playerId ? "VC" : undefined}
              />
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-3">
              <h3 className="text-xs font-bold">Pick signals</h3>
              <p className="mt-2 text-[11px] text-muted-foreground">
                <span className="font-semibold text-emerald-400">Lock picks:</span>{" "}
                {prediction.lockPicks.length > 0 ? prediction.lockPicks.map((p) => p.name).join(", ") : "Unavailable"}
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                <span className="font-semibold text-primary">Value picks:</span>{" "}
                {prediction.valuePicks.length > 0 ? prediction.valuePicks.map((p) => p.name).join(", ") : "Unavailable"}
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                <span className="font-semibold text-amber-400">Differential picks:</span> Unavailable — provider does not supply contest ownership.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <h3 className="text-xs font-bold">Injury impact</h3>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Out: {prediction.injuryImpact.outPlayers.length > 0 ? prediction.injuryImpact.outPlayers.join(", ") : "None reported"}
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Questionable/GTD: {prediction.injuryImpact.concernPlayers.length > 0 ? prediction.injuryImpact.concernPlayers.join(", ") : "None reported"}
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Known L10 FPTS unavailable from report: {valueOrUnavailable(prediction.injuryImpact.knownAvgFptsLost)}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-muted/20 px-3 py-2.5 text-[10px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Model coverage:</span>{" "}
            L5 {prediction.modelInputs.last5 ? "available" : "Unavailable"} · L10 {prediction.modelInputs.last10 ? "available" : "Unavailable"} ·
            L20 Unavailable · season average Unavailable · home/away available · minutes available · injuries available ·
            opponent defense, pace, usage, rest days, and matchup history Unavailable.
          </div>
        </>
      )}
    </section>
  );
}