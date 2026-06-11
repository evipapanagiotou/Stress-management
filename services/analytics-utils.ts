import type { StressEntry } from "../utils/storage";

export type PomodoroSession = {
  id: string;
  startedAt: number;
  plannedMinutes: number;
  actualMinutes: number;
  completed: boolean;
  interruptedCount: number;
  subjectId?: string | null;
  subjectTitle?: string;
};

type WeeklySummary = {
  average: string;
  count: number;
  trend: "increasing" | "decreasing" | "stable";
};

type EfficiencyScore = {
  score: number;
  sessions: number;
};

type CorrelationResult = {
  correlation: number | null;
};

export function weeklyStressSummary(entries: StressEntry[]): WeeklySummary {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = entries.filter((e) => new Date(e.date).getTime() >= cutoff);

  if (recent.length === 0) return { average: "0", count: 0, trend: "stable" };

  const sorted = [...recent].sort((a, b) => a.date.localeCompare(b.date));
  const sum = sorted.reduce((acc, e) => acc + e.level, 0);
  const average = (sum / sorted.length).toFixed(1);

  let trend: "increasing" | "decreasing" | "stable" = "stable";
  if (sorted.length >= 3) {
    const half = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, half).reduce((a, e) => a + e.level, 0) / half;
    const secondHalf = sorted.slice(half).reduce((a, e) => a + e.level, 0) / (sorted.length - half);
    if (secondHalf - firstHalf > 0.4) trend = "increasing";
    else if (firstHalf - secondHalf > 0.4) trend = "decreasing";
  }

  return { average, count: recent.length, trend };
}

export function studyEfficiencyScore(sessions: PomodoroSession[]): EfficiencyScore {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = sessions.filter((s) => s.startedAt >= cutoff);

  if (recent.length === 0) return { score: 0, sessions: 0 };

  const completionRate =
    recent.filter((s) => s.completed).length / recent.length;

  const avgFocus =
    recent.reduce((acc, s) => {
      const ratio = s.plannedMinutes > 0 ? s.actualMinutes / s.plannedMinutes : 0;
      return acc + Math.min(ratio, 1);
    }, 0) / recent.length;

  const avgInterruptions =
    recent.reduce((acc, s) => acc + s.interruptedCount, 0) / recent.length;
  const interruptionPenalty = Math.min(avgInterruptions * 5, 20);

  const score = Math.round(
    completionRate * 50 + avgFocus * 50 - interruptionPenalty
  );

  return { score: Math.max(0, Math.min(100, score)), sessions: recent.length };
}

export function analyzeStressStudyCorrelation(
  stressEntries: StressEntry[],
  sessions: PomodoroSession[]
): CorrelationResult {
  const studyByDay: Record<string, number> = {};
  for (const s of sessions) {
    const day = toDateKey(new Date(s.startedAt));
    studyByDay[day] = (studyByDay[day] ?? 0) + s.actualMinutes;
  }

  const pairs = stressEntries
    .filter((e) => studyByDay[e.date] !== undefined)
    .map((e) => ({ stress: e.level, minutes: studyByDay[e.date] }));

  if (pairs.length < 4) return { correlation: null };

  const n = pairs.length;
  const meanStress = pairs.reduce((a, p) => a + p.stress, 0) / n;
  const meanMinutes = pairs.reduce((a, p) => a + p.minutes, 0) / n;

  let num = 0, denStress = 0, denMinutes = 0;
  for (const p of pairs) {
    const ds = p.stress - meanStress;
    const dm = p.minutes - meanMinutes;
    num += ds * dm;
    denStress += ds * ds;
    denMinutes += dm * dm;
  }

  const den = Math.sqrt(denStress * denMinutes);
  if (den === 0) return { correlation: null };

  return { correlation: Math.round((num / den) * 100) / 100 };
}

function toDateKey(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
