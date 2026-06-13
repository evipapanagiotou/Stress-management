// utils/challenges.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export const CHALLENGE_STATS_KEY = "challengeStats:v1";
const MOOD_LOG_KEY = "MOOD_LOG";

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
  // dedicated per-challenge cumulative minute counters (key = challenge id)
  dedicatedMinutes: Record<string, number>;
  // per-day count of exactly-25-minute sessions (for Pomodoro Novice)
  daily25MinSessions: Record<DayKey, number>;
  // games + wellness tracking
  breathingSessionsTotal: number;
  bubblePopPlays: number;
  bubblePopMaxLevel: number;
  calmingBreathAfter10pm: number;
  // computed from MOOD_LOG at load time (not persisted)
  moodTotalDays: number;
  moodMaxConsecutiveDays: number;
};

export const getDayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const emptyBuckets = (): BucketCounts => ({
  ge15: 0, ge20: 0, ge25: 0, ge45: 0,
  ge90: 0, ge120: 0, ge180: 0, ge240: 0,
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
  dedicatedMinutes: {},
  daily25MinSessions: {},
  breathingSessionsTotal: 0,
  bubblePopPlays: 0,
  bubblePopMaxLevel: 0,
  calmingBreathAfter10pm: 0,
  moodTotalDays: 0,
  moodMaxConsecutiveDays: 0,
});

function computeMoodStreak(sortedDays: string[]): number {
  if (!sortedDays.length) return 0;
  let best = 1, cur = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    const a = new Date(sortedDays[i - 1]!);
    const b = new Date(sortedDays[i]!);
    const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
    if (diff === 1) { cur++; best = Math.max(best, cur); }
    else cur = 1;
  }
  return best;
}

export async function loadStats(): Promise<ChallengeStats> {
  try {
    const [raw, moodRaw] = await Promise.all([
      AsyncStorage.getItem(CHALLENGE_STATS_KEY),
      AsyncStorage.getItem(MOOD_LOG_KEY),
    ]);

    const parsed = (raw ? JSON.parse(raw) : {}) as Partial<ChallengeStats>;

    let moodTotalDays = 0, moodMaxConsecutiveDays = 0;
    try {
      const moodLog: { date: string }[] = moodRaw ? JSON.parse(moodRaw) : [];
      const moodDays = [...new Set(moodLog.map((e) => e.date))].sort();
      moodTotalDays = moodDays.length;
      moodMaxConsecutiveDays = computeMoodStreak(moodDays);
    } catch {}

    return {
      ...defaultStats(),
      ...parsed,
      dailyStudyMinutes: parsed.dailyStudyMinutes ?? {},
      dailySessions: parsed.dailySessions ?? {},
      dailyBuckets: parsed.dailyBuckets ?? {},
      dailySubjects: parsed.dailySubjects ?? {},
      subjectTotals: parsed.subjectTotals ?? {},
      dedicatedMinutes: parsed.dedicatedMinutes ?? {},
      daily25MinSessions: parsed.daily25MinSessions ?? {},
      breathingSessionsTotal: parsed.breathingSessionsTotal ?? 0,
      bubblePopPlays: parsed.bubblePopPlays ?? 0,
      bubblePopMaxLevel: parsed.bubblePopMaxLevel ?? 0,
      calmingBreathAfter10pm: parsed.calmingBreathAfter10pm ?? 0,
      moodTotalDays,
      moodMaxConsecutiveDays,
    };
  } catch {
    return defaultStats();
  }
}

export async function saveStats(next: ChallengeStats) {
  // moodTotalDays / moodMaxConsecutiveDays are computed at load — no need to persist
  await AsyncStorage.setItem(CHALLENGE_STATS_KEY, JSON.stringify({
    ...next,
    moodTotalDays: undefined,
    moodMaxConsecutiveDays: undefined,
  }));
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

  // Marathon challenges: dedicated cumulative counters, count every session (no minimum)
  for (const c of CHALLENGES) {
    if (c.type === "dedicated_cumulative_minutes") {
      const cur = stats.dedicatedMinutes[c.id] ?? 0;
      if (cur < c.targetMinutes) {
        stats.dedicatedMinutes[c.id] = Math.min(cur + mins, c.targetMinutes);
      }
    }
  }

  // All sessions count toward totals and daily minutes (no global minimum)
  stats.totalStudyMinutes += mins;
  stats.totalSessions += 1;
  stats.maxSessionMinutes = Math.max(stats.maxSessionMinutes, mins);
  stats.dailyStudyMinutes[day] = (stats.dailyStudyMinutes[day] ?? 0) + mins;
  stats.dailySessions[day] = (stats.dailySessions[day] ?? 0) + 1;

  // Bucket counts — each bucket enforces its own threshold
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

  // Pomodoro Novice: count only exactly-25-minute sessions
  if (mins === 25) {
    stats.daily25MinSessions[day] = (stats.daily25MinSessions[day] ?? 0) + 1;
  }

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

/** Call from games screen when a breathing session completes */
export async function recordBreathingSession({
  kind,
  hour,
}: {
  kind: "calming" | "box";
  hour: number;
}) {
  const stats = await loadStats();
  stats.breathingSessionsTotal += 1;
  if (kind === "calming" && hour >= 22) {
    stats.calmingBreathAfter10pm += 1;
  }
  await saveStats(stats);
}

/** Call from games screen when a Bubble Pop session is finished */
export async function recordBubblePopPlay({ maxLevel }: { maxLevel: number }) {
  const stats = await loadStats();
  stats.bubblePopPlays += 1;
  stats.bubblePopMaxLevel = Math.max(stats.bubblePopMaxLevel, maxLevel);
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
  | { id: string; level: number; title: string; description: string; type: "weekly_total_minutes"; targetMinutes: number }
  | { id: string; level: number; title: string; description: string; type: "breathing_sessions_total"; targetSessions: number }
  | { id: string; level: number; title: string; description: string; type: "mood_consecutive_days"; targetDays: number }
  | { id: string; level: number; title: string; description: string; type: "mood_total_days"; targetDays: number }
  | { id: string; level: number; title: string; description: string; type: "bubble_pop_plays"; targetPlays: number }
  | { id: string; level: number; title: string; description: string; type: "bubble_pop_max_level"; targetLevel: number }
  | { id: string; level: number; title: string; description: string; type: "calming_breath_after_10pm"; target: number }
  | { id: string; level: number; title: string; description: string; type: "dedicated_cumulative_minutes"; targetMinutes: number };

export const CHALLENGES: ChallengeDef[] = [
  { id: "l1",  level: 1,  title: "First Focus",           description: "Complete a 15-minute study session",                           type: "single_session_minutes",    targetMinutes: 15 },
  { id: "l2",  level: 2,  title: "Building Momentum",     description: "Complete 3 sessions of 20+ minutes in one day",               type: "sessions_in_day_min_minutes", minMinutes: 20, targetSessions: 3 },
  { id: "l3",  level: 3,  title: "Consistency Starter",   description: "Study 25+ minutes daily for 3 consecutive days",              type: "daily_minutes_streak",      minPerDay: 25, targetDays: 3 },
  { id: "l4",  level: 4,  title: "Weekend Warrior",       description: "Complete 2 hours of study over a weekend",                    type: "weekend_total_minutes",     targetMinutes: 120 },
  { id: "l5",  level: 5,  title: "Week Achiever",         description: "Study 30+ minutes daily for 5 consecutive weekdays",          type: "weekday_minutes_streak",    minPerWeekday: 30, targetWeekdays: 5 },
  { id: "l6",  level: 6,  title: "Pomodoro Novice",       description: "Complete 4 Pomodoro cycles (25 min) in one day",             type: "pomodoro_cycles_in_day",    pomodoroMinutes: 25, targetCycles: 4 },
  { id: "l7",  level: 7,  title: "Subject Explorer",      description: "Study 2 different subjects in one week",                      type: "subjects_in_week",          targetSubjects: 2 },
  { id: "l8",  level: 8,  title: "Marathon Beginner",     description: "Accumulate 90 minutes of study across sessions",             type: "dedicated_cumulative_minutes", targetMinutes: 90 },
  { id: "l9",  level: 9,  title: "Streak Builder",        description: "Maintain a 7-day study streak (30+ min/day)",                type: "daily_minutes_streak",      minPerDay: 30, targetDays: 7 },
  { id: "l10", level: 10, title: "Time Banker",           description: "Accumulate 10 total hours of study time",                     type: "total_minutes",             targetMinutes: 600 },
  { id: "l11", level: 11, title: "First Breaths",         description: "Complete 3 breathing exercises",                              type: "breathing_sessions_total",  targetSessions: 3 },
  { id: "l12", level: 12, title: "Mood Tracker Starter",  description: "Log your mood for 5 consecutive days",                        type: "mood_consecutive_days",     targetDays: 5 },
  { id: "l13", level: 13, title: "Weekly Goal Crusher",   description: "Complete 15 hours of study in one week",                      type: "weekly_total_minutes",      targetMinutes: 900 },
  { id: "l14", level: 14, title: "Mood Awareness",        description: "Use the Mood Tracker for 10 days",                            type: "mood_total_days",           targetDays: 10 },
  { id: "l15", level: 15, title: "Bubble Buster",         description: "Play Bubble Pop 5 times for relaxation",                      type: "bubble_pop_plays",          targetPlays: 5 },
  { id: "l16", level: 16, title: "Breathing Master",      description: "Complete 15 breathing exercises in total",                    type: "breathing_sessions_total",  targetSessions: 15 },
  { id: "l17", level: 17, title: "Power Week",            description: "Complete 20 hours of study in one week",                      type: "weekly_total_minutes",      targetMinutes: 1200 },
  { id: "l18", level: 18, title: "Marathon Runner",       description: "Accumulate 3 hours of study across sessions",                type: "dedicated_cumulative_minutes", targetMinutes: 180 },
  { id: "l19", level: 19, title: "Bubble Champion",       description: "Reach Level 3 in Bubble Pop",                                 type: "bubble_pop_max_level",      targetLevel: 3 },
  { id: "l20", level: 20, title: "Night Calm",            description: "Complete a Calming Breathing (4-2-6) after 10 PM",           type: "calming_breath_after_10pm", target: 1 },
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
  let best = 0, cur = 0;
  const first = dayKeyToDate(keys[0]);
  const last = dayKeyToDate(keys[keys.length - 1]);
  for (let d = first; d.getTime() <= last.getTime(); d = addDays(d, 1)) {
    const k = toDayKey(d);
    const mins = stats.dailyStudyMinutes[k] ?? 0;
    if (mins >= minPerDay) { cur += 1; best = Math.max(best, cur); }
    else cur = 0;
  }
  return best;
};

const getMaxWeekdayStreak = (stats: ChallengeStats, minPerWeekday: number): number => {
  const keys = getSortedDayKeys(stats);
  if (!keys.length) return 0;
  const first = dayKeyToDate(keys[0]);
  const last = dayKeyToDate(keys[keys.length - 1]);
  let best = 0, cur = 0;
  for (let d = first; d.getTime() <= last.getTime(); d = addDays(d, 1)) {
    const dow = d.getDay();
    if (dow < 1 || dow > 5) continue;
    const k = toDayKey(d);
    const mins = stats.dailyStudyMinutes[k] ?? 0;
    if (mins >= minPerWeekday) { cur += 1; best = Math.max(best, cur); }
    else cur = 0;
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

const getMaxDaily25MinSessions = (stats: ChallengeStats): number => {
  let best = 0;
  for (const day of Object.keys(stats.daily25MinSessions || {})) {
    best = Math.max(best, stats.daily25MinSessions[day] ?? 0);
  }
  return best;
};

const getMaxSessionsInDayBucket = (stats: ChallengeStats, bucket: keyof BucketCounts): number => {
  let best = 0;
  for (const day of Object.keys(stats.dailyBuckets || {})) {
    const b = stats.dailyBuckets[day];
    if (b) best = Math.max(best, b[bucket] ?? 0);
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
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
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
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
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

export const computeProgress = (c: ChallengeDef, stats: ChallengeStats): ChallengeProgress => {
  switch (c.type) {
    case "single_session_minutes": {
      const cur = stats.maxSessionMinutes ?? 0;
      return { ratio: clamp01(cur / c.targetMinutes), currentText: `${Math.min(cur, c.targetMinutes)} / ${c.targetMinutes} min`, completed: cur >= c.targetMinutes };
    }
    case "sessions_in_day_min_minutes": {
      const bucket =
        c.minMinutes >= 240 ? "ge240" : c.minMinutes >= 180 ? "ge180" : c.minMinutes >= 120 ? "ge120" :
        c.minMinutes >= 90 ? "ge90" : c.minMinutes >= 45 ? "ge45" : c.minMinutes >= 25 ? "ge25" :
        c.minMinutes >= 20 ? "ge20" : "ge15";
      const best = getMaxSessionsInDayBucket(stats, bucket as keyof BucketCounts);
      return { ratio: clamp01(best / c.targetSessions), currentText: `${Math.min(best, c.targetSessions)} / ${c.targetSessions} sessions`, completed: best >= c.targetSessions };
    }
    case "daily_minutes_streak": {
      const best = getMaxDailyStreak(stats, c.minPerDay);
      return { ratio: clamp01(best / c.targetDays), currentText: `${Math.min(best, c.targetDays)} / ${c.targetDays} days`, completed: best >= c.targetDays };
    }
    case "weekend_total_minutes": {
      const best = getMaxWeekendTotal(stats);
      return { ratio: clamp01(best / c.targetMinutes), currentText: `${Math.min(best, c.targetMinutes)} / ${c.targetMinutes} min`, completed: best >= c.targetMinutes };
    }
    case "weekday_minutes_streak": {
      const best = getMaxWeekdayStreak(stats, c.minPerWeekday);
      return { ratio: clamp01(best / c.targetWeekdays), currentText: `${Math.min(best, c.targetWeekdays)} / ${c.targetWeekdays} weekdays`, completed: best >= c.targetWeekdays };
    }
    case "pomodoro_cycles_in_day": {
      const best = getMaxDaily25MinSessions(stats);
      return { ratio: clamp01(best / c.targetCycles), currentText: `${Math.min(best, c.targetCycles)} / ${c.targetCycles} cycles`, completed: best >= c.targetCycles };
    }
    case "subjects_in_week": {
      const best = getMaxUniqueSubjectsInWeek(stats);
      return { ratio: clamp01(best / c.targetSubjects), currentText: `${Math.min(best, c.targetSubjects)} / ${c.targetSubjects} subjects`, completed: best >= c.targetSubjects };
    }
    case "total_minutes": {
      const cur = stats.totalStudyMinutes ?? 0;
      return { ratio: clamp01(cur / c.targetMinutes), currentText: `${Math.min(cur, c.targetMinutes)} / ${c.targetMinutes} min`, completed: cur >= c.targetMinutes };
    }
    case "weekly_total_minutes": {
      const best = getMaxWeeklyMinutes(stats);
      return { ratio: clamp01(best / c.targetMinutes), currentText: `${Math.min(best, c.targetMinutes)} / ${c.targetMinutes} min`, completed: best >= c.targetMinutes };
    }
    case "breathing_sessions_total": {
      const cur = stats.breathingSessionsTotal ?? 0;
      return { ratio: clamp01(cur / c.targetSessions), currentText: `${Math.min(cur, c.targetSessions)} / ${c.targetSessions} sessions`, completed: cur >= c.targetSessions };
    }
    case "mood_consecutive_days": {
      const cur = stats.moodMaxConsecutiveDays ?? 0;
      return { ratio: clamp01(cur / c.targetDays), currentText: `${Math.min(cur, c.targetDays)} / ${c.targetDays} days`, completed: cur >= c.targetDays };
    }
    case "mood_total_days": {
      const cur = stats.moodTotalDays ?? 0;
      return { ratio: clamp01(cur / c.targetDays), currentText: `${Math.min(cur, c.targetDays)} / ${c.targetDays} days`, completed: cur >= c.targetDays };
    }
    case "bubble_pop_plays": {
      const cur = stats.bubblePopPlays ?? 0;
      return { ratio: clamp01(cur / c.targetPlays), currentText: `${Math.min(cur, c.targetPlays)} / ${c.targetPlays} plays`, completed: cur >= c.targetPlays };
    }
    case "bubble_pop_max_level": {
      const cur = stats.bubblePopMaxLevel ?? 0;
      return { ratio: clamp01(cur / c.targetLevel), currentText: `Level ${Math.min(cur, c.targetLevel)} / ${c.targetLevel}`, completed: cur >= c.targetLevel };
    }
    case "calming_breath_after_10pm": {
      const cur = stats.calmingBreathAfter10pm ?? 0;
      return { ratio: clamp01(cur / c.target), currentText: cur >= 1 ? "Completed!" : "Not yet", completed: cur >= c.target };
    }
    case "dedicated_cumulative_minutes": {
      const cur = stats.dedicatedMinutes?.[c.id] ?? 0;
      return { ratio: clamp01(cur / c.targetMinutes), currentText: `${Math.min(cur, c.targetMinutes)} / ${c.targetMinutes} min`, completed: cur >= c.targetMinutes };
    }
    default:
      return { ratio: 0, currentText: "0", completed: false };
  }
};

export const iconForLevel = (level: number) => {
  if (level <= 3) return "play-circle-outline";
  if (level <= 6) return "trending-up-outline";
  if (level <= 9) return "flame-outline";
  if (level <= 12) return "heart-outline";
  if (level <= 15) return "happy-outline";
  if (level <= 18) return "stats-chart-outline";
  return "trophy-outline";
};
