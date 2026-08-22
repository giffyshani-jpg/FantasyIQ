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

export type BasketballLearningSummary = {
  sampleCount: number;
  averageTeamSimilarityPercent: number | null;
  averageAbsoluteProjectionError: number | null;
  exactTeamRatePercent: number | null;
  latestEvaluatedAt: string | null;
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

/**
 * Summarizes completed evaluations without treating unavailable projections as
 * zero. This is intentionally descriptive rather than an automatic model
 * adjustment: the provider-backed prediction remains the source of truth.
 */
export function getBasketballLearningSummary(): BasketballLearningSummary {
  const evaluations = readEvaluations();
  if (evaluations.length === 0) {
    return {
      sampleCount: 0,
      averageTeamSimilarityPercent: null,
      averageAbsoluteProjectionError: null,
      exactTeamRatePercent: null,
      latestEvaluatedAt: null,
    };
  }

  const average = (values: number[]): number | null =>
    values.length > 0
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
  const projectionErrors = evaluations
    .filter((item): item is BasketballPredictionEvaluation & { fantasyPointsDifference: number } =>
      item.fantasyPointsDifference !== null,
    )
    .map((item) => Math.abs(item.fantasyPointsDifference));

  return {
    sampleCount: evaluations.length,
    averageTeamSimilarityPercent: average(evaluations.map((item) => item.teamSimilarityPercent)),
    averageAbsoluteProjectionError: average(projectionErrors),
    exactTeamRatePercent: (evaluations.filter((item) => item.exactTeam).length / evaluations.length) * 100,
    latestEvaluatedAt: evaluations[evaluations.length - 1]?.evaluatedAt ?? null,
  };
}
