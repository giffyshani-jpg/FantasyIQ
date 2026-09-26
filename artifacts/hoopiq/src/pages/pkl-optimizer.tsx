import React, { useMemo, useState } from "react";
import { MobileLayout } from "../components/layout";
import {
  autoPickPklLineup,
  calculatePklFantasyPoints,
  getPklPlayerFantasyPoints,
  PKL_CAPTAIN_MULTIPLIER,
  PKL_MAX_PLAYERS_PER_TEAM,
  PKL_LINEUP_SIZE,
  PKL_ROLE_LIMITS,
  PKL_VICE_CAPTAIN_MULTIPLIER,
  validatePklLineup,
  type PklPlayer,
  type PklPlayerStats,
  type PklRole,
} from "../lib/pkl-scoring";

const STAT_FIELDS: Array<keyof PklPlayerStats> = [
  "raidPoints", "tacklePoints", "bonusPoints", "superRaids", "superTackles",
  "allOuts", "highFives", "super10s", "doOrDieRaidPoints",
];

function parseStats(value: unknown): PklPlayerStats {
  if (!value || typeof value !== "object") return {};
  const raw = value as Record<string, unknown>;
  const stats: PklPlayerStats = {};
  for (const field of [...STAT_FIELDS, "successfulRaids", "totalRaids", "raidTouches", "tackles", "failedTackles", "greenCards", "yellowCards", "redCards"] as const) {
    const number = Number(raw[field]);
    if (Number.isFinite(number)) stats[field] = number;
  }
  return stats;
}

function parsePlayers(text: string): PklPlayer[] {
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("Import must be a JSON array of real players.");
  return parsed.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error(`Player ${index + 1} is not an object.`);
    const value = raw as Record<string, unknown>;
    const name = typeof value.name === "string" ? value.name.trim() : "";
    if (!name) throw new Error(`Player ${index + 1} is missing name.`);
    const id = typeof value.id === "string" && value.id.trim() ? value.id.trim() : `imported-${index}-${name}`;
    return {
      id,
      name,
      team: typeof value.team === "string" && value.team.trim() ? value.team.trim() : "Unknown",
      role: value.role === "raider" || value.role === "defender" || value.role === "all-rounder" ? value.role : "unknown",
      stats: parseStats(value.stats),
    };
  });
}

function formatError(kind: ReturnType<typeof validatePklLineup>[number]["kind"]): string {
  return {
    size: "7-player lineup",
    duplicate_player: "duplicate player",
    captain_missing: "captain",
    vice_captain_missing: "vice-captain",
    captain_not_selected: "captain selection",
    vice_captain_not_selected: "vice-captain selection",
    captain_equals_vice_captain: "captain and vice-captain must differ",
    unknown_player: "unknown player",
    team_limit: "maximum five players from one team",
    role_minimum: "minimum role requirement",
    role_maximum: "maximum role requirement",
    unknown_role: "every player needs a raider, defender, or all-rounder role",
  }[kind];
}

function PlayerRow({
  player, selected, captain, viceCaptain, onToggle, onCaptain, onViceCaptain,
}: {
  player: PklPlayer;
  selected: boolean;
  captain: boolean;
  viceCaptain: boolean;
  onToggle: () => void;
  onCaptain: () => void;
  onViceCaptain: () => void;
}) {
  const points = getPklPlayerFantasyPoints(player);
  return (
    <div className={`flex items-center gap-2.5 border-b border-border/20 px-4 py-3 ${selected ? "bg-orange-950/20" : ""}`}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{player.name}</p>
        <p className="truncate text-[10px] text-muted-foreground/65">{player.team} · {player.role} · projected {points.toFixed(1)} pts</p>
      </div>
      {selected && <div className="flex shrink-0 gap-1">
        <button type="button" onClick={onCaptain} className={`rounded border px-2 py-1 text-[9px] font-black ${captain ? "border-yellow-500 bg-yellow-600 text-yellow-100" : "border-yellow-700/40 text-yellow-300"}`}>C</button>
        <button type="button" onClick={onViceCaptain} className={`rounded border px-2 py-1 text-[9px] font-black ${viceCaptain ? "border-blue-500 bg-blue-600 text-blue-100" : "border-blue-700/40 text-blue-300"}`}>VC</button>
      </div>}
      <button type="button" onClick={onToggle} className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-bold ${selected ? "border-red-700/40 text-red-300" : "border-orange-700/40 text-orange-300"}`}>{selected ? "−" : "+"}</button>
    </div>
  );
}

export default function PklOptimizer() {
  const [players, setPlayers] = useState<PklPlayer[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const selectedPlayers = useMemo(() => selectedIds.map((id) => players.find((player) => player.id === id)).filter((player): player is PklPlayer => Boolean(player)), [players, selectedIds]);
  const validation = useMemo(() => validatePklLineup(selectedPlayers, players, captainId, viceCaptainId), [selectedPlayers, players, captainId, viceCaptainId]);
  const totalPoints = selectedPlayers.reduce((sum, player) => {
    const multiplier = player.id === captainId ? PKL_CAPTAIN_MULTIPLIER : player.id === viceCaptainId ? PKL_VICE_CAPTAIN_MULTIPLIER : 1;
    return sum + calculatePklFantasyPoints(player.stats).total * multiplier;
  }, 0);

  function togglePlayer(player: PklPlayer) {
    if (selectedIds.includes(player.id)) {
      setSelectedIds((ids) => ids.filter((id) => id !== player.id));
      if (captainId === player.id) setCaptainId(null);
      if (viceCaptainId === player.id) setViceCaptainId(null);
    } else if (selectedIds.length < PKL_LINEUP_SIZE) {
      setSelectedIds((ids) => [...ids, player.id]);
    }
  }

  function setCaptain(id: string) {
    if (viceCaptainId === id) setViceCaptainId(null);
    setCaptainId((current) => current === id ? null : id);
  }

  function setViceCaptain(id: string) {
    if (captainId === id) setCaptainId(null);
    setViceCaptainId((current) => current === id ? null : id);
  }

  function handleImport(event: React.ChangeEvent<HTMLTextAreaElement>) {
    try {
      const imported = parsePlayers(event.target.value);
      setPlayers(imported);
      setSelectedIds([]);
      setCaptainId(null);
      setViceCaptainId(null);
      setMessage(`${imported.length} real player records imported.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not import player data.");
    }
  }

  function autoPick() {
    const result = autoPickPklLineup(players);
    setSelectedIds(result.players.map((player) => player.id));
    setCaptainId(result.captainId);
    setViceCaptainId(result.viceCaptainId);
    setMessage(result.players.length === PKL_LINEUP_SIZE ? "Auto-picked the highest projected seven players." : `Need at least ${PKL_LINEUP_SIZE} imported players for a full lineup.`);
  }

  return (
    <MobileLayout title="PKL Optimizer" showBack backHref="/">
      <div className="flex flex-col gap-4 p-4 pb-14 sm:p-5">
        <div>
          <h2 className="text-2xl font-black tracking-tight">🏐 Fantasy PKL</h2>
          <p className="mt-1 text-sm text-muted-foreground">Dream11 kabaddi scoring · seven-player optimizer</p>
        </div>

        <div className="rounded-2xl border border-orange-700/35 bg-orange-950/15 px-4 py-4">
          <p className="text-sm font-bold text-orange-200">Import real projected player data</p>
          <p className="mt-1.5 text-xs leading-relaxed text-orange-100/70">
            No PKL provider is connected. Paste a JSON array from a trusted source; FantasyIQ will not invent players or fill missing projections.
          </p>
          <textarea
            aria-label="PKL player JSON import"
            className="mt-3 min-h-28 w-full rounded-xl border border-border/40 bg-background/60 p-3 font-mono text-[10px] outline-none"
            placeholder={'[{"id":"p1","name":"Real Player","team":"Team","role":"raider","stats":{"raidPoints":8,"bonusPoints":2}}]'}
            onChange={handleImport}
          />
          <p className="mt-2 text-[10px] text-muted-foreground/60">Required: name, team, role, and projected stats. Dream11-style lineup rules: 7 players, 2–4 raiders, 2–4 defenders, 1–2 all-rounders, and no more than {PKL_MAX_PLAYERS_PER_TEAM} from one team. No credit budget is applied.</p>
        </div>

        <div className="rounded-2xl border border-border/40 bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground/70">Lineup {selectedPlayers.length}/{PKL_LINEUP_SIZE}</span>
            <span className="text-sm font-black text-orange-300">{totalPoints.toFixed(1)} pts</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
            <span className="rounded-full border border-border/40 px-2 py-1">{selectedPlayers.length}/{PKL_LINEUP_SIZE} players</span>
            <span className="rounded-full border border-yellow-700/40 px-2 py-1 text-yellow-300">{captainId ? "Captain ×2" : "Captain needed"}</span>
            <span className="rounded-full border border-blue-700/40 px-2 py-1 text-blue-300">{viceCaptainId ? "VC ×1.5" : "VC needed"}</span>
          </div>
          {validation.length > 0 && <p className="mt-3 text-[10px] text-amber-300/80">Needs attention: {Array.from(new Set(validation.map((error) => formatError(error.kind)))).join(", ")}.</p>}
          <p className="mt-2 text-[10px] text-muted-foreground/55">Role limits: {PKL_ROLE_LIMITS.raider.min}–{PKL_ROLE_LIMITS.raider.max} raiders · {PKL_ROLE_LIMITS.defender.min}–{PKL_ROLE_LIMITS.defender.max} defenders · {PKL_ROLE_LIMITS["all-rounder"].min}–{PKL_ROLE_LIMITS["all-rounder"].max} all-rounders.</p>
          <button type="button" disabled={players.length === 0} onClick={autoPick} className="mt-4 w-full rounded-xl border border-orange-700/40 bg-orange-900/30 py-2.5 text-xs font-black text-orange-300 disabled:cursor-not-allowed disabled:opacity-40">Auto-Pick Best 7</button>
        </div>

        {message && <div className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2 text-xs text-muted-foreground">{message}</div>}

        {players.length > 0 && <div className="overflow-hidden rounded-2xl border border-border/40 bg-card">
          <div className="border-b border-border/30 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-widest text-muted-foreground/70">Imported player pool</span>
              <span className="text-[10px] text-muted-foreground/50">{players.length} players</span>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground/55">Scoring: raid 8 · tackle 20 · bonus 2 · super raid 4 · super tackle 8 · all-out 4 · High 5 8 · Super 10 4.</p>
          </div>
          {players.map((player) => <PlayerRow key={player.id} player={player} selected={selectedIds.includes(player.id)} captain={captainId === player.id} viceCaptain={viceCaptainId === player.id} onToggle={() => togglePlayer(player)} onCaptain={() => setCaptain(player.id)} onViceCaptain={() => setViceCaptain(player.id)} />)}
        </div>}

        {selectedPlayers.length > 0 && <div className="rounded-2xl border border-border/40 bg-card p-4">
          <p className="mb-3 text-xs font-black uppercase tracking-widest text-muted-foreground/70">Scoring breakdown</p>
          <div className="flex flex-col gap-2">
            {selectedPlayers.map((player) => {
              const breakdown = calculatePklFantasyPoints(player.stats);
              const multiplier = player.id === captainId ? PKL_CAPTAIN_MULTIPLIER : player.id === viceCaptainId ? PKL_VICE_CAPTAIN_MULTIPLIER : 1;
              return <div key={player.id} className="flex items-center justify-between gap-3 text-xs"><span className="truncate">{player.name} {multiplier > 1 ? `×${multiplier}` : ""}</span><span className="shrink-0 font-bold text-orange-300">{(breakdown.total * multiplier).toFixed(1)}</span></div>;
            })}
          </div>
        </div>}
      </div>
    </MobileLayout>
  );
}