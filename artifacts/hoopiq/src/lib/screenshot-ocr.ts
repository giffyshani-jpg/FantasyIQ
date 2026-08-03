import {
  makeParsedField,
  type ParsedScreenshot,
  type ScreenshotPlayer,
} from "./screenshot-optimizer";

export type ScreenshotOcrProgress =
  | { phase: "loading"; pct: number }
  | { phase: "recognizing"; pct: number }
  | { phase: "done"; pct: 100 };

function cleanLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseCredits(line: string): number | null {
  const match = line.match(/(?:credits?|cr|salary|cost)\s*[:=-]?\s*(\d{1,3}(?:\.\d{1,2})?)/i);
  if (match) return Number(match[1]);
  return null;
}

function parsePosition(line: string): string | null {
  const match = line.match(
    /(?:position|pos|role)\s*[:=-]?\s*(PG|SG|SF|PF|C|G|F|GK|DEF|MID|FWD|ST|WK|BAT|BOWL|AR)\b/i,
  );
  return match?.[1]?.toUpperCase() ?? null;
}

function parseTeam(line: string): string | null {
  const match = line.match(/(?:team|club)\s*[:=-]?\s*([A-Za-z][A-Za-z .&'-]{1,28})$/i);
  return match?.[1]?.trim() ?? null;
}

function parseBoolean(line: string, labels: string[]): boolean | null {
  const lower = line.toLowerCase();
  if (!labels.some((label) => lower.includes(label))) return null;
  if (/\b(no|not|unselected|unlocked)\b/i.test(line)) return false;
  return true;
}

function looksLikeName(line: string): boolean {
  if (line.length < 3 || line.length > 42) return false;
  if (/\d/.test(line)) return false;
  if (
    /^(player|name|position|pos|team|club|credits?|salary|cost|selected|locked|status)$/i.test(
      line,
    ) ||
    /^(player\s+name|fantasy\s+(player|position|credits?)|selected\s+player|locked\s+player|team\s+name|salary\s+credits?)$/i.test(
      line,
    ) ||
    /\b(credits?|salary|cost|position|selected|locked|status)\b/i.test(line) &&
      !/^[A-Za-z.'-]+(?:\s+[A-Za-z.'-]+){1,3}$/.test(line)
  ) {
    return false;
  }
  return /^[A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){1,3}$/.test(line);
}

function parsedPlayer(
  name: string,
  screenshotId: string,
  context: string[],
  index: number,
  ocrConfidence: number,
): ScreenshotPlayer {
  const joined = context.join(" ");
  const credits = parseCredits(joined);
  const fantasyPosition = parsePosition(joined);
  const team = parseTeam(joined);
  const selected = parseBoolean(joined, ["selected", "picked", "added"]);
  const locked = parseBoolean(joined, ["locked", "lock"]);
  const id = `${screenshotId}-player-${index}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const nameConfidence = Math.max(0, Math.min(1, ocrConfidence));
  const relatedConfidence = Math.max(0, Math.min(1, ocrConfidence * 0.9));
  return {
    id,
    name: makeParsedField(name, nameConfidence, screenshotId),
    fantasyPosition: makeParsedField(fantasyPosition, fantasyPosition ? relatedConfidence : 0, screenshotId),
    credits: makeParsedField(credits, credits !== null ? relatedConfidence : 0, screenshotId),
    team: makeParsedField(team, team ? relatedConfidence : 0, screenshotId),
    selected: makeParsedField(selected, selected === null ? 0 : relatedConfidence, screenshotId),
    locked: makeParsedField(locked, locked === null ? 0 : relatedConfidence, screenshotId),
    sourceScreenshotIds: [screenshotId],
  };
}

export async function recognizeScreenshot(
  file: File,
  screenshotId: string,
  onProgress?: (progress: ScreenshotOcrProgress) => void,
): Promise<ParsedScreenshot> {
  onProgress?.({ phase: "loading", pct: 0 });
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (message: { status: string; progress: number }) => {
      const pct = Math.round(message.progress * 100);
      if (message.status === "recognizing text") {
        onProgress?.({ phase: "recognizing", pct });
      } else {
        onProgress?.({ phase: "loading", pct: Math.min(pct, 20) });
      }
    },
  });

  try {
    const objectUrl = URL.createObjectURL(file);
    const result = await worker.recognize(objectUrl);
    URL.revokeObjectURL(objectUrl);
    const resultData = result.data as { text?: string; confidence?: number };
    const rawText = resultData.text ?? "";
    const ocrConfidence =
      typeof resultData.confidence === "number"
        ? resultData.confidence / 100
        : 0;
    const lines = rawText.split(/\r?\n/).map(cleanLine).filter(Boolean);
    const players: ScreenshotPlayer[] = [];
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!looksLikeName(line)) continue;
      players.push(
        parsedPlayer(
          line,
          screenshotId,
          lines.slice(index, index + 3),
          index,
          ocrConfidence,
        ),
      );
    }
    onProgress?.({ phase: "done", pct: 100 });
    return {
      id: screenshotId,
      fileName: file.name,
      processedAt: new Date().toISOString(),
      rawText,
      players,
      status: players.some((player) =>
        Object.values(player).some(
          (value) =>
            typeof value === "object" &&
            value !== null &&
            "status" in value &&
            value.status === "needs_review",
        ),
      )
        ? "needs_review"
        : "processed",
    };
  } finally {
    await worker.terminate();
  }
}