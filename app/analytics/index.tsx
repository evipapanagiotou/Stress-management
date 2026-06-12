import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import {
  analyzeStressStudyCorrelation,
  studyEfficiencyScore,
  weeklyStressSummary,
  type PomodoroSession,
} from "../../services/analytics-utils";
import { getStressEntries, type StressEntry } from "../../utils/storage";

const POMO_SESSIONS_KEY = "POMO_SESSIONS_V1";

function parseArray<T>(raw: string | null): T[] {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getEfficiencyLabel(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 50) return "Moderate";
  return "Needs improvement";
}

function getStressLabel(avg: number | null) {
  if (avg === null) return "No data";
  if (avg <= 2) return "High";
  if (avg <= 3.5) return "Moderate";
  return "Low";
}

function getCorrelationStrength(value: number | null) {
  if (value === null) return "Not enough paired data";

  const abs = Math.abs(value);

  if (abs >= 0.7) return "Strong relationship";
  if (abs >= 0.4) return "Moderate relationship";
  if (abs >= 0.2) return "Weak relationship";
  return "Very weak relationship";
}

export default function AnalyticsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { darkMode } = useTheme();

  const bgColors = darkMode
    ? (["#0B1220", "#0f172a"] as const)
    : (["#F8FAFC", "#EEF2FF"] as const);
  const cardBg = darkMode ? "#1e293b" : "#ffffff";
  const cardBorder = darkMode ? "#334155" : "#E2E8F0";
  const textPrimary = darkMode ? "#f1f5f9" : "#111827";
  const textSecondary = darkMode ? "#94a3b8" : "#64748B";

  const [stressEntries, setStressEntries] = useState<StressEntry[]>([]);
  const [sessions, setSessions] = useState<PomodoroSession[]>([]);

  const load = useCallback(async () => {
    setStressEntries(await getStressEntries());
    setSessions(parseArray<PomodoroSession>(await AsyncStorage.getItem(POMO_SESSIONS_KEY)));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const weekly = useMemo(() => weeklyStressSummary(stressEntries), [stressEntries]);
  const efficiency = useMemo(() => studyEfficiencyScore(sessions), [sessions]);

  const correlation = useMemo(
    () => analyzeStressStudyCorrelation(stressEntries, sessions),
    [sessions, stressEntries]
  );

  const weeklyAverage = weekly.count ? Number(weekly.average) : null;
  const stressLabel = getStressLabel(weeklyAverage);
  const efficiencyLabel = getEfficiencyLabel(efficiency.score);
  const correlationStrength = getCorrelationStrength(correlation.correlation);

  const trendIcon =
    weekly.trend === "increasing"
      ? "trending-up"
      : weekly.trend === "decreasing"
      ? "trending-down"
      : "remove";

  const recommendation = useMemo(() => {
    if (!weekly.count && efficiency.sessions === 0) {
      return "Start by logging your mood and completing Pomodoro sessions. After a few days, the app will provide more meaningful insights.";
    }

    if (weeklyAverage !== null && weeklyAverage <= 2 && efficiency.score < 60) {
      return "Stress appears elevated while study efficiency is low. Try shorter Pomodoro sessions and focus on completing small, manageable study blocks.";
    }

    if (weeklyAverage !== null && weeklyAverage <= 2 && efficiency.score >= 75) {
      return "Stress appears elevated, but study efficiency is good. Consider adding short relaxation breaks or stress-relief games between sessions.";
    }

    if (weeklyAverage !== null && weeklyAverage >= 3.5 && efficiency.score >= 75) {
      return "Your stress levels appear low and your study efficiency is strong. Keep maintaining consistent study habits.";
    }

    if (efficiency.score < 60) {
      return "Study efficiency could improve. Try reducing interruptions and setting clearer goals before each Pomodoro session.";
    }

    return "Your recent study and stress patterns appear relatively stable. Continue tracking your mood and study sessions for more accurate insights.";
  }, [weekly.count, weeklyAverage, efficiency.score, efficiency.sessions]);

  return (
    <LinearGradient colors={bgColors} style={styles.bg}>
      <SafeAreaView style={styles.safe}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.iconButton, { backgroundColor: cardBg }]}
          >
            <Ionicons name="chevron-back" size={22} color={textPrimary} />
          </TouchableOpacity>

          <View style={{ alignItems: "center" }}>
            <Text style={[styles.headerTitle, { color: textPrimary }]}>Analytics</Text>
            <Text style={[styles.headerSub, { color: textSecondary }]}>Stress & study insights</Text>
          </View>

          <View style={styles.iconButtonGhost} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.grid}>
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={[styles.cardIcon, { backgroundColor: darkMode ? "#1e293b" : "#EEF2FF" }]}>
                <Ionicons name="pulse-outline" size={22} color="#4F46E5" />
              </View>

              <Text style={[styles.label, { color: textSecondary }]}>Weekly Stress</Text>

              <Text style={[styles.value, { color: textPrimary }]}>
                {weekly.count ? `${weekly.average}/5` : "No data"}
              </Text>

              <Text style={[styles.classification, { color: textPrimary }]}>{stressLabel}</Text>

              <View style={styles.metaRow}>
                <Ionicons name={trendIcon as any} size={16} color={textSecondary} />
                <Text style={[styles.meta, { color: textSecondary }]}>{weekly.count} check-ins</Text>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={[styles.cardIcon, { backgroundColor: darkMode ? "#1e293b" : "#ECFDF5" }]}>
                <Ionicons name="timer-outline" size={22} color="#0F766E" />
              </View>

              <Text style={[styles.label, { color: textSecondary }]}>Study Efficiency</Text>

              <Text style={[styles.value, { color: textPrimary }]}>{efficiency.score}/100</Text>

              <Text style={[styles.classification, { color: textPrimary }]}>{efficiencyLabel}</Text>

              <Text style={[styles.meta, { color: textSecondary }]}>{efficiency.sessions} sessions in 7 days</Text>
            </View>
          </View>

          <View style={[styles.wideCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Text style={[styles.label, { color: textSecondary }]}>Stress and Study Relationship</Text>

            <Text style={[styles.correlation, { color: textPrimary }]}>{correlationStrength}</Text>

            <Text style={[styles.correlationValue, { color: textSecondary }]}>
              {correlation.correlation === null
                ? "Correlation unavailable"
                : `Correlation: ${correlation.correlation}`}
            </Text>

            <Text style={[styles.insight, { color: textSecondary }]}>{correlation.insight}</Text>

            <Text style={[styles.meta, { color: textSecondary }]}>{correlation.dataPoints} matched study days</Text>
          </View>

          <View style={[styles.recommendationCard, { backgroundColor: cardBg, borderColor: darkMode ? "#475569" : "#FED7AA" }]}>
            <View style={styles.recommendationHeader}>
              <View style={[styles.recommendationIcon, { backgroundColor: darkMode ? "#1e293b" : "#FFEDD5" }]}>
                <Ionicons name="bulb-outline" size={20} color="#F59E0B" />
              </View>

              <Text style={[styles.recommendationTitle, { color: textPrimary }]}>Weekly Recommendation</Text>
            </View>

            <Text style={[styles.recommendationText, { color: textSecondary }]}>{recommendation}</Text>
          </View>

          <View style={[styles.noteCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Ionicons name="information-circle-outline" size={18} color={textSecondary} />
            <Text style={[styles.noteText, { color: textSecondary }]}>
              These analytics are intended for self-monitoring and study reflection. They do not
              provide medical diagnosis.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  safe: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 16,
  },

  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
  },

  iconButtonGhost: {
    width: 44,
    height: 44,
  },

  headerTitle: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "900",
  },

  headerSub: {
    marginTop: 2,
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
  },

  content: {
    padding: 20,
    paddingBottom: 48,
  },

  grid: {
    flexDirection: "row",
    gap: 12,
  },

  card: {
    flex: 1,
    minHeight: 185,
    borderRadius: 20,
    backgroundColor: "#fff",
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    elevation: 1,
  },

  wideCard: {
    marginTop: 14,
    borderRadius: 20,
    backgroundColor: "#fff",
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    elevation: 1,
  },

  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  label: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },

  value: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 8,
  },

  classification: {
    color: "#4F46E5",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 4,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },

  meta: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
  },

  correlation: {
    color: "#111827",
    fontSize: 21,
    fontWeight: "900",
    marginTop: 10,
  },

  correlationValue: {
    color: "#4F46E5",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 6,
  },

  insight: {
    color: "#334155",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    fontWeight: "600",
  },

  recommendationCard: {
    marginTop: 14,
    borderRadius: 20,
    backgroundColor: "#FFF7ED",
    padding: 18,
    borderWidth: 1,
    borderColor: "#FED7AA",
  },

  recommendationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  recommendationIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFEDD5",
    alignItems: "center",
    justifyContent: "center",
  },

  recommendationTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900",
  },

  recommendationText: {
    marginTop: 12,
    color: "#334155",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },

  noteCard: {
    marginTop: 14,
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    gap: 8,
  },

  noteText: {
    flex: 1,
    color: "#64748B",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
});
