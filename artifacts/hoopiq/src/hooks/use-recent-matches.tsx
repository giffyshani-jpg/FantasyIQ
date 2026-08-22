import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  addRecentMatch,
  clearRecentMatches,
  getStoredRecentMatches,
  type RecentMatch,
} from "../lib/recent-matches";

type RecentMatchesContextValue = {
  recentMatches: RecentMatch[];
  recordMatch: (match: RecentMatch) => void;
  clearAll: () => void;
};

const RecentMatchesContext = createContext<RecentMatchesContextValue | null>(null);

export function RecentMatchesProvider({ children }: { children: ReactNode }) {
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setRecentMatches(getStoredRecentMatches());
  }, []);

  const recordMatch = useCallback((match: RecentMatch) => {
    addRecentMatch(match);
    // Re-read from storage so React state stays in sync with localStorage
    setRecentMatches(getStoredRecentMatches());
  }, []);

  const clearAll = useCallback(() => {
    clearRecentMatches();
    setRecentMatches([]);
  }, []);

  const value = useMemo(
    () => ({ recentMatches, recordMatch, clearAll }),
    [recentMatches, recordMatch, clearAll],
  );

  return (
    <RecentMatchesContext.Provider value={value}>
      {children}
    </RecentMatchesContext.Provider>
  );
}

export function useRecentMatches(): RecentMatchesContextValue {
  const ctx = useContext(RecentMatchesContext);
  if (!ctx) throw new Error("useRecentMatches must be used inside RecentMatchesProvider");
  return ctx;
}
