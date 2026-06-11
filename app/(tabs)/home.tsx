import React, { useCallback, useMemo, useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Platform,
  Animated,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import LottieView from "lottie-react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";

import { getExams, Exam } from "../../utils/storage";
import {
  CHALLENGES,
  computeProgress,
  loadStats,
  getDayKey,
  iconForLevel,
  ChallengeStats,
} from "../../utils/challenges";

const { width } = Dimensions.get("window");
const sx = StyleSheet.flatten;

const TODAY_PROGRESS_KEY = "todayProgress:v1";
const MOOD_LOG_KEY = "MOOD_LOG";

const KEY_FIRST = "user:firstName";
const KEY_LAST = "user:lastName";
const KEY_FULL = "user:name";
const KEY_LEGACY = "userName";
const KEY_HAS_OPENED_BEFORE = "user:hasOpenedBefore";

type MoodLogEntry = { date: string; mood: string };

const makeFull = (first: string, last: string) =>
  [first.trim(), last.trim()].filter(Boolean).join(" ");

const parseFullName = (full: string) => {
  const parts = full.trim().split(/\s+/);
  return { first: parts[0] || "", last: parts.slice(1).join(" ") };
};

const toDayKey = (d: Date) => {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

const safeParseArray = <T,>(raw: string | null): T[] => {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

function getDaysUntil(dateString: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const examDate = new Date(dateString);
  examDate.setHours(0, 0, 0, 0);

  return Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function moodEmoji(mood?: string) {
  switch (mood) {
    case "Stressed":
      return "😫";
    case "Neutral":
      return "😐";
    case "Good":
      return "🙂";
    case "Productive":
      return "🔥";
    case "Calm":
      return "🧘";
    default:
      return "🙂";
  }
}

function statsWithoutToday(stats: ChallengeStats, todayKey: string): ChallengeStats {
  const dayStudy = stats.dailyStudyMinutes?.[todayKey] ?? 0;
  const daySessions = stats.dailySessions?.[todayKey] ?? 0;

  const next: ChallengeStats = {
    ...stats,
    totalStudyMinutes: Math.max(0, (stats.totalStudyMinutes ?? 0) - dayStudy),
    totalSessions: Math.max(0, (stats.totalSessions ?? 0) - daySessions),
    dailyStudyMinutes: { ...(stats.dailyStudyMinutes ?? {}) },
    dailySessions: { ...(stats.dailySessions ?? {}) },
    dailyBuckets: { ...(stats.dailyBuckets ?? {}) },
    dailySubjects: { ...(stats.dailySubjects ?? {}) },
    subjectTotals: { ...(stats.subjectTotals ?? {}) },
  };

  delete next.dailyStudyMinutes[todayKey];
  delete next.dailySessions[todayKey];
  delete next.dailyBuckets[todayKey];
  delete next.dailySubjects[todayKey];

  return next;
}

export default function RefinedHomeScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const { darkMode: isDarkMode } = useTheme();

  const [exams, setExams] = useState<Exam[]>([]);

  const [hasOpenedBefore, setHasOpenedBefore] = useState(false);
  const [justOnboarded, setJustOnboarded] = useState(false);

  const [firstName, setFirstName] = useState<string>("");

  const [todayProgress, setTodayProgress] = useState({
    studyMinutes: 0,
    sessions: 0,
    challengesDone: 0,
  });

  const [moodLog, setMoodLog] = useState<MoodLogEntry[]>([]);
  const [challengeStats, setChallengeStats] = useState<ChallengeStats | null>(null);

  const [needsName, setNeedsName] = useState(false);
  const [firstDraft, setFirstDraft] = useState("");
  const [lastDraft, setLastDraft] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);

  const colors = {
    bg: isDarkMode ? (["#0B1220", "#0f172a"] as const) : (["#F8FAFC", "#F1F5F9"] as const),
    card: isDarkMode ? "#1e293b" : "#ffffff",
    text: isDarkMode ? "#f8fafc" : "#0f172a",
    subText: isDarkMode ? "#94a3b8" : "#64748b",
    accent: "#6366f1",
    border: isDarkMode ? "#334155" : "#e2e8f0",
  };

  const saveName = useCallback(async () => {
    const f = firstDraft.trim();
    const l = lastDraft.trim();

    if (!f) return setNameError("Please enter your first name 🙂");
    if (!l) return setNameError("Please enter your last name 🙂");

    setNameError(null);
    setSavingName(true);

    const full = makeFull(f, l);

    try {
      await AsyncStorage.multiSet([
        [KEY_FIRST, f],
        [KEY_LAST, l],
        [KEY_FULL, full],
        [KEY_LEGACY, full],
      ]);

      await AsyncStorage.setItem(KEY_HAS_OPENED_BEFORE, "true");

      setJustOnboarded(true);
      setFirstName(f);
      setNeedsName(false);
    } catch (e) {
      console.log("Failed saving name", e);
      setNameError("Something went wrong. Try again.");
    } finally {
      setSavingName(false);
    }
  }, [firstDraft, lastDraft]);

  const loadAppData = useCallback(async () => {
    try {
      const rawProgress = await AsyncStorage.getItem(TODAY_PROGRESS_KEY);
      const rawMoodLog = await AsyncStorage.getItem(MOOD_LOG_KEY);

      const opened = await AsyncStorage.getItem(KEY_HAS_OPENED_BEFORE);
      setHasOpenedBefore(opened === "true");
      setJustOnboarded(false);

      setExams(await getExams());
      setMoodLog(safeParseArray<MoodLogEntry>(rawMoodLog));

      if (rawProgress) {
        try { setTodayProgress(JSON.parse(rawProgress)); } catch { /* corrupted key, skip */ }
      }

      const savedFirst = (await AsyncStorage.getItem(KEY_FIRST)) || "";
      const savedLast = (await AsyncStorage.getItem(KEY_LAST)) || "";
      const savedFull = (await AsyncStorage.getItem(KEY_FULL)) || "";
      const savedLegacy = (await AsyncStorage.getItem(KEY_LEGACY)) || "";

      if (savedFirst && savedLast) {
        setFirstName(savedFirst);
        setFirstDraft(savedFirst);
        setLastDraft(savedLast);
        setNeedsName(false);
      } else {
        const nameToParse = savedFull || savedLegacy;

        if (nameToParse) {
          const { first, last } = parseFullName(nameToParse);
          setFirstName(first);
          setFirstDraft(first);
          setLastDraft(last);

          if (!first || !last) {
            setNeedsName(true);
          } else {
            const full = makeFull(first, last);
            await AsyncStorage.multiSet([
              [KEY_FIRST, first],
              [KEY_LAST, last],
              [KEY_FULL, full],
              [KEY_LEGACY, full],
            ]);
            setNeedsName(false);
          }
        } else {
          setFirstName("");
          setFirstDraft("");
          setLastDraft("");
          setNameError(null);
          setNeedsName(true);
        }
      }

      const stats = await loadStats();
      setChallengeStats(stats);
    } catch (e) {
      console.log("Error loading data", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAppData();
      return () => {};
    }, [loadAppData])
  );

  const upcomingExams = useMemo(() => {
    const now = Date.now();
    return exams
      .map((e) => ({ ...e, t: new Date(e.date).getTime() }))
      .filter((e) => e.t >= now)
      .sort((a, b) => a.t - b.t);
  }, [exams]);

  const nextExam = upcomingExams[0] || null;
  const upNextExams = upcomingExams.slice(1, 3);

  const daysUntilNextExam = nextExam ? getDaysUntil(nextExam.date) : null;

  const todayMood = useMemo(() => {
    const today = toDayKey(new Date());
    return moodLog.find((m) => m.date === today)?.mood;
  }, [moodLog]);

  const top3Challenges = useMemo(() => {
    if (!challengeStats) return [];
    return CHALLENGES.map((c) => ({
      ...c,
      progress: computeProgress(c, challengeStats),
    }))
      .filter((x) => !x.progress.completed)
      .sort((a, b) => b.progress.ratio - a.progress.ratio)
      .slice(0, 3);
  }, [challengeStats]);

  const todayChallengesDone = useMemo(() => {
    if (!challengeStats) return 0;

    const todayKey = getDayKey();
    const before = statsWithoutToday(challengeStats, todayKey);

    let count = 0;
    for (const c of CHALLENGES) {
      const nowP = computeProgress(c, challengeStats);
      if (!nowP.completed) continue;

      const beforeP = computeProgress(c, before);
      if (!beforeP.completed) count += 1;
    }

    return count;
  }, [challengeStats]);

  return (
    <View style={{ flex: 1, backgroundColor: isDarkMode ? "#0B1220" : "#F8FAFC" }}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <LinearGradient colors={colors.bg} style={StyleSheet.absoluteFillObject} />

      <SafeAreaView style={{ flex: 1 }}>
  <ScrollView
    showsVerticalScrollIndicator={false}
    contentContainerStyle={sx([
      styles.scrollPadding,
      { paddingBottom: tabBarHeight + insets.bottom + 32 },
    ])}
  >
            <View style={styles.topBar}>
                <View>
                  <Text style={sx([styles.welcomeText, { color: colors.subText }])}>
                    {justOnboarded ? "Welcome," : hasOpenedBefore ? "Welcome back," : "Welcome,"}
                  </Text>
                  <Text style={sx([styles.nameText, { color: colors.text }])}>
                    {firstName || "Student"} 👋
                  </Text>
                </View>

                <Link href="/settings" asChild>
                  <TouchableOpacity
                    style={sx([
                      styles.settingsBtn,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ])}
                    activeOpacity={0.9}
                  >
                    <Ionicons name="options-outline" size={24} color={colors.accent} />
                  </TouchableOpacity>
                </Link>
              </View>
            

            <View style={styles.heroWrapper}>
              <LinearGradient
                colors={["#6366f1", "#a855f7"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroCard}
              >
                <View style={styles.heroInfo}>
                  <Text style={styles.heroLabel}>UPCOMING EXAM</Text>
                  <Text style={styles.heroSubject}>{nextExam ? nextExam.subject : "No Exams"}</Text>

                  <Text style={styles.heroDate}>
                    {nextExam
                      ? new Date(nextExam.date).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                        })
                      : "Relax & Recharge"}
                  </Text>

                  {nextExam && daysUntilNextExam !== null && (
                    <View style={styles.daysPill}>
                      <Ionicons name="time-outline" size={14} color="#fff" />
                      <Text style={styles.daysPillText}>
                        {daysUntilNextExam === 0
                          ? "Today"
                          : daysUntilNextExam === 1
                          ? "Tomorrow"
                          : `${daysUntilNextExam} days left`}
                      </Text>
                    </View>
                  )}

                  {upNextExams.length > 0 && (
                    <TouchableOpacity activeOpacity={0.9} onPress={() => router.push("/(tabs)/calendar")}>
                      <View style={styles.heroNextBox}>
                        <View style={styles.heroNextHeader}>
                          <Text style={styles.heroNextLabel}>UP NEXT</Text>
                          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.85)" />
                        </View>

                        {upNextExams.map((e, idx) => (
                          <View
                            key={(e as any).id ?? `${e.subject}-${e.date}`}
                            style={sx([styles.heroNextRow, idx > 0 && { marginTop: 8 }])}
                          >
                            <View style={styles.heroNextDot} />
                            <Text style={styles.heroNextText} numberOfLines={1}>
                              {e.subject} •{" "}
                              {new Date(e.date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}{" "}
                              {new Date(e.date).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                              {e.location ? ` • ${e.location}` : ""}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.heroCircle}>
                  <Ionicons name="school" size={32} color="#fff" />
                </View>
              </LinearGradient>
            </View>

            <Text style={sx([styles.sectionTitle, { color: colors.text }])}>Quick Actions</Text>
            <View style={styles.bigGrid}>
              <BigTile
                title="Pomodoro"
                subtitle="Focus Session"
                icon="timer"
                color="#EEF2FF"
                iColor="#6366f1"
                href="/(tabs)/pomodoro"
                colors={colors}
                darkMode={isDarkMode}
              />
              <BigTile
                title="Calendar"
                subtitle="Exam Dates"
                icon="calendar"
                color="#FFF7ED"
                iColor="#F59E0B"
                href="/(tabs)/calendar"
                colors={colors}
                darkMode={isDarkMode}
              />
              <BigTile
                title="Analytics"
                subtitle="Stress Insights"
                icon="analytics"
                color="#F0FDF4"
                iColor="#22C55E"
                href="/(tabs)/stats"
                colors={colors}
                darkMode={isDarkMode}
              />
              <BigTile
                title="Games"
                subtitle="Stress Relief"
                icon="game-controller"
                color="#FEF2F2"
                iColor="#EF4444"
                href="/games"
                colors={colors}
                darkMode={isDarkMode}
              />
            </View>

            <View style={sx([styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }])}>
              <View style={styles.cardHeader}>
                <Text style={sx([styles.cardTitle, { color: colors.text }])}>Today's Progress</Text>
                <Ionicons name="trending-up" size={20} color={colors.accent} />
              </View>

              <View style={styles.progressRow}>
                <View style={styles.progressItem}>
                  <Text style={sx([styles.progressVal, { color: colors.accent }])}>
                    {todayProgress.studyMinutes}m
                  </Text>
                  <Text style={styles.progressLab}>Study Time</Text>
                </View>

                <View style={[styles.vDivider, isDarkMode && { backgroundColor: "#334155" }]} />

                <View style={styles.progressItem}>
                  <Text style={sx([styles.progressVal, { color: "#a855f7" }])}>
                    {todayProgress.sessions}
                  </Text>
                  <Text style={styles.progressLab}>Sessions</Text>
                </View>

                <View style={[styles.vDivider, isDarkMode && { backgroundColor: "#334155" }]} />

                <View style={styles.progressItem}>
                  <Text style={sx([styles.progressVal, { color: "#22C55E" }])}>
                    {todayChallengesDone}
                  </Text>
                  <Text style={styles.progressLab}>Challenges</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => router.push("/(tabs)/stats")}
              style={sx([styles.moodCard, { backgroundColor: colors.card, borderColor: colors.border }])}
            >
              <View style={styles.moodLeft}>
                <View style={[styles.moodIcon, isDarkMode && { backgroundColor: "#1e293b" }]}>
                  <Text style={styles.moodEmoji}>{moodEmoji(todayMood)}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={sx([styles.moodTitle, { color: colors.text }])}>Today's Mood</Text>
                  <Text style={sx([styles.moodSub, { color: colors.subText }])}>
                    {todayMood ? `${todayMood} • Last check-in today` : "No check-in yet • Tap to log mood"}
                  </Text>
                </View>
              </View>

              <Ionicons name="chevron-forward" size={20} color={colors.subText} />
            </TouchableOpacity>

            <View style={sx([styles.sectionHeader, { marginTop: 22 }])}>
              <View style={styles.sectionHeaderLeft}>
                <Ionicons name="rocket-outline" size={20} color={colors.accent} />
                <Text style={sx([styles.sectionTitle, { color: colors.text, marginBottom: 0 }])}>
                  Top Progress
                </Text>
              </View>

              <TouchableOpacity activeOpacity={0.9} onPress={() => router.push("/challenges")}>
                <Text style={{ color: colors.accent, fontWeight: "800" }}>View All</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.challengeCarousel}>
              {top3Challenges.map((item: any) => {
                const pct = Math.round(item.progress.ratio * 100);

                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.9}
                    onPress={() => router.push("/challenges")}
                    style={sx([
                      styles.challengeCard,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ])}
                  >
                    <View style={styles.challengeCardTop}>
                      <View style={sx([styles.challengeIconBox, { backgroundColor: isDarkMode ? "#1e293b" : "#EEF2FF" }])}>
                        <Ionicons name={iconForLevel(item.level) as any} size={20} color={colors.accent} />
                      </View>

                      <View style={[styles.pctPill, isDarkMode && { backgroundColor: "#1e293b" }]}>
                        <Text style={styles.pctPillText}>{pct}%</Text>
                      </View>
                    </View>

                    <Text style={sx([styles.challengeTitleCard, { color: colors.text }])} numberOfLines={2}>
                      {item.title}
                    </Text>

                    <Text style={sx([styles.challengeMeta, { color: colors.subText }])} numberOfLines={1}>
                      {item.progress.currentText}
                    </Text>

                    <View style={[styles.barTrack, isDarkMode && { backgroundColor: "#334155" }]}>
                      <View style={sx([styles.barFill, { width: `${Math.max(6, item.progress.ratio * 100)}%` }])} />
                    </View>

                    <Text style={sx([styles.challengeHint, { color: colors.subText }])}>
                      Tap to finish it 🚀
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </ScrollView>
      </SafeAreaView>

      <NameLottieOverlay
        visible={needsName}
        colors={colors}
        firstDraft={firstDraft}
        lastDraft={lastDraft}
        setFirstDraft={(t: string) => {
          setFirstDraft(t);
          if (nameError) setNameError(null);
        }}
        setLastDraft={(t: string) => {
          setLastDraft(t);
          if (nameError) setNameError(null);
        }}
        error={nameError}
        saving={savingName}
        onSubmit={saveName}
      />
    </View>
  );
}

function BigTile({ title, subtitle, icon, color, iColor, href, colors, darkMode }: any) {
  return (
    <Link href={href} asChild>
      <TouchableOpacity
        style={sx([styles.bigTile, { backgroundColor: colors.card, borderColor: colors.border }])}
        activeOpacity={0.9}
      >
        <View style={sx([styles.bigTileIcon, { backgroundColor: darkMode ? "#1e293b" : color }])}>
          <Ionicons name={icon as any} size={32} color={iColor} />
        </View>
        <Text style={sx([styles.bigTileTitle, { color: colors.text }])}>{title}</Text>
        <Text style={styles.bigTileSub}>{subtitle}</Text>
      </TouchableOpacity>
    </Link>
  );
}

function NameLottieOverlay({
  visible,
  colors,
  firstDraft,
  lastDraft,
  setFirstDraft,
  setLastDraft,
  error,
  saving,
  onSubmit,
}: any) {
  const fade = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0.96)).current;
  const lottieRef = useRef<LottieView>(null);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(pop, { toValue: 1, useNativeDriver: true }),
      ]).start();

      lottieRef.current?.reset();
      lottieRef.current?.play();
    } else {
      Animated.parallel([
        Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(pop, { toValue: 0.96, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="auto">
      <Animated.View
        style={sx([
          StyleSheet.absoluteFillObject,
          { backgroundColor: "rgba(0,0,0,0.35)", opacity: fade },
        ])}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, justifyContent: "center" }}
      >
        <Animated.View style={sx([stylesOverlay.wrap, { opacity: fade, transform: [{ scale: pop }] }])}>
          <View style={stylesOverlay.characterRow}>
            <View style={stylesOverlay.lottieHolder}>
              <LottieView
                ref={lottieRef}
                source={require("../../assets/animations/mascot.json")}
                autoPlay
                loop
                style={{ width: 160, height: 160 }}
              />
            </View>
          </View>

          <View style={sx([stylesOverlay.bubble, { backgroundColor: colors.card, borderColor: colors.border }])}>
            <Text style={sx([stylesOverlay.bTitle, { color: colors.text }])}>Hi there! 👋</Text>
            <Text style={sx([stylesOverlay.bSub, { color: colors.subText }])}>
              Tell me your first & last name
            </Text>

            <TextInput
              value={firstDraft}
              onChangeText={setFirstDraft}
              placeholder="First name"
              placeholderTextColor={colors.subText}
              style={sx([stylesOverlay.input, { color: colors.text, borderColor: colors.border }])}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
            />

            <TextInput
              value={lastDraft}
              onChangeText={setLastDraft}
              placeholder="Last name"
              placeholderTextColor={colors.subText}
              style={sx([stylesOverlay.input, { color: colors.text, borderColor: colors.border }])}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={onSubmit}
            />

            {error ? <Text style={stylesOverlay.error}>{error}</Text> : null}

            <TouchableOpacity activeOpacity={0.9} onPress={onSubmit} disabled={saving} style={stylesOverlay.btn}>
              <LinearGradient colors={["#6366f1", "#a855f7"]} style={StyleSheet.absoluteFillObject} />
              <Text style={stylesOverlay.btnText}>{saving ? "Saving..." : "Continue"}</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 10 }} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const stylesOverlay = StyleSheet.create({
  wrap: { paddingHorizontal: 24, alignItems: "center" },
  characterRow: { alignItems: "center", marginBottom: -18, zIndex: 10 },
  lottieHolder: { width: 170, height: 170, alignItems: "center", justifyContent: "center" },
  bubble: { width: "100%", borderRadius: 26, borderWidth: 1, padding: 18 },
  bTitle: { fontSize: 20, fontWeight: "900", textAlign: "center" },
  bSub: { marginTop: 6, fontSize: 13, fontWeight: "700", textAlign: "center" },
  input: {
    marginTop: 12,
    height: 52,
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    fontSize: 16,
    fontWeight: "700",
  },
  error: { marginTop: 10, color: "#b91c1c", fontWeight: "800", textAlign: "center" },
  btn: {
    marginTop: 14,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexDirection: "row",
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "900" },
});

const CARD_W = Math.min(280, width * 0.72);

const styles = StyleSheet.create({
  scrollPadding: { paddingBottom: 40 },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    marginTop: 44,
    marginBottom: 14,
  },

  welcomeText: { fontSize: 14, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  nameText: { fontSize: 26, fontWeight: "900" },

  settingsBtn: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  heroWrapper: { paddingHorizontal: 24, marginBottom: 30 },
  heroCard: {
    borderRadius: 32,
    padding: 24,
    elevation: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroInfo: { flex: 1 },
  heroLabel: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  heroSubject: { color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 4 },
  heroDate: { color: "#fff", fontSize: 15, marginTop: 4, opacity: 0.85, fontWeight: "600" },

  daysPill: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  daysPillText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },

  heroCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },

  heroNextBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  heroNextHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  heroNextLabel: { color: "rgba(255,255,255,0.75)", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  heroNextRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroNextDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "rgba(255,255,255,0.9)" },
  heroNextText: { color: "rgba(255,255,255,0.92)", fontSize: 12, fontWeight: "800", flex: 1 },

  sectionTitle: { fontSize: 20, fontWeight: "900", marginHorizontal: 24, marginBottom: 15 },

  bigGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 24, justifyContent: "space-between" },
  bigTile: { width: (width - 60) / 2, padding: 20, borderRadius: 30, marginBottom: 12, borderWidth: 1, elevation: 2 },
  bigTileIcon: { width: 60, height: 60, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 15 },
  bigTileTitle: { fontSize: 18, fontWeight: "900" },
  bigTileSub: { fontSize: 12, color: "#94a3b8", marginTop: 2, fontWeight: "600" },

  progressCard: { marginHorizontal: 24, marginTop: 10, padding: 24, borderRadius: 32, borderWidth: 1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  cardTitle: { fontSize: 18, fontWeight: "900" },
  progressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressItem: { alignItems: "center", flex: 1 },
  progressVal: { fontSize: 22, fontWeight: "900" },
  progressLab: { fontSize: 11, color: "#94a3b8", fontWeight: "700", marginTop: 4 },
  vDivider: { width: 1, height: 40, backgroundColor: "#f1f5f9" },

  moodCard: {
    marginHorizontal: 24,
    marginTop: 12,
    padding: 18,
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  moodLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  moodIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  moodEmoji: {
    fontSize: 26,
  },
  moodTitle: {
    fontSize: 17,
    fontWeight: "900",
  },
  moodSub: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },

  challengeCarousel: { paddingHorizontal: 24, paddingBottom: 8, gap: 12 },
  challengeCard: { width: CARD_W, borderRadius: 26, borderWidth: 1, padding: 16, marginRight: 12 },
  challengeCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  challengeIconBox: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  pctPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "#EEF2FF" },
  pctPillText: { fontWeight: "900", color: "#6366f1", fontSize: 12 },
  challengeTitleCard: { fontSize: 16, fontWeight: "900", lineHeight: 20, marginBottom: 6 },
  challengeMeta: { fontSize: 12, fontWeight: "800", marginBottom: 12 },
  barTrack: { width: "100%", height: 8, borderRadius: 999, backgroundColor: "#e5e7eb", overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 999, backgroundColor: "#6366f1" },
  challengeHint: { marginTop: 10, fontSize: 12, fontWeight: "700" },
});






