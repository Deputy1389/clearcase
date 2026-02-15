import type { CaseSummary } from "../api";
import type { PremiumStepGroup } from "../types";
import { daysUntil } from "./formatting";
import { titleize } from "./formatting";

export type ScoredAction = {
  caseId: string;
  caseTitle: string;
  documentType: string | null;
  actionTitle: string;
  consequenceText: string;
  effort: string;
  score: number;
  deadlineDays: number | null;
  group: PremiumStepGroup;
};

export type TopActionsResult = {
  topAction: ScoredAction | null;
  upcomingActions: ScoredAction[];
  totalCount: number;
};

// ── Group weights ────────────────────────────────────────────────────
const GROUP_WEIGHT: Record<PremiumStepGroup, number> = {
  now: 100,
  this_week: 60,
  before_consult: 30,
  after_upload: 10,
};

// ── Score a single action relative to its case ───────────────────────
function scoreAction(
  group: PremiumStepGroup,
  deadlineDays: number | null,
  timeSensitive: boolean,
  confidence: "high" | "medium" | "low"
): number {
  let score = GROUP_WEIGHT[group] ?? 10;

  // Deadline proximity bonus
  if (deadlineDays !== null) {
    if (deadlineDays <= 3) score += 80;
    else if (deadlineDays <= 7) score += 50;
    else if (deadlineDays <= 14) score += 25;
  }

  // Time-sensitive flag bonus
  if (timeSensitive) score += 40;

  // Confidence bonus
  if (confidence === "high") score += 15;
  else if (confidence === "medium") score += 5;

  return Math.min(score, 200);
}

// ── Build default actions from case summary data ─────────────────────
// Since premiumActionSteps from the API/verdict are not always available,
// we derive sensible actions from the CaseSummary fields.
function deriveActionsForCase(c: CaseSummary): ScoredAction[] {
  const days = c.earliestDeadline ? daysUntil(c.earliestDeadline) : null;
  const docLabel = c.documentType ? titleize(c.documentType) : "Document";
  const actions: ScoredAction[] = [];

  // Primary action: respond to deadline if one exists
  if (c.earliestDeadline && days !== null) {
    const urgency: PremiumStepGroup = days <= 3 ? "now" : days <= 7 ? "this_week" : "before_consult";

    actions.push({
      caseId: c.id,
      caseTitle: c.title ?? "Untitled case",
      documentType: c.documentType,
      actionTitle: `Reply to your ${docLabel}`,
      consequenceText: days <= 7
        ? "Missing this could limit your ability to respond before the court date is set."
        : "Addressing this soon helps preserve your options and avoids last-minute preparation stress.",
      effort: days <= 3 ? "~10 min" : "~5 min",
      score: scoreAction(urgency, days, c.timeSensitive, "high"),
      deadlineDays: days,
      group: urgency,
    });
  }

  // Secondary action: upload more evidence if assets are low
  const assetCount = c._count?.assets ?? 0;
  if (assetCount < 2) {
    actions.push({
      caseId: c.id,
      caseTitle: c.title ?? "Untitled case",
      documentType: c.documentType,
      actionTitle: `Upload ${docLabel.toLowerCase()} pages`,
      consequenceText: "More complete documents usually improve deadline detection and checklist accuracy.",
      effort: "~3 min",
      score: scoreAction("after_upload", days, false, "medium"),
      deadlineDays: days,
      group: "after_upload",
    });
  }

  // Tertiary: fill out lawyer prep form if no assets and time-sensitive
  if (c.timeSensitive && assetCount >= 1) {
    actions.push({
      caseId: c.id,
      caseTitle: c.title ?? "Untitled case",
      documentType: c.documentType,
      actionTitle: "Fill out lawyer prep form",
      consequenceText: "A prepared intake form can save time and money during a consultation.",
      effort: "~8 min",
      score: scoreAction("before_consult", days, false, "medium"),
      deadlineDays: days,
      group: "before_consult",
    });
  }

  return actions;
}

// ── Main entry: compute top actions across all cases ─────────────────
export function computeTopActions(cases: CaseSummary[]): TopActionsResult {
  const allActions: ScoredAction[] = [];
  for (const c of cases) {
    if (c.status === "archived") continue;
    allActions.push(...deriveActionsForCase(c));
  }

  allActions.sort((a, b) => b.score - a.score);

  return {
    topAction: allActions[0] ?? null,
    upcomingActions: allActions.slice(1, 3),
    totalCount: allActions.length,
  };
}
