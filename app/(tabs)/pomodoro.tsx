import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Modal,
  Switch,
  StatusBar,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useKeepAwake } from "expo-keep-awake";
import * as Haptics from "expo-haptics";
import { useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { getExams, type Exam as StoredExam } from "../../utils/storage";
import { recordStudySession } from "../../utils/challenges";

type Phase = "focus" | "shortBreak" | "longBreak";

/* ------------------------------------------
   Storage keys & Types
-------------------------------------------*/
type PomoLogEntry = {
  ts: number;
  minutes: number; // whole minutes
  task?: string; // subject title
  subjectId?: string | null;
};

type PomoSession = {
  id: string;
  startedAt: number; // epoch ms
  plannedMinutes: number;
  actualMinutes: number; // whole minutes
  completed: boolean; // true only if finished naturally
  interruptedCount: number; // number of pauses during focus
  subjectId?: string | null;
  subjectTitle?: string;
};

type ExamItem = {
  id: string;
  subject: string;
  date: string;
  location?: string;
};

const POMO_LOG_KEY = "POMO_LOG";
const POMO_SESSIONS_KEY = "POMO_SESSIONS_V1";

const toDayKey = (d: Date) => {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};


const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export default function PomodoroScreen() {
  useKeepAwake();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { darkMode } = useTheme();

  // SETTINGS
  const [focusMin, setFocusMin] = useState(25);
  const [shortBreakMin, setShortBreakMin] = useState(5);
  const [longBreakMin, setLongBreakMin] = useState(15);
  const [longBreakEvery, setLongBreakEvery] = useState(4);
  const [autoStartNextPhase, setAutoStartNextPhase] = useState(false);

  // Exams -> used for subject picker list
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [todayStudyMinutes, setTodayStudyMinutes] = useState(0);
  const [todaySessions, setTodaySessions] = useState(0);
  const [todayFocusScore, setTodayFocusScore] = useState<number | null>(null);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [subjectModalOpen, setSubjectModalOpen] = useState(false); // centered modal for running mode
  const [subjectOpen, setSubjectOpen] = useState(false); // dropdown list for setup mode

  // Selected subject (default)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedSubjectTitle, setSelectedSubjectTitle] = useState<string>("General Study");

  // UI
  const [showHelp, setShowHelp] = useState(false);

  // STATE
  const [phase, setPhase] = useState<Phase>("focus");
  const [isRunning, setIsRunning] = useState(false);
  const [cycleCount, setCycleCount] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(focusMin * 60);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [hasStartedSession, setHasStartedSession] = useState(false);
  const [pendingAutoStart, setPendingAutoStart] = useState(false);

  /* ------------------------------------------
     Focus-session tracking
-------------------------------------------*/
  const sessionStartTsRef = useRef<number | null>(null);
  const interruptionsRef = useRef<number>(0);
  const savedMinutesRef = useRef<number>(0);
  const sessionFinalizedRef = useRef<boolean>(false);

  // Keep latest values in refs for async/unmount safety
  const secondsLeftRef = useRef(secondsLeft);
  const phaseRef = useRef<Phase>(phase);
  const focusMinRef = useRef(focusMin);
  const hasStartedSessionRef = useRef(hasStartedSession);
  const selectedSubjectIdRef = useRef<string | null>(selectedSubjectId);
  const selectedSubjectTitleRef = useRef<string>(selectedSubjectTitle);
  const autoStartNextPhaseRef = useRef(autoStartNextPhase);
  const soundEnabledRef = useRef(true);

  useEffect(() => {
    secondsLeftRef.current = secondsLeft;
  }, [secondsLeft]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    focusMinRef.current = focusMin;
  }, [focusMin]);
  useEffect(() => {
    hasStartedSessionRef.current = hasStartedSession;
  }, [hasStartedSession]);
  useEffect(() => {
    selectedSubjectIdRef.current = selectedSubjectId;
    selectedSubjectTitleRef.current = selectedSubjectTitle;
  }, [selectedSubjectId, selectedSubjectTitle]);
  useEffect(() => {
    autoStartNextPhaseRef.current = autoStartNextPhase;
  }, [autoStartNextPhase]);

  const phaseUI = useMemo(() => {
    const settings = {
      focus: {
        title: "Focus Time",
        colors: ["#6366f1", "#818cf8"] as [string, string],
        hint: "Stay calm and focus on one thing.",
      },
      shortBreak: {
        title: "Short Break",
        colors: ["#10b981", "#34d399"] as [string, string],
        hint: "Breathe and reset your mind.",
      },
      longBreak: {
        title: "Long Break",
        colors: ["#f59e0b", "#fbbf24"] as [string, string],
        hint: "Great work — recharge fully.",
      },
    };
    return settings[phase] || settings.focus;
  }, [phase]);

  const phaseDuration = useMemo(() => {
    if (phase === "focus") return focusMin * 60;
    if (phase === "shortBreak") return shortBreakMin * 60;
    return longBreakMin * 60;
  }, [phase, focusMin, shortBreakMin, longBreakMin]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const pct = Math.max(0, Math.min(1, 1 - secondsLeft / phaseDuration)) * 100;

  // Keep timer aligned when not running
  useEffect(() => {
    if (!isRunning) setSecondsLeft(phaseDuration);
  }, [phase, phaseDuration, isRunning]);

  const stopTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  /* ------------------------------------------
     Load exams from storage (subject picker)
-------------------------------------------*/
  const loadExams = async () => {
    try {
      const list: StoredExam[] = await getExams();
      const mapped: ExamItem[] = list
        .map((x) => ({
          id: String(x.id),
          subject: String(x.subject),
          date: String(x.date),
          location: x.location ? String(x.location) : undefined,
        }))
        .filter((x) => Boolean(x.id) && Boolean(x.subject));

      mapped.sort((a, b) => {
        const ta = Date.parse(a.date);
        const tb = Date.parse(b.date);
        if (!Number.isFinite(ta) || !Number.isFinite(tb)) return 0;
        return ta - tb;
      });

      setExams(mapped);
    } catch (e) {
      console.warn("Failed to load exams list", e);
      setExams([]);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadExams();
      loadTodayPomodoroStats();
      AsyncStorage.getItem("@settings_sound").then((v) => {
        soundEnabledRef.current = v === null ? true : v === "true";
      }).catch(() => {});
    }, [])
  );

  /* ------------------------------------------
     Storage helpers
-------------------------------------------*/
  const appendStudyMinutes = async (minutes: number) => {
    const safe = Math.max(0, Math.floor(minutes));
    if (safe <= 0) return;

    try {
      const raw = await AsyncStorage.getItem(POMO_LOG_KEY);
      const log: PomoLogEntry[] = raw ? JSON.parse(raw) : [];
      log.push({
        ts: Date.now(),
        minutes: safe,
        task: selectedSubjectTitleRef.current || "General Study",
        subjectId: selectedSubjectIdRef.current,
      });
      await AsyncStorage.setItem(POMO_LOG_KEY, JSON.stringify(log));
    } catch (e) {
      console.warn(e);
    }
  };

  const appendFocusSession = async (session: PomoSession) => {
    try {
      const raw = await AsyncStorage.getItem(POMO_SESSIONS_KEY);
      const sessions: PomoSession[] = raw ? JSON.parse(raw) : [];
      sessions.push(session);
      await AsyncStorage.setItem(POMO_SESSIONS_KEY, JSON.stringify(sessions));
    } catch (e) {
      console.warn(e);
    }
  };

  const loadTodayPomodoroStats = async () => {
  try {
    const todayKey = toDayKey(new Date());

    const rawLog = await AsyncStorage.getItem(POMO_LOG_KEY);
    const log: PomoLogEntry[] = rawLog ? JSON.parse(rawLog) : [];

    const studyMinutes = log
      .filter((entry) => toDayKey(new Date(entry.ts)) === todayKey)
      .reduce((sum, entry) => sum + (entry.minutes || 0), 0);

    const rawSessions = await AsyncStorage.getItem(POMO_SESSIONS_KEY);
    const sessions: PomoSession[] = rawSessions ? JSON.parse(rawSessions) : [];

    const todayCompletedSessions = sessions.filter(
      (session) =>
        toDayKey(new Date(session.startedAt)) === todayKey && session.completed
    );

    const todayAllSessions = sessions.filter(
      (session) => toDayKey(new Date(session.startedAt)) === todayKey
    );

    const totalSessionMinutes = todayAllSessions.reduce(
      (sum, session) => sum + (session.actualMinutes || 0),
      0
    );

    const focusedMinutes = todayAllSessions
      .filter((session) => session.completed && (session.interruptedCount || 0) === 0)
      .reduce((sum, session) => sum + (session.actualMinutes || 0), 0);

    const focusScore =
      totalSessionMinutes > 0
        ? Math.round((focusedMinutes / totalSessionMinutes) * 100)
        : null;

    setTodayStudyMinutes(studyMinutes);
    setTodaySessions(todayCompletedSessions.length);
    setTodayFocusScore(focusScore);
  } catch (e) {
    console.warn("Failed to load today's Pomodoro stats", e);
  }
};

  /* ------------------------------------------
     Focus tracking helpers
-------------------------------------------*/
  const ensureFocusTrackingStarted = () => {
    if (phaseRef.current !== "focus") return;
    if (!sessionStartTsRef.current) {
      sessionStartTsRef.current = Date.now();
      interruptionsRef.current = 0;
      savedMinutesRef.current = 0;
      sessionFinalizedRef.current = false;
    }
  };

  const flushFocusMinutes = async () => {
    if (phaseRef.current !== "focus") return;
    if (!hasStartedSessionRef.current) return;

    ensureFocusTrackingStarted();

    const plannedSeconds = Math.max(1, Math.floor(focusMinRef.current)) * 60;
    const elapsedSeconds = clamp(plannedSeconds - secondsLeftRef.current, 0, plannedSeconds);
    const elapsedWholeMinutes = Math.floor(elapsedSeconds / 60);

    const alreadySaved = savedMinutesRef.current || 0;
    const delta = elapsedWholeMinutes - alreadySaved;

    if (delta > 0) {
      await appendStudyMinutes(delta);
      savedMinutesRef.current = elapsedWholeMinutes;
    }
  };

  const finalizeFocusSessionOnce = async (completed: boolean) => {
    if (phaseRef.current !== "focus") return;
    if (!hasStartedSessionRef.current) return;

    ensureFocusTrackingStarted();
    await flushFocusMinutes();

    if (sessionFinalizedRef.current) return;

    const startedAt = sessionStartTsRef.current;
    const actualMinutes = savedMinutesRef.current || 0;

    if (!startedAt || actualMinutes <= 0) {
      sessionStartTsRef.current = null;
      interruptionsRef.current = 0;
      savedMinutesRef.current = 0;
      sessionFinalizedRef.current = false;
      return;
    }

    const session: PomoSession = {
      id: String(Date.now()),
      startedAt,
      plannedMinutes: Math.max(1, Math.floor(focusMinRef.current)),
      actualMinutes,
      completed,
      interruptedCount: Math.max(0, Math.floor(interruptionsRef.current || 0)),
      subjectId: selectedSubjectIdRef.current,
      subjectTitle: selectedSubjectTitleRef.current || "General Study",
    };

    sessionFinalizedRef.current = true;
    await appendFocusSession(session);

    // Update challenge progress whenever a Pomodoro session ends
    await recordStudySession({
      minutes: actualMinutes,
      subject: selectedSubjectTitleRef.current || undefined,
    }).catch(() => {});

    sessionStartTsRef.current = null;
    interruptionsRef.current = 0;
    savedMinutesRef.current = 0;
    sessionFinalizedRef.current = false;
  };

  const goNextPhase = () => {
    if (phaseRef.current === "focus") {
      const next = cycleCount + 1;
      setCycleCount(next);
      setPhase(next % longBreakEvery === 0 ? "longBreak" : "shortBreak");
    } else {
      setPhase("focus");
    }
  };

  /* ------------------------------------------
     Timer tick
-------------------------------------------*/
  useEffect(() => {
    if (isRunning && !intervalRef.current) {
      ensureFocusTrackingStarted();

      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            stopTimer();

            if (Platform.OS !== "web" && soundEnabledRef.current) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            (async () => {
              secondsLeftRef.current = 0;

              if (phaseRef.current === "focus") {
  await finalizeFocusSessionOnce(true);
  await loadTodayPomodoroStats();
  setSuccessModalOpen(true);
}

              goNextPhase();
              setIsRunning(false);
              setHasStartedSession(false);
              hasStartedSessionRef.current = false;

              if (autoStartNextPhaseRef.current) setPendingAutoStart(true);
            })();

            return 0;
          }

          const next = s - 1;
          secondsLeftRef.current = next;
          return next;
        });
      }, 1000);
    }

    return () => stopTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  useEffect(() => {
    if (pendingAutoStart) {
      setPendingAutoStart(false);
      setIsRunning(true);
      setHasStartedSession(true);
      hasStartedSessionRef.current = true;
      ensureFocusTrackingStarted();
    }
  }, [pendingAutoStart]);

  useEffect(() => {
    return () => {
      if (phaseRef.current === "focus" && hasStartedSessionRef.current) {
        flushFocusMinutes();
      }
      stopTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------
     Controls
-------------------------------------------*/
  const onStartPause = async () => {
    if (!hasStartedSessionRef.current) {
      setHasStartedSession(true);
      hasStartedSessionRef.current = true;
      ensureFocusTrackingStarted();
    }

    if (isRunning) {
      await flushFocusMinutes();
      if (phaseRef.current === "focus") interruptionsRef.current += 1;
    } else {
      ensureFocusTrackingStarted();
    }

    setIsRunning((p) => !p);
  };

  const onReset = async () => {
    await flushFocusMinutes();

    if (phaseRef.current === "focus" && hasStartedSessionRef.current) {
      await finalizeFocusSessionOnce(false);
    }

    if (Platform.OS !== "web" && soundEnabledRef.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setIsRunning(false);
    stopTimer();
    setPhase("focus");
    setCycleCount(0);

    setHasStartedSession(false);
    hasStartedSessionRef.current = false;

    setSecondsLeft(Math.max(1, Math.floor(focusMinRef.current)) * 60);
  };

  const onSkip = async () => {
    await flushFocusMinutes();

    if (phaseRef.current === "focus" && hasStartedSessionRef.current) {
      await finalizeFocusSessionOnce(false);
    }

    if (Platform.OS !== "web" && soundEnabledRef.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    stopTimer();
    setIsRunning(false);
    goNextPhase();

    setHasStartedSession(false);
    hasStartedSessionRef.current = false;

    if (autoStartNextPhase) setPendingAutoStart(true);
  };

  const handleBack = async () => {
    await flushFocusMinutes();

    if (phaseRef.current === "focus" && hasStartedSessionRef.current) {
      await finalizeFocusSessionOnce(false);
    }

    stopTimer();
    setIsRunning(false);
    setHasStartedSession(false);
    hasStartedSessionRef.current = false;

    router.back();
  };

  /* ------------------------------------------
     Subject picker helpers (NO custom subject)
-------------------------------------------*/
  const displayedSubject = selectedSubjectTitle || "General Study";
  const nextExamForSelectedSubject = useMemo(() => {
  if (!selectedSubjectId) return null;

  const now = Date.now();

  const match = exams
    .filter((exam) => exam.id === selectedSubjectId)
    .map((exam) => ({ ...exam, time: new Date(exam.date).getTime() }))
    .filter((exam) => exam.time >= now)
    .sort((a, b) => a.time - b.time)[0];

  if (!match) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const examDate = new Date(match.date);
  examDate.setHours(0, 0, 0, 0);

  const daysLeft = Math.ceil(
    (examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    subject: match.subject,
    daysLeft,
  };
}, [exams, selectedSubjectId]);

  const SubjectList = ({ onPick }: { onPick: () => void }) => (
    <View>
      <TouchableOpacity
        style={[
          styles.dropdownRow,
          selectedSubjectId === null && styles.dropdownRowActive,
          darkMode && styles.dropdownRowDark,
        ]}
        activeOpacity={0.9}
        onPress={() => {
          setSelectedSubjectId(null);
          setSelectedSubjectTitle("General Study");
          onPick();
        }}
      >
        <Text style={[styles.dropdownRowText, darkMode && styles.textOnDark]}>General Study</Text>
        {selectedSubjectId === null && <Ionicons name="checkmark" size={18} color="#6366f1" />}
      </TouchableOpacity>

      <View style={[styles.dropdownDivider, darkMode && styles.dropdownDividerDark]} />

      <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
        {exams.length === 0 ? (
          <Text style={[styles.dropdownEmpty, darkMode && styles.subTextOnDark]}>
            No exams found yet. Add exams first.
          </Text>
        ) : (
          exams.map((ex) => {
            const active = selectedSubjectId === ex.id;
            return (
              <TouchableOpacity
                key={ex.id}
                style={[
                  styles.dropdownRow,
                  active && styles.dropdownRowActive,
                  darkMode && styles.dropdownRowDark,
                ]}
                activeOpacity={0.9}
                onPress={() => {
                  setSelectedSubjectId(ex.id);
                  setSelectedSubjectTitle(ex.subject);
                  onPick();
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.dropdownRowText, darkMode && styles.textOnDark]}>
                    {ex.subject}
                  </Text>
                  <Text style={[styles.dropdownRowSub, darkMode && styles.subTextOnDark]}>
                    {new Date(ex.date).toLocaleString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
                {active && <Ionicons name="checkmark" size={18} color="#6366f1" />}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );

  return (
    <View style={[styles.container, darkMode && { backgroundColor: "#0B1220" }]}>
      <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />
      <LinearGradient
        colors={darkMode ? ["#0B1220", "#111827"] : ["#EEF2FF", "#F8FAFC"]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 18 }]}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={handleBack}
              style={[styles.backBtn, darkMode && styles.backBtnDark]}
              activeOpacity={0.8}
            >
              <Ionicons name="chevron-back" size={22} color="#4F46E5" />
            </TouchableOpacity>

            <View style={{ alignItems: "center", flex: 1 }}>
              <Text style={[styles.headerTitle, darkMode && styles.textOnDark]}>Pomodoro</Text>
              <Text style={[styles.headerSub, darkMode && styles.subTextOnDark]}>
                Calm, structured focus
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setShowHelp(true)}
              style={[styles.helpBtn, darkMode && styles.helpBtnDark]}
            >
              <Ionicons name="help-circle-outline" size={24} color="#6366f1" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Timer Card */}
          {hasStartedSession ? (
            <View style={[styles.timerCard, darkMode && styles.cardDark]}>
              <LinearGradient
                colors={phaseUI?.colors ?? ["#6366f1", "#818cf8"]}
                style={styles.timerGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {/* Subject badge -> opens centered modal */}
                <TouchableOpacity
                  style={styles.taskBadge}
                  activeOpacity={0.85}
                  onPress={() => {
                    loadExams();
                    setSubjectModalOpen(true);
                  }}
                >
                  <Text style={styles.taskText}>🎯 {displayedSubject}</Text>
                  <Ionicons name="chevron-down" size={16} color="#fff" />
                </TouchableOpacity>

                <Text style={styles.phaseLabel}>{phaseUI.title}</Text>
                <Text style={styles.timerText}>
                  {mm}:{ss}
                </Text>

                <View style={styles.miniProgressContainer}>
                  <View style={[styles.miniProgressBar, { width: `${pct}%` }]} />
                </View>

                <View style={styles.dotsRow}>
                  {Array.from({ length: longBreakEvery }).map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        {
                          backgroundColor:
                            cycleCount % longBreakEvery > i ? "#fff" : "rgba(255,255,255,0.3)",
                        },
                      ]}
                    />
                  ))}
                </View>

                <Text style={styles.timerHint}>{phaseUI.hint}</Text>
              </LinearGradient>

              <View style={[styles.timerControls, darkMode && styles.controlsDark]}>
                <TouchableOpacity
                  onPress={onStartPause}
                  style={styles.mainActionBtn}
                  activeOpacity={0.85}
                >
                  <Ionicons name={isRunning ? "pause" : "play"} size={28} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onSkip}
                  style={[styles.secondaryActionBtn, darkMode && styles.secondaryActionBtnDark]}
                  activeOpacity={0.85}
                >
                  <Ionicons name="play-skip-forward" size={24} color="#6366f1" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onReset}
                  style={[styles.secondaryActionBtn, darkMode && styles.secondaryActionBtnDark]}
                  activeOpacity={0.85}
                >
                  <Ionicons name="refresh" size={24} color={darkMode ? "#CBD5E1" : "#64748B"} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.setupContainer}>
              {/* ✅ NEW UX: Chip-only subject selector (no "What subject..." label) */}
              <View style={{ marginBottom: 14 }}>
                <TouchableOpacity
                  onPress={() => {
                    loadExams();
                    setSubjectOpen((v) => !v);
                  }}
                  activeOpacity={0.9}
                  style={[styles.subjectChip, darkMode && styles.subjectChipDark]}
                >
                  <Text
                    style={[styles.subjectChipText, darkMode && styles.textOnDark]}
                    numberOfLines={1}
                  >
                    🎯 {displayedSubject}
                  </Text>
                  <Ionicons
                    name={subjectOpen ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={darkMode ? "#CBD5E1" : "#64748B"}
                  />
                </TouchableOpacity>

                {subjectOpen && (
                  <View style={[styles.dropdownCard, darkMode && styles.dropdownCardDark, { marginTop: 10 }]}>
                    <SubjectList onPick={() => setSubjectOpen(false)} />
                  </View>
                )}

                {nextExamForSelectedSubject && (
  <View style={[styles.nextExamCard, darkMode && styles.nextExamCardDark]}>
    <Ionicons name="school-outline" size={20} color="#6366f1" />
    <View style={{ flex: 1 }}>
      <Text style={[styles.nextExamTitle, darkMode && styles.textOnDark]}>
        Next Exam
      </Text>
      <Text style={[styles.nextExamText, darkMode && styles.subTextOnDark]}>
        {nextExamForSelectedSubject.subject} •{" "}
        {nextExamForSelectedSubject.daysLeft === 0
          ? "Today"
          : nextExamForSelectedSubject.daysLeft === 1
          ? "Tomorrow"
          : `${nextExamForSelectedSubject.daysLeft} days left`}
      </Text>
    </View>
  </View>
)}
              </View>

              <TouchableOpacity onPress={onStartPause} style={styles.setupHero} activeOpacity={0.9}>
                <LinearGradient colors={["#6366f1", "#a855f7"]} style={styles.heroGradient}>
                  <Ionicons name="hourglass" size={40} color="#fff" />
                  <Text style={styles.heroTitle}>Start Focus Session</Text>
                  <Text style={styles.heroSub}>One calm step at a time.</Text>
                </LinearGradient>
              </TouchableOpacity>

              <View style={[styles.todayPomoCard, darkMode && styles.todayPomoCardDark]}>
  <Text style={[styles.todayPomoTitle, darkMode && styles.textOnDark]}>
    Today's Focus Progress
  </Text>

  <View style={styles.todayPomoRow}>
    <View style={styles.todayPomoItem}>
      <Text style={styles.todayPomoValue}>{todayStudyMinutes}m</Text>
      <Text style={[styles.todayPomoLabel, darkMode && styles.subTextOnDark]}>
        Study
      </Text>
    </View>

    <View style={styles.todayPomoItem}>
      <Text style={styles.todayPomoValue}>{todaySessions}</Text>
      <Text style={[styles.todayPomoLabel, darkMode && styles.subTextOnDark]}>
        Sessions
      </Text>
    </View>

    <View style={styles.todayPomoItem}>
      <Text style={styles.todayPomoValue}>
        {todayFocusScore === null ? "—" : `${todayFocusScore}%`}
      </Text>
      <Text style={[styles.todayPomoLabel, darkMode && styles.subTextOnDark]}>
        Focus
      </Text>
    </View>
  </View>
</View>
            </View>
          )}

          {/* Settings Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, darkMode && styles.textOnDark]}>Adjust Intervals</Text>

            <View style={[styles.settingsCard, darkMode && styles.settingsCardDark]}>
              <ControlRow
                darkMode={darkMode}
                label="Focus Duration"
                value={focusMin}
                unit="min"
                onMinus={() => setFocusMin(Math.max(5, focusMin - 5))}
                onPlus={() => setFocusMin(Math.min(120, focusMin + 5))}
              />

              <View style={[styles.divider, darkMode && styles.dividerDark]} />

              <ControlRow
                darkMode={darkMode}
                label="Short Break"
                value={shortBreakMin}
                unit="min"
                onMinus={() => setShortBreakMin(Math.max(1, shortBreakMin - 1))}
                onPlus={() => setShortBreakMin(Math.min(30, shortBreakMin + 1))}
              />

              <View style={[styles.divider, darkMode && styles.dividerDark]} />

              <ControlRow
                darkMode={darkMode}
                label="Long Break"
                value={longBreakMin}
                unit="min"
                onMinus={() => setLongBreakMin(Math.max(5, longBreakMin - 5))}
                onPlus={() => setLongBreakMin(Math.min(60, longBreakMin + 5))}
              />

              <View style={[styles.divider, darkMode && styles.dividerDark]} />

              <ControlRow
                darkMode={darkMode}
                label="Long break every"
                value={longBreakEvery}
                unit="cycles"
                onMinus={() => setLongBreakEvery(Math.max(2, longBreakEvery - 1))}
                onPlus={() => setLongBreakEvery(Math.min(10, longBreakEvery + 1))}
              />

              <View style={[styles.divider, darkMode && styles.dividerDark]} />

              <View style={styles.switchRow}>
                <View>
                  <Text style={[styles.switchLabel, darkMode && styles.textOnDark]}>Auto-start next</Text>
                  <Text style={[styles.switchSub, darkMode && styles.subTextOnDark]}>Smooth transitions</Text>
                </View>
                <Switch
                  value={autoStartNextPhase}
                  onValueChange={setAutoStartNextPhase}
                  trackColor={{ false: darkMode ? "#1F2937" : "#E2E8F0", true: "#6366f1" }}
                  thumbColor={Platform.OS === "android" ? (darkMode ? "#E5E7EB" : "#fff") : undefined}
                />
              </View>
            </View>
          </View>
        </ScrollView>

        {/* HELP MODAL */}
        <Modal visible={showHelp} animationType="slide" transparent onRequestClose={() => setShowHelp(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, darkMode && styles.modalCardDark]}>
              <Text style={[styles.modalTitle, darkMode && styles.textOnDark]}>What is Pomodoro?</Text>

              <Text style={[styles.modalText, darkMode && styles.modalTextDark]}>
                Work in <Text style={{ fontWeight: "800" }}>short, focused blocks</Text> (e.g., 25 minutes),
                then take a <Text style={{ fontWeight: "800" }}>short break</Text>. After a few cycles,
                take a <Text style={{ fontWeight: "800" }}>long break</Text> to recharge.
              </Text>

              <Text style={[styles.modalSubtitle, darkMode && styles.textOnDark]}>Stress-friendly tip</Text>

              <Text style={[styles.modalText, darkMode && styles.modalTextDark]}>
                Keep your goal simple: start the timer, focus on one small step, and allow breaks without guilt.
              </Text>

              <TouchableOpacity onPress={() => setShowHelp(false)} style={[styles.modalBtn, darkMode && styles.modalBtnDark]}>
                <Text style={styles.modalBtnText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal
  visible={successModalOpen}
  transparent
  animationType="fade"
  onRequestClose={() => setSuccessModalOpen(false)}
>
  <View style={styles.centerOverlay}>
    <View style={[styles.successCard, darkMode && styles.centerCardDark]}>
      <View style={styles.successIcon}>
        <Ionicons name="checkmark" size={32} color="#fff" />
      </View>

      <Text style={[styles.successTitle, darkMode && styles.textOnDark]}>
        Great work!
      </Text>

      <Text style={[styles.successText, darkMode && styles.subTextOnDark]}>
        You completed a full focus session. One calm step closer to your study goal.
      </Text>

      <TouchableOpacity
        onPress={() => setSuccessModalOpen(false)}
        style={styles.successBtn}
        activeOpacity={0.9}
      >
        <Text style={styles.successBtnText}>Continue</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>

        {/* SUBJECT PICKER MODAL (running mode) - centered */}
        <Modal
          visible={subjectModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setSubjectModalOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => setSubjectModalOpen(false)} style={styles.centerOverlay}>
            <TouchableOpacity activeOpacity={1} style={[styles.centerCard, darkMode && styles.centerCardDark]}>
              <View style={styles.centerHeader}>
                <Text style={[styles.centerTitle, darkMode && styles.textOnDark]}>Choose a subject</Text>
                <TouchableOpacity onPress={() => setSubjectModalOpen(false)} activeOpacity={0.9}>
                  <Ionicons name="close" size={22} color={darkMode ? "#E5E7EB" : "#111827"} />
                </TouchableOpacity>
              </View>

              <SubjectList onPick={() => setSubjectModalOpen(false)} />
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

function ControlRow({ label, value, unit, onMinus, onPlus, darkMode }: any) {
  return (
    <View style={styles.controlRow}>
      <View>
        <Text style={[styles.controlLabel, darkMode && styles.subTextOnDark]}>{label}</Text>
        <Text style={[styles.controlValue, darkMode && styles.textOnDark]}>
          {value} {unit}
        </Text>
      </View>
      <View style={styles.controlButtons}>
        <TouchableOpacity onPress={onMinus} style={[styles.stepBtn, darkMode && styles.stepBtnDark]}>
          <Ionicons name="remove" size={20} color={darkMode ? "#CBD5E1" : "#64748B"} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onPlus} style={[styles.stepBtn, darkMode && styles.stepBtnDark]}>
          <Ionicons name="add" size={20} color="#6366f1" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },

  header: { alignItems: "center", paddingVertical: 16 },
  headerRow: {
    width: "100%",
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  headerTitle: { fontSize: 24, fontWeight: "900", color: "#1E293B" },
  headerSub: { fontSize: 13, color: "#64748B", fontWeight: "600" },

  helpBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  helpBtnDark: { backgroundColor: "rgba(99,102,241,0.14)" },

  scrollContent: { paddingBottom: 110 },

  timerCard: {
    marginHorizontal: 24,
    backgroundColor: "#fff",
    borderRadius: 32,
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#6366f1",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    marginBottom: 20,
  },
  cardDark: { backgroundColor: "#111827", elevation: 0, shadowOpacity: 0 },

  timerGradient: { padding: 36, alignItems: "center" },

  taskBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 14,
  },
  taskText: { color: "#fff", fontWeight: "900", fontSize: 13 },

  phaseLabel: {
    color: "rgba(255,255,255,0.85)",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
  },
  timerText: { fontSize: 80, fontWeight: "900", color: "#fff" },

  miniProgressContainer: {
    width: "100%",
    height: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 10,
    marginVertical: 15,
    overflow: "hidden",
  },
  miniProgressBar: { height: "100%", backgroundColor: "#fff" },

  dotsRow: { flexDirection: "row", gap: 8, marginBottom: 15 },
  dot: { width: 8, height: 8, borderRadius: 4 },

  timerHint: { color: "#fff", fontWeight: "700", opacity: 0.92, fontSize: 14, textAlign: "center" },

  timerControls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 20,
    backgroundColor: "#fff",
  },
  controlsDark: { backgroundColor: "#111827" },

  mainActionBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#6366f1",
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryActionBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionBtnDark: {
    backgroundColor: "#0B1220",
    borderWidth: 1,
    borderColor: "#1F2937",
  },

  setupContainer: { paddingHorizontal: 24, marginBottom: 20 },

  /* ✅ New chip */
  subjectChip: {
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  subjectChipDark: { backgroundColor: "#111827", borderColor: "#1F2937" },
  subjectChipText: { fontSize: 14, fontWeight: "900", color: "#111827", flex: 1, marginRight: 10 },

  setupHero: { width: "100%" },
  heroGradient: { borderRadius: 32, padding: 36, alignItems: "center", justifyContent: "center" },
  heroTitle: { color: "#fff", fontSize: 22, fontWeight: "900", marginTop: 12 },
  heroSub: { color: "rgba(255,255,255,0.85)", fontWeight: "700", marginTop: 6 },

  section: { paddingHorizontal: 24 },
  sectionTitle: { fontSize: 18, fontWeight: "900", color: "#1E293B", marginBottom: 12 },

  settingsCard: { backgroundColor: "#fff", borderRadius: 24, padding: 20 },
  settingsCardDark: { backgroundColor: "#111827" },

  controlRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  controlLabel: { fontSize: 14, color: "#64748B", fontWeight: "700" },
  controlValue: { fontSize: 18, fontWeight: "900", color: "#1E293B" },

  controlButtons: { flexDirection: "row", gap: 10 },

  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  stepBtnDark: { backgroundColor: "#0B1220", borderColor: "#1F2937" },

  divider: { height: 1, backgroundColor: "#F1F5F9", marginVertical: 10 },
  dividerDark: { backgroundColor: "#1F2937" },

  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  switchLabel: { fontSize: 15, fontWeight: "800", color: "#1E293B" },
  switchSub: { fontSize: 12, color: "#94A3B8", fontWeight: "700" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalCardDark: { backgroundColor: "#111827" },

  modalTitle: { fontSize: 18, fontWeight: "900", color: "#0F172A", marginBottom: 10 },
  modalSubtitle: { fontSize: 14, fontWeight: "900", color: "#0F172A", marginTop: 12, marginBottom: 6 },
  modalText: { fontSize: 13, lineHeight: 19, color: "#475569", fontWeight: "700" },
  modalTextDark: { color: "#CBD5E1" },

  modalBtn: { marginTop: 16, backgroundColor: "#6366f1", paddingVertical: 12, borderRadius: 14, alignItems: "center" },
  modalBtnDark: { backgroundColor: "#4f46e5" },
  modalBtnText: { color: "#fff", fontWeight: "900" },

  backBtn: {
    width: 44,
    height: 44,
    backgroundColor: "#fff",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  backBtnDark: { backgroundColor: "#111827", elevation: 0, shadowOpacity: 0 },

  /* Dropdown list */
  dropdownCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10,
    marginBottom: 14,
  },
  dropdownCardDark: { backgroundColor: "#111827", borderColor: "#1F2937" },

  dropdownRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 10,
    gap: 10,
  },
  dropdownRowDark: { backgroundColor: "#0B1220", borderColor: "#1F2937" },
  dropdownRowActive: { borderColor: "#6366f1", backgroundColor: "#EEF2FF" },
  dropdownRowText: { fontWeight: "900", color: "#111827" },
  dropdownRowSub: { fontWeight: "700", color: "#64748B", fontSize: 11, marginTop: 2 },

  dropdownDivider: { height: 1, backgroundColor: "#E2E8F0", marginVertical: 8 },
  dropdownDividerDark: { backgroundColor: "#1F2937" },
  dropdownEmpty: { paddingVertical: 10, fontWeight: "700", fontSize: 13 },

  /* Centered modal for running mode */
  centerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  centerCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 14,
  },
  centerCardDark: { backgroundColor: "#111827" },
  centerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  centerTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },

  /* Shared text colors */
  textOnDark: { color: "#E5E7EB" },
  subTextOnDark: { color: "#9CA3AF" },


  nextExamCard: {
  marginBottom: 14,
  padding: 14,
  borderRadius: 18,
  backgroundColor: "#fff",
  borderWidth: 1,
  borderColor: "#E2E8F0",
  flexDirection: "row",
  alignItems: "center",
  gap: 12,
},
nextExamCardDark: {
  backgroundColor: "#111827",
  borderColor: "#1F2937",
},
nextExamTitle: {
  fontSize: 13,
  fontWeight: "900",
  color: "#111827",
},
nextExamText: {
  marginTop: 2,
  fontSize: 12,
  fontWeight: "700",
  color: "#64748B",
},

todayPomoCard: {
  marginTop: 16,
  marginBottom: 20,
  padding: 18,
  borderRadius: 24,
  backgroundColor: "#fff",
  borderWidth: 1,
  borderColor: "#E2E8F0",
},
todayPomoCardDark: {
  backgroundColor: "#111827",
  borderColor: "#1F2937",
},
todayPomoTitle: {
  fontSize: 16,
  fontWeight: "900",
  color: "#111827",
  marginBottom: 14,
},
todayPomoRow: {
  flexDirection: "row",
  justifyContent: "space-between",
},
todayPomoItem: {
  alignItems: "center",
  flex: 1,
},
todayPomoValue: {
  fontSize: 22,
  fontWeight: "900",
  color: "#6366f1",
},
todayPomoLabel: {
  marginTop: 4,
  fontSize: 11,
  fontWeight: "700",
  color: "#64748B",
},

successCard: {
  width: "100%",
  maxWidth: 360,
  backgroundColor: "#fff",
  borderRadius: 24,
  padding: 24,
  alignItems: "center",
},
successIcon: {
  width: 64,
  height: 64,
  borderRadius: 32,
  backgroundColor: "#10B981",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 14,
},
successTitle: {
  fontSize: 22,
  fontWeight: "900",
  color: "#111827",
},
successText: {
  marginTop: 8,
  fontSize: 14,
  lineHeight: 20,
  textAlign: "center",
  fontWeight: "600",
  color: "#64748B",
},
successBtn: {
  marginTop: 18,
  backgroundColor: "#6366f1",
  paddingHorizontal: 24,
  paddingVertical: 12,
  borderRadius: 14,
},
successBtnText: {
  color: "#fff",
  fontWeight: "900",
},
});