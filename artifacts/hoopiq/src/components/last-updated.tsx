import { useEffect, useState } from "react";

function formatElapsed(timestamp: Date): string {
  const elapsedMs = Math.max(0, Date.now() - timestamp.getTime());
  const minutes = Math.floor(elapsedMs / 60_000);
  return minutes === 0 ? "Just now" : `${minutes} min ago`;
}

export function LastUpdated({ timestamp }: { timestamp: Date | null }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!timestamp) return;
    const id = window.setInterval(() => setTick((value) => value + 1), 15_000);
    return () => window.clearInterval(id);
  }, [timestamp]);

  if (!timestamp) return null;

  return (
    <span className="text-muted-foreground/60" aria-live="polite">
      Last Updated: {formatElapsed(timestamp)}
    </span>
  );
}