import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
 ScrollView,
  SafeAreaView,
  Modal,
  TextInput,
  StatusBar,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../../context/ThemeContext";
import { CHALLENGE_STATS_KEY, CHALLENGES, ChallengeStats, computeProgress } from "../../../utils/challenges";
import { upsertStressEntry } from "../../../utils/storage";

/* ------------------------------------------
   Storage keys & Types
-------------------------------------------*/
type PomoLogEntry = {
  ts: number;
  minutes: number;
  task?: string;
  subjectId?: string | null;
};

type MoodLogEntry = { date: string; mood: string };
type GameEntry = { createdAt: string; game: string };

type PomoSession = {
  id: string;
  startedAt: number;
  plannedMinutes: number;
  actualMinutes: number;
  completed: boolean;
  interruptedCount: number;
  subjectId?: string | null;
  subjectTitle?: string;
};

const POMO_LOG_KEY = "POMO_LOG";
const POMO_DAILY_GOAL_KEY = "POMO_DAILY_GOAL_MINUTES";
const MOOD_LOG_KEY = "MOOD_LOG";
const GAME_LOG_KEY = "stressGames:logs:v3";
const POMO_SESSIONS_KEY = "POMO_SESSIONS_V1";

const MOODS = [
  { emoji: "😫", label: "Stressed" },
  { emoji: "😐", label: "Neutral" },
  { emoji: "🙂", label: "Good" },
  { emoji: "🔥", label: "Productive" },
  { emoji: "🧘", label: "Calm" },
];

/* ------------------------------------------
   Utils
-------------------------------------------*/
const toDayKey = (d: Date) => {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const formatHoursMinutes = (totalMinutes: number) => {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.max(0, totalMinutes % 60);

  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

const safeParseArray = <T,>(raw: string | null): T[] => {
  try {
    const x = raw ? JSON.parse(raw) : [];
    return Array.isArray(x) ? x : [];
  } catch {
    return [];
  }
};

const getStartOfWeek = (d: Date) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
};

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/* ------------------------------------------
   Screen
-------------------------------------------*/
export default function StatisticsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { darkMode } = useTheme();

  const [pomoLog, setPomoLog] = useState<PomoLogEntry[]>([]);
  const [pomoSessions, setPomoSessions] = useState<PomoSession[]>([]);
  const [moodLog, setMoodLog] = useState<MoodLogEntry[]>([]);
  const [gameLog, setGameLog] = useState<GameEntry[]>([]);
  const [challengeStats, setChallengeStats] = useState<ChallengeStats | null>(null);
  const [dailyGoalMin, setDailyGoalMin] = useState<number>(180);
  const [goalModalOpen, setGoalModalOpen] = useState(false);

  const [currentWeekStart, setCurrentWeekStart] = useState(getStartOfWeek(new Date()));
  const [selectedDayKey, setSelectedDayKey] = useState(toDayKey(new Date()));

  const todayKey = toDayKey(new Date());

  const loadAll = useCallback(async () => {
    try {
      const [rawPomo, rawGoal, rawMoods, rawGames, rawChallenges, rawSessions] =
        await Promise.all([
          AsyncStorage.getItem(POMO_LOG_KEY),
          AsyncStorage.getItem(POMO_DAILY_GOAL_KEY),
          AsyncStorage.getItem(MOOD_LOG_KEY),
          AsyncStorage.getItem(GAME_LOG_KEY),
          AsyncStorage.getItem(CHALLENGE_STATS_KEY),
          AsyncStorage.getItem(POMO_SESSIONS_KEY),
        ]);

      setPomoLog(safeParseArray<PomoLogEntry>(rawPomo));
      setMoodLog(safeParseArray<MoodLogEntry>(rawMoods));
      setGameLog(safeParseArray<GameEntry>(rawGames));
      setChallengeStats(rawChallenges ? JSON.parse(rawChallenges) as ChallengeStats : null);
      setPomoSessions(safeParseArray<PomoSession>(rawSessions));

      const parsedGoal = rawGoal ? Number(rawGoal) : 180;
      setDailyGoalMin(Number.isFinite(parsedGoal) && parsedGoal > 0 ? parsedGoal : 180);
    } catch (e) {
      console.warn("Failed to load stats", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAll();
      setSelectedDayKey(toDayKey(new Date()));
      setCurrentWeekStart(getStartOfWeek(new Date()));
    }, [loadAll])
  );

  const statsForSelected = useMemo(() => {
    const studyMins = pomoLog
      .filter((r) => toDayKey(new Date(r.ts)) === selectedDayKey)
      .reduce((s, r) => s + (r.minutes || 0), 0);

    const gamesCount = gameLog.filter((g) => toDayKey(new Date(g.createdAt)) === selectedDayKey)
      .length;

    const challengesCount = challengeStats
      ? CHALLENGES.filter((c) => computeProgress(c, challengeStats).completed).length
      : 0;

    const daySessions = pomoSessions.filter(
      (s) => toDayKey(new Date(s.startedAt)) === selectedDayKey
    );

    const sessionsCount = daySessions.filter((s) => s.completed).length;

    const totalSessionMinutes = daySessions.reduce((sum, s) => sum + (s.actualMinutes || 0), 0);

    return {
      studyMins,
      gamesCount,
      challengesCount,
      sessionsCount,
    };
  }, [pomoLog, gameLog, challengeStats, pomoSessions, selectedDayKey]);

  // ✅ ALL TIME subject totals - no percentages in UI
  const subjectStatsAllTime = useMemo(() => {
    const map = new Map<
      string,
      {
        title: string;
        minutes: number;
        subjectId?: string | null;
      }
    >();

    for (const entry of pomoLog) {
      const title = entry.task?.trim() || "General Study";
      const key = entry.subjectId ?? `title:${title}`;

      const existing = map.get(key);
      if (existing) {
        existing.minutes += entry.minutes || 0;
      } else {
        map.set(key, {
          title,
          minutes: entry.minutes || 0,
          subjectId: entry.subjectId ?? null,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.minutes - a.minutes);
  }, [pomoLog]);

  const totalSubjectMinutesAllTime = useMemo(
    () => subjectStatsAllTime.reduce((sum, item) => sum + item.minutes, 0),
    [subjectStatsAllTime]
  );

  const pct = useMemo(() => {
    const goal = Math.max(1, dailyGoalMin);
    return Math.round(Math.min(100, (statsForSelected.studyMins / goal) * 100));
  }, [statsForSelected.studyMins, dailyGoalMin]);

  const currentMoodForToday = useMemo(
    () => moodLog.find((m) => m.date === todayKey)?.mood,
    [moodLog, todayKey]
  );

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = addDays(currentWeekStart, i);
        const key = toDayKey(d);

        const minutes = pomoLog
          .filter((r) => toDayKey(new Date(r.ts)) === key)
          .reduce((s, r) => s + (r.minutes || 0), 0);

        return { d, key, minutes };
      }),
    [currentWeekStart, pomoLog]
  );

  const weekMax = useMemo(() => Math.max(10, ...weekDays.map((x) => x.minutes)), [weekDays]);

  const currentStreak = useMemo(() => {
  const studyByDay = new Map<string, number>();

  for (const entry of pomoLog) {
    const key = toDayKey(new Date(entry.ts));
    studyByDay.set(key, (studyByDay.get(key) || 0) + (entry.minutes || 0));
  }

  let streak = 0;
  let cursor = new Date();

  while (true) {
    const key = toDayKey(cursor);
    const minutes = studyByDay.get(key) || 0;

    if (minutes < 30) break;

    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}, [pomoLog]);

const averageDailyStudyLast30 = useMemo(() => {
  const today = new Date();
  const studyByDay = new Map<string, number>();

  for (const entry of pomoLog) {
    const key = toDayKey(new Date(entry.ts));
    studyByDay.set(key, (studyByDay.get(key) || 0) + (entry.minutes || 0));
  }

  let total = 0;

  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    total += studyByDay.get(toDayKey(d)) || 0;
  }

  return Math.round(total / 30);
}, [pomoLog]);

  const moodScore = (mood: string) => {
  switch (mood) {
    case "Stressed":
      return 1;
    case "Neutral":
      return 2;
    case "Good":
      return 3;
    case "Productive":
      return 4;
    case "Calm":
      return 5;
    default:
      return 0;
  }
};

const moodInsight = useMemo(() => {
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return toDayKey(d);
  });

  const recentMoods = moodLog.filter((m) => last7Days.includes(m.date));
  if (recentMoods.length === 0) {
    return "Log your mood for a few days to unlock weekly insight.";
  }

  const avg =
    recentMoods.reduce((sum, m) => sum + moodScore(m.mood), 0) /
    recentMoods.length;

  if (avg <= 2) return "Stress levels appear elevated this week.";
  if (avg < 3.5) return "Mood appears stable this week.";
  return "Positive emotional state detected this week.";
}, [moodLog, todayKey]);

const stressTrend = useMemo(() => {
  const getAverageForRange = (startOffset: number, endOffset: number) => {
    const days = Array.from(
      { length: endOffset - startOffset + 1 },
      (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (startOffset + i));
        return toDayKey(d);
      }
    );

    const moods = moodLog.filter((m) => days.includes(m.date));
    if (moods.length === 0) return null;

    return (
      moods.reduce((sum, m) => sum + moodScore(m.mood), 0) / moods.length
    );
  };

  const recentAvg = getAverageForRange(0, 2);
  const previousAvg = getAverageForRange(3, 5);

  if (recentAvg === null || previousAvg === null) {
    return {
      label: "Not enough data",
      icon: "remove",
      description: "Track your mood for more days to calculate stress trend.",
    };
  }

  const diff = recentAvg - previousAvg;

  if (diff >= 0.5) {
    return {
      label: "Improving",
      icon: "trending-down",
      description: "Recent mood logs suggest lower stress levels.",
    };
  }

  if (diff <= -0.5) {
    return {
      label: "Increasing",
      icon: "trending-up",
      description: "Recent mood logs suggest increased stress levels.",
    };
  }

  return {
    label: "Stable",
    icon: "remove",
    description: "Mood levels appear relatively stable.",
  };
}, [moodLog, todayKey]);

  const changeWeek = (direction: number) => {
    setCurrentWeekStart((prev) => addDays(prev, direction * 7));
  };

  return (
    <SafeAreaView style={[styles.screen, darkMode && styles.screenDark]}>
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />
      <LinearGradient
        colors={darkMode ? ["#0B1220", "#0B1220"] : ["#EEF2FF", "#F8FAFC"]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, darkMode && styles.backBtnDark]}
        >
          <Ionicons name="chevron-back" size={24} color={darkMode ? "#E5E7EB" : "#1E293B"} />
        </TouchableOpacity>

        <View style={{ alignItems: "center" }}>
          <Text style={[styles.headerTitle, darkMode && styles.textOnDark]}>Statistics</Text>
          <Text style={[styles.headerSub, darkMode && styles.subTextOnDark]}>
            Study & Wellness History
          </Text>
        </View>

        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Daily Balance */}
        <View style={[styles.card, darkMode && styles.cardDark, { marginBottom: 12 }]}>
          <Text style={[styles.balanceHeader, darkMode && styles.subTextOnDark]}>
            {selectedDayKey === todayKey ? "Today's Balance" : `Stats for ${selectedDayKey}`}
          </Text>

          <View style={styles.balanceRow}>
            <View style={styles.balanceItem}>
              <Ionicons name="timer" size={22} color="#6366f1" />
              <Text style={[styles.balanceVal, darkMode && styles.textOnDark]}>
                {statsForSelected.studyMins}m
              </Text>
              <Text style={styles.balanceLab}>Study</Text>
            </View>

            <View style={styles.balanceItem}>
              <Ionicons name="flash" size={22} color={darkMode ? "#E5E7EB" : "#111827"} />
              <Text style={[styles.balanceVal, darkMode && styles.textOnDark]}>
                {statsForSelected.sessionsCount}
              </Text>
              <Text style={styles.balanceLab}>Sessions</Text>
            </View>

            <View style={styles.balanceItem}>
              <Ionicons name="game-controller" size={22} color="#10b981" />
              <Text style={[styles.balanceVal, darkMode && styles.textOnDark]}>
                {statsForSelected.gamesCount}
              </Text>
              <Text style={styles.balanceLab}>Games</Text>
            </View>

            <View style={styles.balanceItem}>
              <Ionicons name="trophy" size={22} color="#f59e0b" />
              <Text style={[styles.balanceVal, darkMode && styles.textOnDark]}>
                {statsForSelected.challengesCount}
              </Text>
              <Text style={styles.balanceLab}>Total Challenges</Text>
            </View>
         

          <View style={styles.balanceItem}>
  <Ionicons name="stats-chart" size={22} color="#8B5CF6" />
  <Text style={[styles.balanceVal, darkMode && styles.textOnDark]}>
    {averageDailyStudyLast30}m
  </Text>
  <Text style={styles.balanceLab}>Avg/day</Text>
</View>
 </View>

          <TouchableOpacity
            onPress={() => router.push("/analytics")}
            style={[styles.analyticsButton, darkMode && styles.analyticsButtonDark]}
            activeOpacity={0.9}
          >
            <View style={[styles.analyticsIcon, darkMode && { backgroundColor: "rgba(99,102,241,0.15)" }]}>
              <Ionicons name="analytics-outline" size={22} color="#4F46E5" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.analyticsTitle, darkMode && { color: "#fff" }]}>Stress Analytics</Text>
              <Text style={styles.analyticsSub}>Correlation insights and weekly stress summary</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>

          <View style={[styles.trendBox, darkMode && styles.trendBoxDark]}>
  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
    <Ionicons
      name={stressTrend.icon as any}
      size={18}
      color={
        stressTrend.label === "Improving"
          ? "#10B981"
          : stressTrend.label === "Increasing"
          ? "#EF4444"
          : "#6366F1"
      }
    />
    <Text style={[styles.trendTitle, darkMode && styles.textOnDark]}>
      Stress Trend
    </Text>
  </View>

  <Text
    style={[
      styles.trendValue,
      stressTrend.label === "Improving" && { color: "#10B981" },
      stressTrend.label === "Increasing" && { color: "#EF4444" },
      darkMode &&
        stressTrend.label !== "Improving" &&
        stressTrend.label !== "Increasing" && { color: "#E5E7EB" },
    ]}
  >
    {stressTrend.label}
  </Text>

  <Text style={[styles.trendDescription, darkMode && styles.subTextOnDark]}>
    {stressTrend.description}
  </Text>
</View>
        </View>

        {/* 2. Daily Goal Progress */}
        <View style={[styles.card, darkMode && styles.cardDark, { marginBottom: 20 }]}>
          <View style={styles.rowBetween}>
            <Text style={[styles.cardTitle, darkMode && styles.textOnDark]}>Daily Study Goal</Text>
            <TouchableOpacity onPress={() => setGoalModalOpen(true)} style={[styles.editBtn, darkMode && { backgroundColor: "#1F2937" }]}>
              <Ionicons name="pencil" size={14} color="#6366f1" />
            </TouchableOpacity>
          </View>

          <View style={styles.rowBaseline}>
            <Text style={[styles.bigValue, darkMode && styles.textOnDark]}>
              {formatHoursMinutes(statsForSelected.studyMins)}
            </Text>
            <Text style={[styles.subValue, darkMode && styles.subTextOnDark]}>
              {" "}
              / {formatHoursMinutes(dailyGoalMin)}
            </Text>
          </View>

          <View style={[styles.progressTrack, darkMode && styles.progressTrackDark]}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>

          <Text style={[styles.percentText, darkMode && styles.textOnDark]}>{pct}% Complete</Text>
          <View style={[styles.streakBox, darkMode && styles.streakBoxDark]}>
  <View>
    <Text style={[styles.streakTitle, darkMode && styles.textOnDark]}>
      Current Streak
    </Text>
    <Text style={[styles.streakSub, darkMode && styles.subTextOnDark]}>
      Days with at least 30 minutes of study
    </Text>
  </View>

  <Text style={styles.streakValue}>🔥 {currentStreak}</Text>
</View>
        </View>

        {/* 3. Study by Subject - stats UX, no percentages, no bars */}
        <View style={[styles.card, darkMode && styles.cardDark, { marginBottom: 20 }]}>
          <View style={styles.rowBetween}>
            <Text style={[styles.cardTitle, darkMode && styles.textOnDark]}>Study by Subject</Text>
            <Text style={[styles.subjectTotalText, darkMode && styles.subTextOnDark]}>
              All time • {formatHoursMinutes(totalSubjectMinutesAllTime)}
            </Text>
          </View>

          {subjectStatsAllTime.length === 0 ? (
            <Text style={[styles.emptySubjectsText, darkMode && styles.subTextOnDark]}>
              No study minutes logged yet.
            </Text>
          ) : (
            <View style={styles.subjectGrid}>
              {subjectStatsAllTime.map((item, index) => (
                <View
                  key={`${item.subjectId ?? item.title}-${index}`}
                  style={[styles.subjectStatCard, darkMode && styles.subjectStatCardDark]}
                >
                  <View style={[styles.subjectStatIconWrap, darkMode && { backgroundColor: "#1e293b" }]}>
                    <View style={styles.subjectStatDot} />
                  </View>

                  <Text
                    style={[styles.subjectStatTitle, darkMode && styles.textOnDark]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>

                  <Text style={[styles.subjectStatValue, darkMode && styles.textOnDark]}>
                    {formatHoursMinutes(item.minutes)}
                  </Text>

                  <Text style={[styles.subjectStatSub, darkMode && styles.subTextOnDark]}>
                    Total study time
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 4. Mood (Today Only) */}
        {selectedDayKey === todayKey && (
          <View style={[styles.card, darkMode && styles.cardDark, { marginBottom: 20 }]}>
            <Text
              style={[
                styles.cardTitle,
                darkMode && styles.textOnDark,
                { textAlign: "center", marginBottom: 10 },
              ]}
            >
              How are you feeling right now?
            </Text>

            <View style={styles.moodRow}>
              {MOODS.map((m) => {
                const active = currentMoodForToday === m.label;
                return (
                  <TouchableOpacity
                    key={m.label}
                    onPress={async () => {
                      const score = moodScore(m.label);
                      if (score === 0) return;
                      const dayKey = toDayKey(new Date());
                      const updated = [
                        ...moodLog.filter((x) => x.date !== dayKey),
                        { date: dayKey, mood: m.label },
                      ];
                      setMoodLog(updated);
                      try {
                        await AsyncStorage.setItem(MOOD_LOG_KEY, JSON.stringify(updated));
                        await upsertStressEntry({
                          date: dayKey,
                          level: score as 1 | 2 | 3 | 4 | 5,
                          createdAt: new Date().toISOString(),
                        });
                      } catch (e) {
                        console.error("Failed to save mood", e);
                      }
                    }}
                    style={[styles.moodItem, active && (darkMode ? styles.moodItemActiveDark : styles.moodItemActive)]}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.moodEmoji, active && { transform: [{ scale: 1.2 }] }]}>
                      {m.emoji}
                    </Text>
                    <Text
                      style={[
                        styles.moodLabel,
                        darkMode && styles.subTextOnDark,
                        active && { color: "#6366f1" },
                      ]}
                    >
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={[styles.moodInsightBox, darkMode && styles.moodInsightBoxDark]}>
  <Text style={[styles.moodInsightTitle, darkMode && styles.textOnDark]}>
    Mood Insight
  </Text>

  <Text style={[styles.moodInsightText, darkMode && styles.subTextOnDark]}>
    {moodInsight}
  </Text>
</View>
          </View>
        )}

        {/* 5. Weekly Consistency */}
        <View style={[styles.card, darkMode && styles.cardDark]}>
          <View style={styles.historyNavRow}>
            <TouchableOpacity onPress={() => changeWeek(-1)} style={[styles.navBtn, darkMode && { backgroundColor: "rgba(99,102,241,0.15)" }]} activeOpacity={0.85}>
              <Ionicons name="chevron-back" size={20} color="#6366f1" />
            </TouchableOpacity>

            <View style={{ alignItems: "center" }}>
              <Text style={[styles.cardTitle, darkMode && styles.textOnDark]}>Weekly Consistency</Text>
              <Text style={styles.dateRangeText}>
                {currentWeekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} -{" "}
                {addDays(currentWeekStart, 6).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </Text>
            </View>

            <TouchableOpacity onPress={() => changeWeek(1)} style={[styles.navBtn, darkMode && { backgroundColor: "rgba(99,102,241,0.15)" }]} activeOpacity={0.85}>
              <Ionicons name="chevron-forward" size={20} color="#6366f1" />
            </TouchableOpacity>
          </View>

          <View style={styles.chartContainer}>
            {weekDays.map((day) => {
              const hPct = Math.round((day.minutes / weekMax) * 100);
              const isSelected = selectedDayKey === day.key;
              const dayMood = moodLog.find((m) => m.date === day.key);
              const dayEmoji = MOODS.find((m) => m.label === dayMood?.mood)?.emoji;

              return (
                <TouchableOpacity
                  key={day.key}
                  style={styles.barCol}
                  onPress={() => setSelectedDayKey(day.key)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.barEmoji}>{dayEmoji || " "}</Text>

                  <View
                    style={[
                      styles.barTrack,
                      darkMode && styles.barTrackDark,
                      isSelected && { borderColor: "#6366f1", borderWidth: 1.5 },
                    ]}
                  >
                    <View
                      style={[
                        styles.barFill,
                        { height: `${hPct}%` },
                        isSelected && { backgroundColor: "#4f46e5" },
                      ]}
                    />
                  </View>

                  <Text
                    style={[
                      styles.dayLabel,
                      darkMode && styles.textOnDark,
                      isSelected && { color: "#6366f1", fontWeight: "900" },
                    ]}
                  >
                    {day.d.toLocaleDateString(undefined, { weekday: "short" })}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={() => {
              setCurrentWeekStart(getStartOfWeek(new Date()));
              setSelectedDayKey(todayKey);
            }}
            style={[styles.todayBtn, darkMode && styles.todayBtnDark]}
            activeOpacity={0.85}
          >
            <Ionicons name="refresh" size={14} color="#6366f1" />
            <Text style={styles.todayBtnTextNew}>Back to Today</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <GoalModal
        visible={goalModalOpen}
        initialMinutes={dailyGoalMin}
        onClose={() => setGoalModalOpen(false)}
        onSave={async (minutes: number) => {
          const safe = Math.max(1, Math.floor(minutes));
          setDailyGoalMin(safe);
          await AsyncStorage.setItem(POMO_DAILY_GOAL_KEY, String(safe));
          setGoalModalOpen(false);
        }}
        darkMode={darkMode}
      />
    </SafeAreaView>
  );
}

/* ------------------------------------------
   Goal Modal
-------------------------------------------*/
function GoalModal({ visible, initialMinutes, onClose, onSave, darkMode }: any) {
  const [h, setH] = useState(String(Math.floor(initialMinutes / 60)));
  const [m, setM] = useState(String(initialMinutes % 60));

  React.useEffect(() => {
    if (!visible) return;
    setH(String(Math.floor(initialMinutes / 60)));
    setM(String(initialMinutes % 60));
  }, [visible, initialMinutes]);

  const submit = () => {
    const hh = Math.max(0, Math.floor(Number(h) || 0));
    const mm = clamp(Math.floor(Number(m) || 0), 0, 59);
    onSave(hh * 60 + mm);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.card, darkMode && modalStyles.cardDark]}>
          <Text style={[modalStyles.title, darkMode && styles.textOnDark]}>Daily goal</Text>
          <Text style={[modalStyles.sub, darkMode && styles.subTextOnDark]}>
            Set your Pomodoro study target.
          </Text>

          <View style={modalStyles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[modalStyles.label, darkMode && styles.subTextOnDark]}>Hours</Text>
              <TextInput
                value={h}
                onChangeText={setH}
                keyboardType="numeric"
                style={[modalStyles.input, darkMode && modalStyles.inputDark]}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[modalStyles.label, darkMode && styles.subTextOnDark]}>Minutes</Text>
              <TextInput
                value={m}
                onChangeText={setM}
                keyboardType="numeric"
                style={[modalStyles.input, darkMode && modalStyles.inputDark]}
              />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
            <TouchableOpacity
              onPress={onClose}
              style={[modalStyles.btn, { backgroundColor: darkMode ? "#1F2937" : "#F1F5F9" }]}
              activeOpacity={0.85}
            >
              <Text style={{ color: darkMode ? "#E5E7EB" : "#1E293B", fontWeight: "900" }}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={submit}
              style={[modalStyles.btn, { backgroundColor: "#6366f1" }]}
              activeOpacity={0.85}
            >
              <Text style={{ color: "#fff", fontWeight: "900" }}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ------------------------------------------
   Styles
-------------------------------------------*/
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8FAFC" },
  screenDark: { backgroundColor: "#0B1220" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 24, fontWeight: "900", color: "#1E293B" },
  headerSub: { fontSize: 13, color: "#64748B", fontWeight: "600", marginTop: 2, },

  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
  },
  backBtnDark: { backgroundColor: "#111827", borderWidth: 1, borderColor: "#1F2937" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#EEF2FF",
    elevation: 1,
  },
  cardDark: { backgroundColor: "#111827", borderColor: "#1F2937" },

  cardTitle: { fontSize: 15, fontWeight: "900", color: "#1E293B" },

  textOnDark: { color: "#E5E7EB" },
  subTextOnDark: { color: "#94A3B8" },

  balanceHeader: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    textAlign: "center",
    textTransform: "uppercase",
  },
  balanceRow: { flexDirection: "row", justifyContent: "space-around", marginTop: 10 },
 balanceItem: { alignItems: "center", gap: 4, width: "19%" },
  balanceVal: { fontSize: 24, fontWeight: "900" },
  balanceLab: { fontSize: 12, color: "#64748B", fontWeight: "700", textAlign: "center" },

  analyticsButton: {
    marginTop: 14,
    minHeight: 72,
    borderRadius: 16,
    paddingHorizontal: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  analyticsButtonDark: { backgroundColor: "#0B1220", borderColor: "#1F2937" },
  analyticsIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  analyticsTitle: { fontSize: 15, fontWeight: "900", color: "#111827" },
  analyticsSub: { marginTop: 3, fontSize: 12, fontWeight: "700", color: "#64748B" },

  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowBaseline: { flexDirection: "row", alignItems: "baseline", marginTop: 8 },
  bigValue: { fontSize: 32, fontWeight: "900" },
  subValue: { fontSize: 14, fontWeight: "700", color: "#64748B" },

  progressTrack: {
    height: 10,
    backgroundColor: "#E2E8F0",
    borderRadius: 5,
    marginTop: 12,
    overflow: "hidden",
  },
  progressTrackDark: { backgroundColor: "#1F2937" },
  progressFill: { height: "100%", backgroundColor: "#6366f1" },
  percentText: { marginTop: 10, textAlign: "center", fontWeight: "900", fontSize: 14 },

  editBtn: { padding: 6, backgroundColor: "#F1F5F9", borderRadius: 8 },

  // ✅ New Study by Subject UX
  subjectTotalText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#64748B",
  },
  emptySubjectsText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  subjectGrid: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  subjectStatCard: {
    width: "48%",
    backgroundColor: "#F8FAFC",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    minHeight: 118,
    justifyContent: "space-between",
  },
  subjectStatCardDark: {
    backgroundColor: "#0B1220",
    borderColor: "#1F2937",
  },
  subjectStatIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  subjectStatDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#6366f1",
  },
  subjectStatTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 8,
  },
  subjectStatValue: {
    fontSize: 28,
    fontWeight: "900",
    color: "#111827",
    lineHeight: 32,
  },
  subjectStatSub: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    marginTop: 4,
  },

  moodRow: { flexDirection: "row", justifyContent: "space-between" },
  moodItem: { alignItems: "center", padding: 8, borderRadius: 15 },
  moodItemActive: { backgroundColor: "#EEF2FF", borderWidth: 1, borderColor: "#6366f1" },
  moodItemActiveDark: { backgroundColor: "rgba(99,102,241,0.2)", borderWidth: 1, borderColor: "#6366f1" },
  moodEmoji: { fontSize: 26, marginBottom: 4 },
  moodLabel: { fontSize: 9, fontWeight: "700", color: "#64748B" },

  historyNavRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  navBtn: { padding: 8, backgroundColor: "#EEF2FF", borderRadius: 10 },
  dateRangeText: { fontSize: 11, fontWeight: "700", color: "#64748B", marginTop: 2 },
  chartContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 15,
    height: 120,
  },
  barCol: { alignItems: "center", width: "12%" },
  barEmoji: { fontSize: 14, marginBottom: 5 },
  barTrack: {
    width: "100%",
    height: 70,
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  barTrackDark: { backgroundColor: "#1F2937" },
  barFill: { width: "100%", backgroundColor: "#6366f1" },
  dayLabel: { fontSize: 10, fontWeight: "800", marginTop: 8 },

  todayBtn: {
    marginTop: 18,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  todayBtnDark: {
    backgroundColor: "rgba(99,102,241,0.15)",
    borderColor: "rgba(99,102,241,0.25)",
  },
  todayBtnTextNew: {
    fontSize: 12,
    fontWeight: "900",
    color: "#6366f1",
  },


  streakBox: {
  marginTop: 16,
  borderRadius: 16,
  padding: 14,
  backgroundColor: "#FFF7ED",
  borderWidth: 1,
  borderColor: "#FED7AA",
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
},
streakBoxDark: {
  backgroundColor: "rgba(249,115,22,0.12)",
  borderColor: "rgba(249,115,22,0.25)",
},
streakTitle: {
  fontSize: 13,
  fontWeight: "900",
  color: "#111827",
},
streakSub: {
  marginTop: 3,
  fontSize: 11,
  fontWeight: "700",
  color: "#64748B",
  maxWidth: 190,
},
streakValue: {
  fontSize: 20,
  fontWeight: "900",
  color: "#F97316",
},

trendBox: {
  marginTop: 14,
  borderRadius: 16,
  padding: 14,
  backgroundColor: "#F8FAFC",
  borderWidth: 1,
  borderColor: "#E2E8F0",
},
trendBoxDark: {
  backgroundColor: "#0B1220",
  borderColor: "#1F2937",
},
trendTitle: {
  fontSize: 15,
  fontWeight: "900",
  color: "#111827",
},
trendValue: {
  marginTop: 8,
  fontSize: 18,
  fontWeight: "900",
  color: "#6366F1",
},
trendDescription: {
  marginTop: 6,
  fontSize: 13,
  fontWeight: "600",
  color: "#64748B",
  lineHeight: 18,
},

moodInsightBox: {
  marginTop: 14,
  borderRadius: 16,
  padding: 14,
  backgroundColor: "#F8FAFC",
  borderWidth: 1,
  borderColor: "#E2E8F0",
},
moodInsightBoxDark: {
  backgroundColor: "#0B1220",
  borderColor: "#1F2937",
},
moodInsightTitle: {
  fontSize: 15,
  fontWeight: "900",
  color: "#111827",
},
moodInsightText: {
  marginTop: 6,
  fontSize: 13,
  fontWeight: "600",
  color: "#64748B",
  lineHeight: 18,
},


});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 30 },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 25 },
  cardDark: { backgroundColor: "#111827" },
  title: { fontSize: 18, fontWeight: "900", marginBottom: 5 },
  sub: { fontSize: 14, marginBottom: 20, fontWeight: "700" },
  row: { flexDirection: "row", gap: 15 },
  label: { fontSize: 12, fontWeight: "800", marginBottom: 5 },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 10,
    textAlign: "center",
    fontWeight: "800",
  },
  inputDark: { backgroundColor: "#0B1220", color: "#fff", borderColor: "#1F2937" },
  btn: { flex: 1, padding: 15, borderRadius: 12, alignItems: "center" },
});
