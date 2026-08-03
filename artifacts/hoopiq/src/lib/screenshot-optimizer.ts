export type ScreenshotFieldStatus = "confirmed" | "needs_review" | "not_shown";

export type ScreenshotField<T> = {
  value: T | null;
  status: ScreenshotFieldStatus;
  confidence: number;
  sourceScreenshotIds: string[];
};

export type ScreenshotPlayer = {
  id: string;
  name: ScreenshotField<string>;
  fantasyPosition: ScreenshotField<string>;
  credits: ScreenshotField<number>;
  team: ScreenshotField<string>;
  selected: ScreenshotField<boolean>;
  locked: ScreenshotField<boolean>;
  sourceScreenshotIds: string[];
};

export type ParsedScreenshot = {
  id: string;
  fileName: string;
  processedAt: string;
  rawText: string;
  players: ScreenshotPlayer[];
  status: "processed" | "needs_review" | "error";
  error?: string;
};

export type ScreenshotOptimizerSession = {
  version: 1;
  id: string;
  createdAt: string;
  updatedAt: string;
  screenshots: ParsedScreenshot[];
  players: ScreenshotPlayer[];
};

const STORAGE_KEY = "fantasyiq:smart-screenshot-optimizer";

function nowIso(): string {
  return new Date().toISOString();
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function makeField<T>(
  value: T | null,
  status: ScreenshotFieldStatus,
  confidence: number,
  sourceScreenshotIds: string[],
): ScreenshotField<T> {
  return { value, status, confidence, sourceScreenshotIds };
}

export function createEmptySession(): ScreenshotOptimizerSession {
  const timestamp = nowIso();
  return {
    version: 1,
    id: `screenshot-session-${Date.now()}`,
    createdAt: timestamp,
    updatedAt: timestamp,
    screenshots: [],
    players: [],
  };
}

export function saveScreenshotOptimizerSession(
  session: ScreenshotOptimizerSession,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...session, updatedAt: nowIso() }),
  );
}

export function loadScreenshotOptimizerSession(): ScreenshotOptimizerSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ScreenshotOptimizerSession;
    if (parsed.version !== 1 || !Array.isArray(parsed.players)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function combineField<T>(
  current: ScreenshotField<T>,
  incoming: ScreenshotField<T>,
): ScreenshotField<T> {
  const values = [current, incoming].filter(
    (candidate) => candidate.value !== null,
  );
  const best = values.sort((a, b) => b.confidence - a.confidence)[0];
  if (!best) {
    return makeField<T>(
      null,
      "not_shown",
      0,
      [...new Set([...current.sourceScreenshotIds, ...incoming.sourceScreenshotIds])],
    );
  }
  return {
    value: best.value,
    status: best.status,
    confidence: best.confidence,
    sourceScreenshotIds: [
      ...new Set([
        ...current.sourceScreenshotIds,
        ...incoming.sourceScreenshotIds,
      ]),
    ],
  };
}

export function mergeScreenshotPlayers(
  screenshots: ParsedScreenshot[],
): ScreenshotPlayer[] {
  const merged = new Map<string, ScreenshotPlayer>();
  for (const screenshot of screenshots) {
    for (const player of screenshot.players) {
      const key =
        normalize(player.name.value ?? "") ||
        `${screenshot.id}-${player.id}`;
      const current = merged.get(key);
      if (!current) {
        merged.set(key, { ...player });
        continue;
      }
      merged.set(key, {
        ...current,
        name: combineField(current.name, player.name),
        fantasyPosition: combineField(
          current.fantasyPosition,
          player.fantasyPosition,
        ),
        credits: combineField(current.credits, player.credits),
        team: combineField(current.team, player.team),
        selected: combineField(current.selected, player.selected),
        locked: combineField(current.locked, player.locked),
        sourceScreenshotIds: [
          ...new Set([
            ...current.sourceScreenshotIds,
            ...player.sourceScreenshotIds,
          ]),
        ],
      });
    }
  }
  return [...merged.values()];
}

export function updateScreenshotPlayer(
  session: ScreenshotOptimizerSession,
  playerId: string,
  fieldName: keyof Pick<
    ScreenshotPlayer,
    "name" | "fantasyPosition" | "credits" | "team" | "selected" | "locked"
  >,
  value: string | number | boolean | null,
): ScreenshotOptimizerSession {
  return {
    ...session,
    players: session.players.map((player) => {
      if (player.id !== playerId) return player;
      const current = player[fieldName];
      return {
        ...player,
        [fieldName]: {
          ...current,
          value,
          status: value === null || value === "" ? "needs_review" : "confirmed",
          confidence: 1,
        },
      };
    }),
    updatedAt: nowIso(),
  };
}

export function needsReviewCount(player: ScreenshotPlayer): number {
  return [
    player.name,
    player.fantasyPosition,
    player.credits,
    player.team,
    player.selected,
    player.locked,
  ].filter((item) => item.status === "needs_review").length;
}

export function makeParsedField<T>(
  value: T | null,
  confidence: number,
  sourceScreenshotId: string,
): ScreenshotField<T> {
  return makeField(
    value,
    value === null
      ? "not_shown"
      : confidence < 0.78
        ? "needs_review"
        : "confirmed",
    confidence,
    [sourceScreenshotId],
  );
}