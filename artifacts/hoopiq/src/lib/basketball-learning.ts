import { BasketballPrediction } from "./basketball-prediction";

export type BasketballPredictionEvaluation = {
  gameId: string;
  league: string;
  evaluatedAt: string;
  predictedPlayerIds: string[];
  perfectPlayerIds: string[];
  predictedFantasyScore: number | null;
  perfectFantasyScore: number;
  fantasyPointsDifference: number | null;
  teamSimilarityPercent: number;
  exactTeam: boolean;
  featureAvailability: BasketballPrediction["modelInputs"];
};

const STORAGE_KEY = "fantasyiq:basketball-learning:evaluations";

function readEvaluations(): BasketballPredictionEvaluation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordBasketballPredictionEvaluation(
  evaluation: BasketballPredictionEvaluation,
): void {
  if (typeof window === "undefined") return;
  const existing = readEvaluations().filter((item) => item.gameId !== evaluation.gameId);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, evaluation]));
  } catch {
    // Learning is additive; a storage quota error must not block analysis.
  }
}

export function getBasketballLearningEvaluations(): BasketballPredictionEvaluation[] {
  return readEvaluations();
}
