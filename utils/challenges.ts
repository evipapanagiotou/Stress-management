// utils/challenges.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export const CHALLENGE_STATS_KEY = "challengeStats:v1";

export type DayKey = string; // YYYY-MM-DD

export type BucketCounts = {
  ge15: number;
  ge20: number;
  ge25: number;
  ge45: number;
  ge90: number;
  ge120: number;
  ge180: number;
  ge240: number;
};

export type ChallengeStats = {
  totalStudyMinutes: number;
  totalSessions: number;

  maxSessionMinutes: number;

  currentConsecutive45: number;
  maxConsecutive45: number;

  dailyStudyMinutes: Record<DayKey, number>;
  dailySessions: Record<DayKey, number>;
  dailyBuckets: Record<DayKey, BucketCounts>;
  dailySubjects: Record<DayKey, string[]>;

  subjectTotals: Record<string, number>;
};

export const getDayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const emptyBuckets = (): BucketCounts => ({
  ge15: 0,
  ge20: 0,
  ge25: 0,
  ge45: 0,
  ge90: 0,
  ge120: 0,
  ge180: 0,
  ge240: 0,
});

const defaultStats = (): ChallengeStats => ({
  totalStudyMinutes: 0,
  totalSessions: 0,
  maxSessionMinutes: 0,
  currentConsecutive45: 0,
  maxConsecutive45: 0,
  dailyStudyMinutes: {},
  dailySessions: {},
  dailyBuckets: {},
  dailySubjects: {},
  subjectTotals: {},
});

export async function loadStats(): Promise<ChallengeStats> {
  try {
    const raw = await AsyncStorage.getItem(CHALLENGE_STATS_KEY);
    if (!raw) return defaultStats();
    const parsed = JSON.parse(raw) as Partial<ChallengeStats>;
    return {
      ...defaultStats(),
      ...parsed,
      dailyStudyMinutes: parsed.dailyStudyMinutes ?? {},
      dailySessions: parsed.dailySessions ?? {},
      dailyBuckets: parsed.dailyBuckets ?? {},
      dailySubjects: parsed.dailySubjects ?? {},
      subjectTotals: parsed.subjectTotals ?? {},
    };
  } catch {
    return defaultStats();
  }
}

export async function saveStats(next: ChallengeStats) {
  await AsyncStorage.setItem(CHALLENGE_STATS_KEY, JSON.stringify(next));
}

export async function resetStats(): Promise<ChallengeStats> {
  const fresh = defaultStats();
  await saveStats(fresh);
  return fresh;
}

/** Call from Pomodoro when a focus session completes */
export async function recordStudySession({
  minutes,
  subject,
  date = new Date(),
}: {
  minutes: number;
  subject?: string;
  date?: Date;
}) {
  const mins = Math.max(0, Math.round(minutes));
  if (!mins) return;

  const day = getDayKey(date);
  const stats = await loadStats();

  stats.totalStudyMinutes += mins;
  stats.totalSessions += 1;
  stats.maxSessionMinutes = Math.max(stats.maxSessionMinutes, mins);

  stats.dailyStudyMinutes[day] = (stats.dailyStudyMinutes[day] ?? 0) + mins;
  stats.dailySessions[day] = (stats.dailySessions[day] ?? 0) + 1;

  const b = stats.dailyBuckets[day] ?? emptyBuckets();
  if (mins >= 15) b.ge15 += 1;
  if (mins >= 20) b.ge20 += 1;
  if (mins >= 25) b.ge25 += 1;
  if (mins >= 45) b.ge45 += 1;
  if (mins >= 90) b.ge90 += 1;
  if (mins >= 120) b.ge120 += 1;
  if (mins >= 180) b.ge180 += 1;
  if (mins >= 240) b.ge240 += 1;
  stats.dailyBuckets[day] = b;

  if (mins >= 45) {
    stats.currentConsecutive45 += 1;
    stats.maxConsecutive45 = Math.max(stats.maxConsecutive45, stats.currentConsecutive45);
  } else {
    stats.currentConsecutive45 = 0;
  }

  const s = (subject ?? "").trim();
  if (s) {
    const arr = stats.dailySubjects[day] ?? [];
    if (!arr.includes(s)) stats.dailySubjects[day] = [...arr, s];
    stats.subjectTotals[s] = (stats.subjectTotals[s] ?? 0) + mins;
  }

  await saveStats(stats);
}

// -------- Challenges definition + progress --------

export type ChallengeDef =
  | { id: string; level: number; title: string; description: string; type: "single_session_minutes"; targetMinutes: number }
  | { id: string; level: number; title: string; description: string; type: "sessions_in_day_min_minutes"; minMinutes: number; targetSessions: number }
  | { id: string; level: number; title: string; description: string; type: "daily_minutes_streak"; minPerDay: number; targetDays: number }
  | { id: string; level: number; title: string; description: string; type: "weekend_total_minutes"; targetMinutes: number }
  | { id: string; level: number; title: string; description: string; type: "weekday_minutes_streak"; minPerWeekday: number; targetWeekdays: number }
  | { id: string; level: number; title: string; description: string; type: "pomodoro_cycles_in_day"; pomodoroMinutes: number; targetCycles: number }
  | { id: string; level: number; title: string; description: string; type: "subjects_in_week"; targetSubjects: number }
  | { id: string; level: number; title: string; description: string; type: "total_minutes"; targetMinutes: number }
  | { id: string; level: number; title: string; description: string; type: "consecutive_sessions_min_minutes"; minMinutes: number; targetSessions: number }
  | { id: string; level: number; title: string; description: string; type: "subjects_in_day"; targetSubjects: number }
  | { id: string; level: number; title: string; description: string; type: "weekly_total_minutes"; targetMinutes: number }
  | { id: string; level: number; title: string; description: string; type: "subject_daily_streak"; minSubjectsPerDay: number; targetDays: number }
  | { id: string; level: number; title: string; description: string; type: "single_subject_total_minutes"; targetMinutes: number }
  | { id: string; level: number; title: string; description: string; type: "rolling_window_minutes"; windowDays: number; targetMinutes: number };

export const CHALLENGES: ChallengeDef[] = [
  { id: "l1", level: 1, title: "First Focus", description: "Complete a 15-minute study session", type: "single_session_minutes", targetMinutes: 15 },
  { id: "l2", level: 2, title: "Building Momentum", description: "Complete 3 sessions of 20+ minutes in one day", type: "sessions_in_day_min_minutes", minMinutes: 20, targetSessions: 3 },
  { id: "l3", level: 3, title: "Consistency Starter", description: "Study 25+ minutes daily for 3 consecutive days", type: "daily_minutes_streak", minPerDay: 25, targetDays: 3 },
  { id: "l4", level: 4, title: "Weekend Warrior", description: "Complete 2 hours of study over a weekend", type: "weekend_total_minutes", targetMinutes: 120 },
  { id: "l5", level: 5, title: "Week Achiever", description: "Study 30+ minutes daily for 5 consecutive weekdays", type: "weekday_minutes_streak", minPerWeekday: 30, targetWeekdays: 5 },
  { id: "l6", level: 6, title: "Pomodoro Novice", description: "Complete 4 Pomodoro cycles (25min) in one day", type: "pomodoro_cycles_in_day", pomodoroMinutes: 25, targetCycles: 4 },
  { id: "l7", level: 7, title: "Subject Explorer", description: "Study 3 different subjects in one week", type: "subjects_in_week", targetSubjects: 3 },
  { id: "l8", level: 8, title: "Marathon Beginner", description: "Complete a single 90-minute study session", type: "single_session_minutes", targetMinutes: 90 },
  { id: "l9", level: 9, title: "Streak Builder", description: "Maintain a 7-day study streak (30+ min/day)", type: "daily_minutes_streak", minPerDay: 30, targetDays: 7 },
  { id: "l10", level: 10, title: "Time Banker", description: "Accumulate 10 total hours of study time", type: "total_minutes", targetMinutes: 600 },
  { id: "l11", level: 11, title: "Focus Master", description: "Complete 5 consecutive 45-minute sessions", type: "consecutive_sessions_min_minutes", minMinutes: 45, targetSessions: 5 },
  { id: "l12", level: 12, title: "Multi-Subject Juggler", description: "Study 4 different subjects in a single day", type: "subjects_in_day", targetSubjects: 4 },
  { id: "l13", level: 13, title: "Weekly Goal Crusher", description: "Complete 15 hours of study in one week", type: "weekly_total_minutes", targetMinutes: 900 },
  { id: "l14", level: 14, title: "Extended Streak", description: "Maintain a 14-day study streak (45+ min/day)", type: "daily_minutes_streak", minPerDay: 45, targetDays: 14 },
  { id: "l15", level: 15, title: "Deep Dive", description: "Complete a single 2-hour focused study session", type: "single_session_minutes", targetMinutes: 120 },
  { id: "l16", level: 16, title: "Triple Subject Master", description: "Study 3 subjects daily for 5 consecutive days", type: "subject_daily_streak", minSubjectsPerDay: 3, targetDays: 5 },
  { id: "l17", level: 17, title: "Power Week", description: "Complete 20 hours of study in one week", type: "weekly_total_minutes", targetMinutes: 1200 },
  { id: "l18", level: 18, title: "Marathon Runner", description: "Complete a single 3-hour study session", type: "single_session_minutes", targetMinutes: 180 },
  { id: "l19", level: 19, title: "Monthly Commitment", description: "Study 1+ hour daily for 21 consecutive days", type: "daily_minutes_streak", minPerDay: 60, targetDays: 21 },
  { id: "l20", level: 20, title: "Subject Specialist", description: "Dedicate 50 hours to a single subject", type: "single_subject_total_minutes", targetMinutes: 3000 },
  { id: "l21", level: 21, title: "Peak Performance", description: "Average 2+ hours daily for 14 consecutive days", type: "daily_minutes_streak", minPerDay: 120, targetDays: 14 },
  { id: "l22", level: 22, title: "Endurance Test", description: "Complete a single 4-hour study session", type: "single_session_minutes", targetMinutes: 240 },
  { id: "l23", level: 23, title: "Habit Master", description: "Maintain a 30-day streak (90+ min/day)", type: "daily_minutes_streak", minPerDay: 90, targetDays: 30 },
  { id: "l24", level: 24, title: "Scholar's Month", description: "Complete 100 total hours in 30 days", type: "rolling_window_minutes", windowDays: 30, targetMinutes: 6000 },
  { id: "l25", level: 25, title: "Study Legend", description: "Maintain 45-day streak (2+ hours daily)", type: "daily_minutes_streak", minPerDay: 120, targetDays: 45 },
];

export type ChallengeProgress = { ratio: number; currentText: string; completed: boolean };
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

const dayKeyToDate = (day: DayKey) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};
const toDayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const getSortedDayKeys = (stats: ChallengeStats): DayKey[] =>
  Object.keys(stats.dailyStudyMinutes || {}).sort((a, b) => dayKeyToDate(a).getTime() - dayKeyToDate(b).getTime());

const getMaxDailyStreak = (stats: ChallengeStats, minPerDay: number): number => {
  const keys = getSortedDayKeys(stats);
  if (!keys.length) return 0;

  let best = 0;
  let cur = 0;

  const first = dayKeyToDate(keys[0]);
  const last = dayKeyToDate(keys[keys.length - 1]);

  for (let d = first; d.getTime() <= last.getTime(); d = addDays(d, 1)) {
    const k = toDayKey(d);
    const mins = stats.dailyStudyMinutes[k] ?? 0;
    if (mins >= minPerDay) {
      cur += 1;
      best = Math.max(best, cur);
    } else cur = 0;
  }
  return best;
};

const getMaxWeekdayStreak = (stats: ChallengeStats, minPerWeekday: number): number => {
  const keys = getSortedDayKeys(stats);
  if (!keys.length) return 0;

  const first = dayKeyToDate(keys[0]);
  const last = dayKeyToDate(keys[keys.length - 1]);

  let best = 0;
  let cur = 0;

  for (let d = first; d.getTime() <= last.getTime(); d = addDays(d, 1)) {
    const dow = d.getDay(); // 0 Sun..6 Sat
    const isWeekday = dow >= 1 && dow <= 5;
    if (!isWeekday) continue;

    const k = toDayKey(d);
    const mins = stats.dailyStudyMinutes[k] ?? 0;
    if (mins >= minPerWeekday) {
      cur += 1;
      best = Math.max(best, cur);
    } else cur = 0;
  }
  return best;
};

const getMaxWeekendTotal = (stats: ChallengeStats): number => {
  const keys = getSortedDayKeys(stats);
  if (!keys.length) return 0;

  const first = dayKeyToDate(keys[0]);
  const last = dayKeyToDate(keys[keys.length - 1]);

  let best = 0;
  for (let d = first; d.getTime() <= last.getTime(); d = addDays(d, 1)) {
    if (d.getDay() !== 6) continue;
    const sat = toDayKey(d);
    const sun = toDayKey(addDays(d, 1));
    const total = (stats.dailyStudyMinutes[sat] ?? 0) + (stats.dailyStudyMinutes[sun] ?? 0);
    best = Math.max(best, total);
  }
  return best;
};

const getMaxSessionsInDayBucket = (stats: ChallengeStats, bucket: keyof BucketCounts): number => {
  const days = Object.keys(stats.dailyBuckets || {});
  let best = 0;
  for (const day of days) {
    const b = stats.dailyBuckets[day];
    if (!b) continue;
    best = Math.max(best, b[bucket] ?? 0);
  }
  return best;
};

const getMaxUniqueSubjectsInDay = (stats: ChallengeStats): number => {
  const days = Object.keys(stats.dailySubjects || {});
  let best = 0;
  for (const day of days) {
    const arr = stats.dailySubjects[day] ?? [];
    best = Math.max(best, arr.length);
  }
  return best;
};

const getMaxUniqueSubjectsInWeek = (stats: ChallengeStats): number => {
  const keys = getSortedDayKeys(stats);
  if (!keys.length) return 0;

  const first = dayKeyToDate(keys[0]);
  const last = dayKeyToDate(keys[keys.length - 1]);

  const weekStartKey = (d: Date) => {
    const x = new Date(d);
    const dow = x.getDay();
    const diffToMon = (dow + 6) % 7;
    x.setDate(x.getDate() - diffToMon);
    return toDayKey(x);
  };

  const map: Record<string, Set<string>> = {};
  for (let d = first; d.getTime() <= last.getTime(); d = addDays(d, 1)) {
    const day = toDayKey(d);
    const subjects = stats.dailySubjects[day] ?? [];
    if (!subjects.length) continue;
    const wk = weekStartKey(d);
    if (!map[wk]) map[wk] = new Set<string>();
    subjects.forEach((s) => map[wk].add(s));
  }

  let best = 0;
  for (const wk of Object.keys(map)) best = Math.max(best, map[wk].size);
  return best;
};

const getMaxWeeklyMinutes = (stats: ChallengeStats): number => {
  const keys = getSortedDayKeys(stats);
  if (!keys.length) return 0;

  const first = dayKeyToDate(keys[0]);
  const last = dayKeyToDate(keys[keys.length - 1]);

  const weekStartKey = (d: Date) => {
    const x = new Date(d);
    const dow = x.getDay();
    const diffToMon = (dow + 6) % 7;
    x.setDate(x.getDate() - diffToMon);
    return toDayKey(x);
  };

  const sums: Record<string, number> = {};
  for (let d = first; d.getTime() <= last.getTime(); d = addDays(d, 1)) {
    const day = toDayKey(d);
    const wk = weekStartKey(d);
    sums[wk] = (sums[wk] ?? 0) + (stats.dailyStudyMinutes[day] ?? 0);
  }

  let best = 0;
  for (const wk of Object.keys(sums)) best = Math.max(best, sums[wk]);
  return best;
};

const getMaxSubjectDailyStreak = (stats: ChallengeStats, minSubjectsPerDay: number): number => {
  const keys = getSortedDayKeys(stats);
  if (!keys.length) return 0;

  const first = dayKeyToDate(keys[0]);
  const last = dayKeyToDate(keys[keys.length - 1]);

  let best = 0;
  let cur = 0;

  for (let d = first; d.getTime() <= last.getTime(); d = addDays(d, 1)) {
    const day = toDayKey(d);
    const count = (stats.dailySubjects[day] ?? []).length;
    if (count >= minSubjectsPerDay) {
      cur += 1;
      best = Math.max(best, cur);
    } else cur = 0;
  }
  return best;
};

const getMaxSingleSubjectTotalMinutes = (stats: ChallengeStats): number => {
  const vals = Object.values(stats.subjectTotals ?? {}).map((n) => Number(n ?? 0));
  return vals.length ? Math.max(...vals) : 0;
};

const getMaxRollingWindowMinutes = (stats: ChallengeStats, windowDays: number): number => {
  const keys = getSortedDayKeys(stats);
  if (!keys.length) return 0;

  const first = dayKeyToDate(keys[0]);
  const last = dayKeyToDate(keys[keys.length - 1]);

  const days: DayKey[] = [];
  for (let d = first; d.getTime() <= last.getTime(); d = addDays(d, 1)) days.push(toDayKey(d));

  const vals = days.map((k) => stats.dailyStudyMinutes[k] ?? 0);

  let best = 0;
  let sum = 0;

  for (let i = 0; i < vals.length; i++) {
    sum += vals[i];
    if (i >= windowDays) sum -= vals[i - windowDays];
    if (i >= windowDays - 1) best = Math.max(best, sum);
  }
  return best;
};

export const computeProgress = (c: ChallengeDef, stats: ChallengeStats): ChallengeProgress => {
  switch (c.type) {
    case "single_session_minutes": {
      const cur = stats.maxSessionMinutes ?? 0;
      const ratio = clamp01(cur / c.targetMinutes);
      return { ratio, currentText: `${Math.min(cur, c.targetMinutes)} / ${c.targetMinutes} min`, completed: cur >= c.targetMinutes };
    }
    case "sessions_in_day_min_minutes": {
      const bucket =
        c.minMinutes >= 240 ? "ge240" :
        c.minMinutes >= 180 ? "ge180" :
        c.minMinutes >= 120 ? "ge120" :
        c.minMinutes >= 90 ? "ge90" :
        c.minMinutes >= 45 ? "ge45" :
        c.minMinutes >= 25 ? "ge25" :
        c.minMinutes >= 20 ? "ge20" :
        "ge15";
      const best = getMaxSessionsInDayBucket(stats, bucket as keyof BucketCounts);
      const ratio = clamp01(best / c.targetSessions);
      return { ratio, currentText: `${Math.min(best, c.targetSessions)} / ${c.targetSessions} sessions`, completed: best >= c.targetSessions };
    }
    case "daily_minutes_streak": {
      const best = getMaxDailyStreak(stats, c.minPerDay);
      const ratio = clamp01(best / c.targetDays);
      return { ratio, currentText: `${Math.min(best, c.targetDays)} / ${c.targetDays} days`, completed: best >= c.targetDays };
    }
    case "weekend_total_minutes": {
      const best = getMaxWeekendTotal(stats);
      const ratio = clamp01(best / c.targetMinutes);
      return { ratio, currentText: `${Math.min(best, c.targetMinutes)} / ${c.targetMinutes} min`, completed: best >= c.targetMinutes };
    }
    case "weekday_minutes_streak": {
      const best = getMaxWeekdayStreak(stats, c.minPerWeekday);
      const ratio = clamp01(best / c.targetWeekdays);
      return { ratio, currentText: `${Math.min(best, c.targetWeekdays)} / ${c.targetWeekdays} weekdays`, completed: best >= c.targetWeekdays };
    }
    case "pomodoro_cycles_in_day": {
      const bucket = c.pomodoroMinutes >= 25 ? "ge25" : "ge15";
      const best = getMaxSessionsInDayBucket(stats, bucket as keyof BucketCounts);
      const ratio = clamp01(best / c.targetCycles);
      return { ratio, currentText: `${Math.min(best, c.targetCycles)} / ${c.targetCycles} cycles`, completed: best >= c.targetCycles };
    }
    case "subjects_in_week": {
      const best = getMaxUniqueSubjectsInWeek(stats);
      const ratio = clamp01(best / c.targetSubjects);
      return { ratio, currentText: `${Math.min(best, c.targetSubjects)} / ${c.targetSubjects} subjects`, completed: best >= c.targetSubjects };
    }
    case "total_minutes": {
      const cur = stats.totalStudyMinutes ?? 0;
      const ratio = clamp01(cur / c.targetMinutes);
      return { ratio, currentText: `${Math.min(cur, c.targetMinutes)} / ${c.targetMinutes} min`, completed: cur >= c.targetMinutes };
    }
    case "consecutive_sessions_min_minutes": {
      const cur = c.minMinutes === 45 ? (stats.maxConsecutive45 ?? 0) : 0;
      const ratio = clamp01(cur / c.targetSessions);
      return { ratio, currentText: `${Math.min(cur, c.targetSessions)} / ${c.targetSessions} sessions`, completed: cur >= c.targetSessions };
    }
    case "subjects_in_day": {
      const best = getMaxUniqueSubjectsInDay(stats);
      const ratio = clamp01(best / c.targetSubjects);
      return { ratio, currentText: `${Math.min(best, c.targetSubjects)} / ${c.targetSubjects} subjects`, completed: best >= c.targetSubjects };
    }
    case "weekly_total_minutes": {
      const best = getMaxWeeklyMinutes(stats);
      const ratio = clamp01(best / c.targetMinutes);
      return { ratio, currentText: `${Math.min(best, c.targetMinutes)} / ${c.targetMinutes} min`, completed: best >= c.targetMinutes };
    }
    case "subject_daily_streak": {
      const best = getMaxSubjectDailyStreak(stats, c.minSubjectsPerDay);
      const ratio = clamp01(best / c.targetDays);
      return { ratio, currentText: `${Math.min(best, c.targetDays)} / ${c.targetDays} days`, completed: best >= c.targetDays };
    }
    case "single_subject_total_minutes": {
      const best = getMaxSingleSubjectTotalMinutes(stats);
      const ratio = clamp01(best / c.targetMinutes);
      return { ratio, currentText: `${Math.min(best, c.targetMinutes)} / ${c.targetMinutes} min`, completed: best >= c.targetMinutes };
    }
    case "rolling_window_minutes": {
      const best = getMaxRollingWindowMinutes(stats, c.windowDays);
      const ratio = clamp01(best / c.targetMinutes);
      return { ratio, currentText: `${Math.min(best, c.targetMinutes)} / ${c.targetMinutes} min`, completed: best >= c.targetMinutes };
    }
    default:
      return { ratio: 0, currentText: "0", completed: false };
  }
};

export const iconForLevel = (level: number) => {
  if (level <= 3) return "play-circle-outline";
  if (level <= 6) return "trending-up-outline";
  if (level <= 9) return "flame-outline";
  if (level <= 12) return "apps-outline";
  if (level <= 15) return "scan-outline";
  if (level <= 18) return "walk-outline";
  if (level <= 21) return "stats-chart-outline";
  return "trophy-outline";
};
