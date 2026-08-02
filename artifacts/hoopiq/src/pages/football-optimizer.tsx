import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { MobileLayout } from "../components/layout";
import { fetchFootballGame } from "../api";
import {
  autoPickFootballLineup,
  calculateFootballFantasyPoints,
  FOOTBALL_FORMATIONS,
  FOOTBALL_CAPTAIN_MULTIPLIER,
  FOOTBALL_LINEUP_SIZE,
  FOOTBALL_MAX_PLAYERS_PER_TEAM,
  FOOTBALL_VICE_CAPTAIN_MULTIPLIER,
  getFootballPlayerFantasyPoints,
  validateFootballLineup,
  type FootballFormation,
} from "../lib/football-scoring";
import type { FootballGame, FootballPlayer, FootballPosition } from "../lib/football-types";

const POSITIONS: FootballPosition[] = ["GK", "DEF", "MID", "FWD"];
const POSITION_LABELS: Record<FootballPosition, string> = { GK: "Goalkeeper", DEF: "Defender", MID: "Midfielder", FWD: "Forward" };

function formatError(kind: ReturnType<typeof validateFootballLineup>[number]["kind"]): string {
  const labels: Record<string, string> = {
    size: "XI size",
    formation: "formation",
    team_limit: "team limit",
    captain_missing: "Captain",
    vice_captain_missing: "Vice Captain",
    captain_not_selected: "Captain selection",
    vice_captain_not_selected: "Vice Captain selection",
    captain_equals_vice_captain: "Captain and Vice Captain must differ",
    missing_position: "player position",
    duplicate_player: "duplicate player",
    unknown_player: "unknown player",
    budget: "budget",
  };
  return labels[kind] ?? "lineup";
}

function PlayerRow({
  player,
  selected,
  captain,
  viceCaptain,
  onToggle,
  onCaptain,
  onViceCaptain,
}: {
  player: FootballPlayer;
  selected: boolean;
  captain: boolean;
  viceCaptain: boolean;
  onToggle: () => void;
  onCaptain: () => void;
  onViceCaptain: () => void;
}) {
  const points = getFootballPlayerFantasyPoints(player);
  return (
    <div className={`flex items-center gap-2.5 px-4 py-3 border-b border-border/20 last:border-0 ${selected ? "bg-green-950/20" : ""}`}>
      <div className="w-9 h-9 rounded-full bg-muted/50 border border-border/40 flex items-center justify-center text-[9px] font-black shrink-0">
        {player.position ?? "—"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{player.name}</p>
        <p className="text-[10px] text-muted-foreground/60 truncate">
          {player.teamAbbreviation} · {player.statsAvailable ? `${points.toFixed(1)} provider points` : "Stats unavailable"}
          {typeof player.credits === "number" ? ` · ${player.credits} cr` : ""}
        </p>
      </div>
      {selected && (
        <div className="flex gap-1 shrink-0">
          <button type="button" onClick={onCaptain} className={`text-[9px] font-black px-2 py-1 rounded border ${captain ? "bg-yellow-600 border-yellow-500 text-yellow-100" : "border-yellow-700/40 text-yellow-300"}`}>C</button>
          <button type="button" onClick={onViceCaptain} className={`text-[9px] font-black px-2 py-1 rounded border ${viceCaptain ? "bg-blue-600 border-blue-500 text-blue-100" : "border-blue-700/40 text-blue-300"}`}>VC</button>
        </div>
      )}
      <button type="button" onClick={onToggle} className={`text-xs font-bold px-3 py-1.5 rounded-lg border shrink-0 ${selected ? "border-red-700/40 text-red-300" : "border-green-700/40 text-green-300"}`}>
        {selected ? "−" : "+"}
      </button>
    </div>
  );
}

export default function FootballOptimizer() {
  const { id } = useParams<{ leagueId: string; id: string }>();
  const [game, setGame] = useState<FootballGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formation, setFormation] = useState<FootballFormation>("4-4-2");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setError("Match ID is missing.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFootballGame(decodeURIComponent(id)) as FootballGame | null;
      if (!result) throw new Error("This match is not available from TheSportsDB.");
      setGame(result);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Could not load this match.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const players = game?.players ?? [];
  const selectedPlayers = useMemo(() => selectedIds.map((playerId) => players.find((player) => player.id === playerId)).filter((player): player is FootballPlayer => Boolean(player)), [players, selectedIds]);
  const hasCredits = players.length > 0 && players.every((player) => typeof player.credits === "number");
  const budget = hasCredits ? 100 : null;
  const validation = useMemo(() => validateFootballLineup(selectedPlayers, players, {
    formation,
    captainId,
    viceCaptainId,
    budget,
  }), [selectedPlayers, players, formation, captainId, viceCaptainId, budget]);
  const totalPoints = selectedPlayers.reduce((total, player) => {
    const multiplier = player.id === captainId ? FOOTBALL_CAPTAIN_MULTIPLIER : player.id === viceCaptainId ? FOOTBALL_VICE_CAPTAIN_MULTIPLIER : 1;
    return total + calculateFootballFantasyPoints(player.stats, player.position).total * multiplier;
  }, 0);
  const creditsUsed = hasCredits ? selectedPlayers.reduce((sum, player) => sum + (player.credits ?? 0), 0) : null;

  function togglePlayer(player: FootballPlayer) {
    if (selectedIds.includes(player.id)) {
      setSelectedIds((ids) => ids.filter((idValue) => idValue !== player.id));
      if (captainId === player.id) setCaptainId(null);
      if (viceCaptainId === player.id) setViceCaptainId(null);
    } else if (selectedIds.length < FOOTBALL_LINEUP_SIZE) {
      setSelectedIds((ids) => [...ids, player.id]);
    }
  }

  function setCaptain(playerId: string) {
    if (viceCaptainId === playerId) setViceCaptainId(null);
    setCaptainId((current) => current === playerId ? null : playerId);
  }

  function setViceCaptain(playerId: string) {
    if (captainId === playerId) setCaptainId(null);
    setViceCaptainId((current) => current === playerId ? null : playerId);
  }

  function autoPick() {
    const result = autoPickFootballLineup(players, formation, budget);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setSelectedIds(result.players.map((player) => player.id));
    setCaptainId(result.captainId);
    setViceCaptainId(result.viceCaptainId);
    setMessage(`Auto-picked ${result.players.length}-player XI in ${result.formation}.`);
  }

  return (
    <MobileLayout title="Football Optimizer" showBack backHref={`/football/${game?.leagueId ?? ""}/game/${encodeURIComponent(id ?? "")}`}>
      <div className="p-4 sm:p-5 pb-14 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black tracking-tight">Fantasy Football XI</h2>
            {game && <p className="text-sm text-muted-foreground mt-0.5">{game.homeTeam.abbreviation} vs {game.awayTeam.abbreviation}</p>}
          </div>
          <Link href={`/football/${game?.leagueId ?? ""}/game/${encodeURIComponent(id ?? "")}`}>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Match details</span>
          </Link>
        </div>

        {loading && <div className="h-64 rounded-2xl skeleton-shimmer" />}
        {!loading && error && (
          <div className="rounded-2xl border border-red-700/30 bg-red-950/20 px-4 py-6 text-center">
            <p className="text-sm font-bold text-red-300">Optimizer unavailable</p>
            <p className="text-xs text-red-300/65 mt-1">{error}</p>
            <button type="button" onClick={() => void load()} className="mt-3 text-xs font-bold underline">Try again</button>
          </div>
        )}
        {!loading && game && (
          <>
            <div className="rounded-2xl border border-amber-700/35 bg-amber-950/15 px-4 py-4">
              <p className="text-sm font-bold text-amber-200">Optimization requires real player data</p>
              <p className="text-xs text-amber-100/65 mt-1.5 leading-relaxed">
                TheSportsDB free football events currently provide match information but no lineup, positions, player statistics, or fantasy credits. FantasyIQ will not generate synthetic players, ratings, points, or credits.
              </p>
            </div>

            <div className="rounded-2xl border border-border/40 bg-card p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground/70">Formation</span>
                <select value={formation} onChange={(event) => setFormation(event.target.value as FootballFormation)} className="bg-muted/40 border border-border/50 rounded-lg px-2 py-1.5 text-xs font-bold">
                  {Object.keys(FOOTBALL_FORMATIONS).map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-4 gap-2 text-[10px] text-muted-foreground/65">
                {POSITIONS.map((position) => <div key={position} className="rounded-lg bg-muted/20 border border-border/20 px-2 py-2 text-center"><span className="font-black text-foreground">{FOOTBALL_FORMATIONS[formation][position]}</span><br />{POSITION_LABELS[position]}</div>)}
              </div>
              <p className="text-[10px] text-muted-foreground/45 mt-3">Rules: {FOOTBALL_LINEUP_SIZE} players · max {FOOTBALL_MAX_PLAYERS_PER_TEAM} from one team · Captain ×{FOOTBALL_CAPTAIN_MULTIPLIER} · Vice Captain ×{FOOTBALL_VICE_CAPTAIN_MULTIPLIER}</p>
              <button type="button" disabled={!players.length} onClick={autoPick} className="w-full mt-4 rounded-xl bg-green-900/30 border border-green-700/40 text-green-300 text-xs font-black py-2.5 disabled:opacity-40 disabled:cursor-not-allowed">Auto-Pick Best XI</button>
            </div>

            {message && <div className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2 text-xs text-muted-foreground">{message}</div>}

            {players.length === 0 ? (
              <div className="rounded-2xl border border-border/40 bg-card px-4 py-10 text-center">
                <p className="text-2xl mb-2">⚽</p>
                <p className="text-sm font-bold">Football lineup unavailable</p>
                <p className="text-xs text-muted-foreground/60 mt-1.5 leading-relaxed">No real players were returned by the current provider, so Auto-Pick, Captain, Vice Captain, and lineup validation remain unavailable.</p>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-border/40 bg-card p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-widest text-muted-foreground/70">Lineup {selectedPlayers.length}/{FOOTBALL_LINEUP_SIZE}</span>
                    <span className="text-xs font-black text-green-300">{totalPoints.toFixed(1)} pts</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className={`text-[10px] px-2 py-1 rounded-full border ${validation.some((item) => item.kind === "size") ? "border-border/40 text-muted-foreground/60" : "border-green-700/40 text-green-300"}`}>{selectedPlayers.length}/{FOOTBALL_LINEUP_SIZE} players</span>
                    <span className={`text-[10px] px-2 py-1 rounded-full border ${captainId ? "border-yellow-700/40 text-yellow-300" : "border-border/40 text-muted-foreground/60"}`}>{captainId ? "Captain set" : "Captain needed"}</span>
                    <span className={`text-[10px] px-2 py-1 rounded-full border ${viceCaptainId ? "border-blue-700/40 text-blue-300" : "border-border/40 text-muted-foreground/60"}`}>{viceCaptainId ? "VC set" : "VC needed"}</span>
                    {creditsUsed !== null && <span className="text-[10px] px-2 py-1 rounded-full border border-border/40 text-muted-foreground/60">{creditsUsed.toFixed(1)} / {budget} credits</span>}
                  </div>
                  {validation.length > 0 && <p className="mt-3 text-[10px] text-amber-300/75">Needs attention: {Array.from(new Set(validation.map((item) => formatError(item.kind)))).join(", ")}.</p>}
                </div>
                <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
                  {players.map((player) => <PlayerRow key={player.id} player={player} selected={selectedIds.includes(player.id)} captain={captainId === player.id} viceCaptain={viceCaptainId === player.id} onToggle={() => togglePlayer(player)} onCaptain={() => setCaptain(player.id)} onViceCaptain={() => setViceCaptain(player.id)} />)}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </MobileLayout>
  );
}