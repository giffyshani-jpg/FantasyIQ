import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, FileImage, Lock, ShieldAlert, Sparkles, Upload, X } from "lucide-react";
import { useLocation } from "wouter";
import { MobileLayout } from "../components/layout";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  createEmptySession,
  loadScreenshotOptimizerSession,
  mergeScreenshotPlayers,
  needsReviewCount,
  saveScreenshotOptimizerSession,
  updateScreenshotPlayer,
  type ScreenshotOptimizerSession,
  type ScreenshotPlayer,
} from "../lib/screenshot-optimizer";
import { recognizeScreenshot, type ScreenshotOcrProgress } from "../lib/screenshot-ocr";

const MAX_SCREENSHOTS = 5;

function fieldStatusLabel(status: ScreenshotPlayer["name"]["status"]): string {
  return status === "needs_review" ? "Needs Review" : status === "not_shown" ? "Not shown" : "Detected";
}

function ReviewBadge({ status }: { status: ScreenshotPlayer["name"]["status"] }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
        status === "needs_review"
          ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
          : status === "not_shown"
            ? "border-border/50 bg-muted/30 text-muted-foreground/60"
            : "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
      }`}
    >
      {status === "needs_review" ? <ShieldAlert className="h-3 w-3" /> : status === "confirmed" ? <Check className="h-3 w-3" /> : null}
      {fieldStatusLabel(status)}
    </span>
  );
}

function stringValue<T>(value: T | null): string {
  return value === null ? "" : String(value);
}

export default function SmartScreenshotOptimizer() {
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [session, setSession] = useState<ScreenshotOptimizerSession>(() => loadScreenshotOptimizerSession() ?? createEmptySession());
  const [processing, setProcessing] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    saveScreenshotOptimizerSession(session);
  }, [session]);

  const reviewCount = useMemo(
    () => session.players.reduce((count, player) => count + needsReviewCount(player), 0),
    [session.players],
  );

  async function handleFiles(files: FileList | File[]) {
    const incoming = Array.from(files);
    if (incoming.length === 0) return;
    if (session.screenshots.length + incoming.length > MAX_SCREENSHOTS) {
      setError(`You can process up to ${MAX_SCREENSHOTS} screenshots per session.`);
      return;
    }
    setError(null);
    for (const file of incoming) {
      if (!file.type.startsWith("image/")) {
        setError(`${file.name} is not an image file.`);
        continue;
      }
      const screenshotId = `screenshot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setProcessing((current) => ({ ...current, [screenshotId]: 0 }));
      try {
        const parsed = await recognizeScreenshot(file, screenshotId, (progress: ScreenshotOcrProgress) => {
          setProcessing((current) => ({ ...current, [screenshotId]: progress.pct }));
        });
        setSession((current) => {
          const screenshots = [...current.screenshots, parsed];
          return { ...current, screenshots, players: mergeScreenshotPlayers(screenshots) };
        });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : `Could not read ${file.name}.`);
      } finally {
        setProcessing((current) => {
          const next = { ...current };
          delete next[screenshotId];
          return next;
        });
      }
    }
  }

  function updateField(
    playerId: string,
    fieldName: "name" | "fantasyPosition" | "credits" | "team" | "selected" | "locked",
    rawValue: string,
  ) {
    const player = session.players.find((candidate) => candidate.id === playerId);
    if (!player) return;
    let value: string | number | boolean | null = rawValue;
    if (fieldName === "credits") {
      const numericValue = Number(rawValue);
      value = rawValue === "" || !Number.isFinite(numericValue) ? null : numericValue;
    }
    if (fieldName === "selected" || fieldName === "locked") {
      value = rawValue === "" ? null : rawValue === "true";
    }
    setSession((current) => updateScreenshotPlayer(current, playerId, fieldName, value));
  }

  function removeScreenshot(id: string) {
    setSession((current) => {
      const screenshots = current.screenshots.filter((screenshot) => screenshot.id !== id);
      return { ...current, screenshots, players: mergeScreenshotPlayers(screenshots) };
    });
  }

  function clearSession() {
    setSession(createEmptySession());
    setError(null);
  }

  function saveForLater() {
    saveScreenshotOptimizerSession(session);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  }

  return (
    <MobileLayout title="Smart Screenshot Optimizer (Beta)" showBack backHref="/">
      <div className="px-4 py-6 sm:px-7 sm:py-8">
        <div className="mb-7">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Sparkles className="h-5 w-5" />
            </span>
            <Badge variant="outline" className="border-primary/30 text-primary">BETA</Badge>
          </div>
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Smart Screenshot Optimizer (Beta)</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Read the fantasy-app data that is visibly present in up to five screenshots. Review every detected field before future optimizer phases use this player pool.
          </p>
        </div>

        <section className="card-glass rounded-2xl border border-border/70 p-4 shadow-lg sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold">Upload screenshots</p>
              <p className="mt-1 text-xs text-muted-foreground/70">{session.screenshots.length}/{MAX_SCREENSHOTS} processed · each image is read independently</p>
            </div>
            <Button onClick={() => fileInputRef.current?.click()} disabled={session.screenshots.length >= MAX_SCREENSHOTS || Object.keys(processing).length > 0}>
              <Upload className="h-4 w-4" />
              Add screenshots
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files) void handleFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={session.screenshots.length >= MAX_SCREENSHOTS}
            className="mt-4 flex min-h-28 w-full flex-col items-center justify-center rounded-xl border border-dashed border-primary/30 bg-primary/[0.04] text-center transition-colors hover:bg-primary/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileImage className="mb-2 h-7 w-7 text-primary/70" />
            <span className="text-sm font-semibold">Drop images here or browse</span>
            <span className="mt-1 text-xs text-muted-foreground/60">PNG, JPG, or WEBP · maximum 5 screenshots</span>
          </button>
          {error && <p className="mt-3 text-xs font-semibold text-red-300">{error}</p>}
          {Object.entries(processing).map(([id, pct]) => (
            <div key={id} className="mt-4 rounded-lg border border-border/50 bg-muted/20 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold">Reading screenshot independently…</span>
                <span className="text-muted-foreground">{pct}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </section>

        {session.screenshots.length > 0 && (
          <section className="mt-5">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <p className="text-sm font-bold">Source screenshots</p>
                <p className="mt-1 text-xs text-muted-foreground/60">Only visible text is carried into the parsed model.</p>
              </div>
              <button type="button" onClick={clearSession} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Clear all</button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {session.screenshots.map((screenshot) => (
                <div key={screenshot.id} className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/60 p-3">
                  <FileImage className="h-5 w-5 shrink-0 text-primary/70" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">{screenshot.fileName}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground/60">{screenshot.players.length} player rows detected · {screenshot.status === "needs_review" ? "review recommended" : "processed"}</p>
                  </div>
                  <button type="button" aria-label={`Remove ${screenshot.fileName}`} onClick={() => removeScreenshot(screenshot.id)} className="rounded-md p-1 text-muted-foreground/60 hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-7">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold">Review parsed player data</p>
              <p className="mt-1 text-xs text-muted-foreground/60">{session.players.length} unique players after merging duplicates · {reviewCount} fields need review</p>
            </div>
            <Button variant="outline" size="sm" onClick={saveForLater} disabled={session.players.length === 0}>
              {saved ? <Check className="h-4 w-4 text-emerald-300" /> : <Lock className="h-4 w-4" />}
              {saved ? "Saved" : "Save parsed data"}
            </Button>
          </div>
          {session.players.length === 0 ? (
            <div className="rounded-2xl border border-border/50 bg-card/40 px-5 py-12 text-center">
              <FileImage className="mx-auto h-8 w-8 text-muted-foreground/30" />
              <p className="mt-3 text-sm font-semibold">Your reviewed player pool will appear here</p>
              <p className="mt-1 text-xs text-muted-foreground/60">Upload a screenshot to begin. No players or values are invented when a field is not visible.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card/50">
              <table className="w-full min-w-[940px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/20 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                    <th className="px-3 py-3 font-bold">Player</th>
                    <th className="px-3 py-3 font-bold">Fantasy position</th>
                    <th className="px-3 py-3 font-bold">Credits</th>
                    <th className="px-3 py-3 font-bold">Team</th>
                    <th className="px-3 py-3 font-bold">Selected</th>
                    <th className="px-3 py-3 font-bold">Locked</th>
                  </tr>
                </thead>
                <tbody>
                  {session.players.map((player) => (
                    <tr key={player.id} className="border-b border-border/40 last:border-0">
                      <td className="px-3 py-3 align-top">
                        <input value={stringValue(player.name.value)} onChange={(event) => updateField(player.id, "name", event.target.value)} className="w-40 rounded-md border border-input bg-background px-2 py-1.5 text-xs font-semibold" />
                        <div className="mt-1"><ReviewBadge status={player.name.status} /></div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <input value={stringValue(player.fantasyPosition.value)} onChange={(event) => updateField(player.id, "fantasyPosition", event.target.value)} placeholder="Not shown" className="w-28 rounded-md border border-input bg-background px-2 py-1.5 text-xs" />
                        <div className="mt-1"><ReviewBadge status={player.fantasyPosition.status} /></div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <input type="number" step="0.01" value={stringValue(player.credits.value)} onChange={(event) => updateField(player.id, "credits", event.target.value)} placeholder="Not shown" className="w-24 rounded-md border border-input bg-background px-2 py-1.5 text-xs" />
                        <div className="mt-1"><ReviewBadge status={player.credits.status} /></div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <input value={stringValue(player.team.value)} onChange={(event) => updateField(player.id, "team", event.target.value)} placeholder="Not shown" className="w-32 rounded-md border border-input bg-background px-2 py-1.5 text-xs" />
                        <div className="mt-1"><ReviewBadge status={player.team.status} /></div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <select value={player.selected.value === null ? "" : String(player.selected.value)} onChange={(event) => updateField(player.id, "selected", event.target.value)} className="w-24 rounded-md border border-input bg-background px-2 py-1.5 text-xs">
                          <option value="">Not shown</option><option value="true">Yes</option><option value="false">No</option>
                        </select>
                        <div className="mt-1"><ReviewBadge status={player.selected.status} /></div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <select value={player.locked.value === null ? "" : String(player.locked.value)} onChange={(event) => updateField(player.id, "locked", event.target.value)} className="w-24 rounded-md border border-input bg-background px-2 py-1.5 text-xs">
                          <option value="">Not shown</option><option value="true">Yes</option><option value="false">No</option>
                        </select>
                        <div className="mt-1"><ReviewBadge status={player.locked.status} /></div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="mt-6 flex items-center justify-between border-t border-border/40 pt-4">
          <button type="button" onClick={() => setLocation("/")} className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to FantasyIQ</button>
          <p className="text-[10px] text-muted-foreground/50">Phase 1 only · no teams generated</p>
        </div>
      </div>
    </MobileLayout>
  );
}