
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  Animated,
  Easing,
  Platform,
  Alert,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Audio } from "expo-av";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { recordBreathingSession, recordBubblePopPlay } from "../../utils/challenges";

/* ------------------------------------------------------------------ */
/* Storage (optional logs)                                             */
/* ------------------------------------------------------------------ */
const LOG_KEY = "stressGames:logs:v3";

type Mode = "home" | "bubble" | "breathing";
type BreathKind = "calming" | "box";

type GameEntry = {
  id: string;
  createdAt: string;
  game: "breathing" | "bubble";
  detail?: string;
  breathKind?: BreathKind;
  pattern?: string;
  breathsCompleted?: number;
  bubbleScore?: number;
  level?: number;
};

function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
const pad2 = (n: number) => String(n).padStart(2, "0");
function formatMMSS(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${pad2(s)}`;
}
function getPattern(kind: BreathKind) {
  if (kind === "calming") return { inhale: 4, hold: 2, exhale: 6, hold2: 0, label: "4-2-6" };
  return { inhale: 4, hold: 4, exhale: 4, hold2: 4, label: "4-4-4-4" };
}

/* ------------------------------------------------------------------ */
/* 🎵 Audio tracks                                                      */
/* IMPORTANT (Windows/Metro): rename files to simple names:            */
/* assets/audio/track1.mp3, track2.mp3, track3.mp3                     */
/* ------------------------------------------------------------------ */
const TRACKS = [
  require("../../assets/audio/track1.mp3"),
];
function pickRandomTrack() {
  return TRACKS[Math.floor(Math.random() * TRACKS.length)];
}

/* ------------------------------------------------------------------ */
/* Box Breathing UI (square, NO ball)                                  */
/* ------------------------------------------------------------------ */
function BoxBreathingSquare({ label }: { label: string }) {
  const S = 300;
  return (
    <View style={[styles.boxFrame, { width: S, height: S }]}>
      <View style={styles.boxInner}>
        <Text style={styles.boxLabel}>{label}</Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Bubble Pop (floating bubbles + levels)                              */
/* ------------------------------------------------------------------ */
type FloatBubble = {
  id: string;
  x: number;
  size: number;
  fill: string;
  border: string;
  animY: Animated.Value;
};

const COLORS = [
  { fill: "rgba(59,130,246,0.55)", border: "rgba(37,99,235,0.85)" }, // blue
  { fill: "rgba(244,63,94,0.55)", border: "rgba(225,29,72,0.85)" }, // pink/red
  { fill: "rgba(34,197,94,0.55)", border: "rgba(22,163,74,0.85)" }, // green
  { fill: "rgba(168,85,247,0.55)", border: "rgba(147,51,234,0.85)" }, // purple
];

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */
export default function ToolboxScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W } = Dimensions.get("window");
  const { darkMode } = useTheme();

  const bgColors = darkMode
    ? (["#0B1220", "#0f172a"] as const)
    : (["#F8FAFC", "#EEF2FF"] as const);
  const bg = darkMode ? "#0B1220" : "#F8FAFC";
  const cardBg = darkMode ? "#1e293b" : "#ffffff";
  const cardBorder = darkMode ? "#334155" : "#E2E8F0";
  const textPrimary = darkMode ? "#f1f5f9" : "#111827";
  const textSecondary = darkMode ? "#94a3b8" : "#64748B";

  const [mode, setMode] = useState<Mode>("home");

  // breathing choice modal
  const [showBreathChoice, setShowBreathChoice] = useState(false);

  // breathing state
  const [breathKind, setBreathKind] = useState<BreathKind>("calming");
  const [breathPhase, setBreathPhase] = useState<"inhale" | "hold" | "exhale" | "hold2">("inhale");
  const [phaseMsLeft, setPhaseMsLeft] = useState(0);
  const [breathsCompleted, setBreathsCompleted] = useState(0);
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState(5 * 60);

  // calming ring animation
  const ringScale = useRef(new Animated.Value(1)).current;

  // 🎵 music
  const musicRef = useRef<Audio.Sound | null>(null);
  const [musicReady, setMusicReady] = useState(false);
  const [isMusicOn, setIsMusicOn] = useState(false);

  // Bubble Pop
  const [bubbleScore, setBubbleScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [floatBubbles, setFloatBubbles] = useState<FloatBubble[]>([]);
  const [gameRunning, setGameRunning] = useState(false);

  // REAL play area height (measured)
  const [playAreaH, setPlayAreaH] = useState(0);

  // Level tuning
  const spawnIntervalMs = useMemo(() => Math.max(350, 900 - (level - 1) * 90), [level]);
  const bubbleDurationMs = useMemo(() => Math.max(2200, 5200 - (level - 1) * 380), [level]);
  const maxBubbles = useMemo(() => Math.min(14, 6 + (level - 1) * 2), [level]);

  // init
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          await AsyncStorage.getItem(LOG_KEY);
        } catch {}
      })();
    }, [])
  );

  const saveLog = async (entry: GameEntry) => {
    try {
      const raw = await AsyncStorage.getItem(LOG_KEY);
      const logs: GameEntry[] = raw ? JSON.parse(raw) : [];
      const next = [entry, ...logs].slice(0, 200);
      await AsyncStorage.setItem(LOG_KEY, JSON.stringify(next));
    } catch {}
  };

  /* ------------------------------ MUSIC ------------------------------ */
  const stopAndUnloadMusic = async () => {
    try {
      if (musicRef.current) {
        await musicRef.current.stopAsync();
        await musicRef.current.unloadAsync();
        musicRef.current = null;
      }
    } catch {}
    setMusicReady(false);
    setIsMusicOn(false);
  };

  const stopBubbleGame = () => {
    setGameRunning(false);
    setFloatBubbles((prev) => {
      prev.forEach((b) => b.animY.stopAnimation());
      return [];
    });
  };

  const goHome = async () => {
    await stopAndUnloadMusic();
    stopBubbleGame();
    setMode("home");
  };

  useFocusEffect(
    useCallback(() => {
      if (mode !== "breathing") return;

      let cancelled = false;

      (async () => {
        try {
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
          });

          await stopAndUnloadMusic();

          const { sound } = await Audio.Sound.createAsync(pickRandomTrack(), {
            shouldPlay: true,
            isLooping: true,
            volume: 0.85,
          });

          if (cancelled) {
            await sound.unloadAsync();
            return;
          }

          musicRef.current = sound;
          setMusicReady(true);
          setIsMusicOn(true);
        } catch (e) {
          console.log("Music init error:", e);
        }
      })();

      return () => {
        cancelled = true;
        (async () => {
          await stopAndUnloadMusic();
        })();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode])
  );

  const toggleMusic = async () => {
    try {
      const sound = musicRef.current;
      if (!sound) return;

      const status = await sound.getStatusAsync();
      if (!status.isLoaded) return;

      if (status.isPlaying) {
        await sound.pauseAsync();
        setIsMusicOn(false);
      } else {
        await sound.playAsync();
        setIsMusicOn(true);
      }
    } catch (e) {
      console.log("toggleMusic error:", e);
    }
  };

  /* --------------------------- BREATHING --------------------------- */
  const startBreathing = (kind: BreathKind) => {
    const p = getPattern(kind);
    setBreathKind(kind);
    setBreathPhase("inhale");
    setPhaseMsLeft(p.inhale * 1000);
    setBreathsCompleted(0);
    setSessionSecondsLeft(5 * 60);
    setMode("breathing");
    setShowBreathChoice(false);
  };

  const restartBreathing = () => startBreathing(breathKind);

  useFocusEffect(
    useCallback(() => {
      if (mode !== "breathing") return () => {};
      const tick = setInterval(() => setPhaseMsLeft((ms) => Math.max(0, ms - 200)), 200);
      const sec = setInterval(() => setSessionSecondsLeft((s) => Math.max(0, s - 1)), 1000);
      return () => {
        clearInterval(tick);
        clearInterval(sec);
      };
    }, [mode])
  );

  useFocusEffect(
    useCallback(() => {
      if (mode !== "breathing") return;

      const p = getPattern(breathKind);

      if (sessionSecondsLeft <= 0) {
        (async () => {
          const now = new Date();
          await saveLog({
            id: uid(),
            createdAt: now.toISOString(),
            game: "breathing",
            breathKind,
            pattern: p.label,
            breathsCompleted,
            detail: "breathing session completed",
          });
          await recordBreathingSession({ kind: breathKind, hour: now.getHours() });
          await goHome();
        })();
        return;
      }

      if (phaseMsLeft > 0) return;

      if (breathPhase === "inhale") {
        setBreathPhase("hold");
        setPhaseMsLeft(p.hold * 1000);
        return;
      }
      if (breathPhase === "hold") {
        setBreathPhase("exhale");
        setPhaseMsLeft(p.exhale * 1000);
        return;
      }
      if (breathPhase === "exhale") {
        if (p.hold2 > 0) {
          setBreathPhase("hold2");
          setPhaseMsLeft(p.hold2 * 1000);
          return;
        }
        setBreathsCompleted((b) => b + 1);
        setBreathPhase("inhale");
        setPhaseMsLeft(p.inhale * 1000);
        return;
      }
      if (breathPhase === "hold2") {
        setBreathsCompleted((b) => b + 1);
        setBreathPhase("inhale");
        setPhaseMsLeft(p.inhale * 1000);
      }
    }, [mode, phaseMsLeft, breathPhase, breathKind, sessionSecondsLeft, breathsCompleted])
  );

  useFocusEffect(
    useCallback(() => {
      if (mode !== "breathing") return;
      const to = breathPhase === "inhale" ? 1.08 : breathPhase === "exhale" ? 0.96 : 1.02;
      Animated.timing(ringScale, {
        toValue: to,
        duration: breathPhase === "inhale" ? 1000 : breathPhase === "exhale" ? 1000 : 600,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start();
    }, [mode, breathPhase, ringScale])
  );

  const breathLabel = useMemo(() => {
    if (breathPhase === "inhale") return "Inhale";
    if (breathPhase === "exhale") return "Exhale";
    return "Hold";
  }, [breathPhase]);

  /* --------------------------- BUBBLE POP --------------------------- */
  const computeLevelFromScore = (score: number) => 1 + Math.floor(score / 60);

  const startBubbleGame = async () => {
    await stopAndUnloadMusic(); // just in case
    stopBubbleGame();
    setBubbleScore(0);
    setLevel(1);
    setFloatBubbles([]);
    setGameRunning(true);
    setMode("bubble");
  };

  const spawnFloatBubble = useCallback(() => {
    setFloatBubbles((prev) => {
      if (!gameRunning) return prev;
      if (!playAreaH) return prev; // WAIT until onLayout gives real height
      if (prev.length >= maxBubbles) return prev;

      const size = 54 + Math.floor(Math.random() * 42); // 54..96
      const x = 14 + Math.random() * (W - size - 28);
      const c = COLORS[Math.floor(Math.random() * COLORS.length)];
      const id = uid();

      // IMPORTANT:
      // bubbles are absolute with bottom:0 and we animate translateY.
      // translateY = 0 => bubble is at bottom.
      // To reach the TOP of the play area (top=0), we need:
      // endY = -(playAreaH - size)
      const startY = 0;
      const endY = -(playAreaH - size);

      const animY = new Animated.Value(startY);

      const b: FloatBubble = { id, x, size, fill: c.fill, border: c.border, animY };

      Animated.timing(animY, {
        toValue: endY,
        duration: bubbleDurationMs,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          // DO NOT "pop" — just disappear when reaching the top
          setFloatBubbles((cur) => cur.filter((bb) => bb.id !== id));
        }
      });

      return [...prev, b];
    });
  }, [W, bubbleDurationMs, gameRunning, maxBubbles, playAreaH]);

  const popBubble = (id: string) => {
    setFloatBubbles((prev) => prev.filter((b) => b.id !== id));
    setBubbleScore((s) => {
      const next = s + 5;
      setLevel(computeLevelFromScore(next));
      return next;
    });
  };

  useFocusEffect(
    useCallback(() => {
      if (mode !== "bubble" || !gameRunning) return;

      const t = setInterval(() => {
        spawnFloatBubble();
      }, spawnIntervalMs);

      return () => clearInterval(t);
    }, [mode, gameRunning, spawnIntervalMs, spawnFloatBubble])
  );

  /* ================================================================== UI ================================================================== */

  // ---------------- HOME ----------------
  if (mode === "home") {
    return (
      <LinearGradient colors={bgColors} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          {/* Header */}
          <View style={[styles.homeHeader, { paddingTop: insets.top + 16 }]}>
            <TouchableOpacity
              onPress={() => (router.canGoBack() ? router.back() : router.push("/(tabs)/home"))}
              style={[styles.iconButton, { backgroundColor: cardBg }]}
            >
              <Ionicons name="chevron-back" size={22} color={textPrimary} />
            </TouchableOpacity>
            <View style={{ alignItems: "center" }}>
              <Text style={[styles.homeTitle, { color: textPrimary }]}>Calm Space</Text>
              <Text style={[styles.homeSub, { color: textSecondary }]}>Tools to ease stress & anxiety</Text>
            </View>
            <View style={styles.iconButtonGhost} />
          </View>

          {/* Cards */}
          <View style={styles.homeBody}>
            <TouchableOpacity
              style={[styles.bigCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
              activeOpacity={0.9}
              onPress={() => setShowBreathChoice(true)}
            >
              <View style={styles.cardRow}>
                <View style={[styles.cardIcon, { backgroundColor: darkMode ? "#0f172a" : "#EEF2FF" }]}>
                  <Ionicons name="leaf-outline" size={30} color="#6366f1" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: textPrimary }]}>Breathing Exercise</Text>
                  <Text style={[styles.cardSub, { color: textSecondary }]}>Follow the rhythm to breathe deeply and relax</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={textSecondary} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bigCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
              activeOpacity={0.9}
              onPress={startBubbleGame}
            >
              <View style={styles.cardRow}>
                <View style={[styles.cardIcon, { backgroundColor: darkMode ? "#0f172a" : "#ECFDF5" }]}>
                  <Ionicons name="apps-outline" size={30} color="#0F766E" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: textPrimary }]}>Bubble Pop</Text>
                  <Text style={[styles.cardSub, { color: textSecondary }]}>Tap bubbles to pop them and level up</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={textSecondary} />
              </View>
            </TouchableOpacity>

            {/* Benefits section */}
            <View style={[styles.benefitsCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Text style={[styles.benefitsSectionTitle, { color: textSecondary }]}>WHY THESE HELP</Text>

              <View style={styles.benefitRow}>
                <View style={[styles.benefitIconWrap, { backgroundColor: darkMode ? "#0f172a" : "#EEF2FF" }]}>
                  <Ionicons name="heart-outline" size={18} color="#6366f1" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.benefitLabel, { color: textPrimary }]}>Reduces anxiety</Text>
                  <Text style={[styles.benefitDesc, { color: textSecondary }]}>Activates the body's natural calming response</Text>
                </View>
              </View>

              <View style={[styles.benefitDivider, { backgroundColor: cardBorder }]} />

              <View style={styles.benefitRow}>
                <View style={[styles.benefitIconWrap, { backgroundColor: darkMode ? "#0f172a" : "#ECFDF5" }]}>
                  <Ionicons name="flash-outline" size={18} color="#0F766E" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.benefitLabel, { color: textPrimary }]}>Sharpens focus</Text>
                  <Text style={[styles.benefitDesc, { color: textSecondary }]}>More oxygen to the brain improves concentration</Text>
                </View>
              </View>

              <View style={[styles.benefitDivider, { backgroundColor: cardBorder }]} />

              <View style={styles.benefitRow}>
                <View style={[styles.benefitIconWrap, { backgroundColor: darkMode ? "#0f172a" : "#FFF7ED" }]}>
                  <Ionicons name="moon-outline" size={18} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.benefitLabel, { color: textPrimary }]}>Better sleep</Text>
                  <Text style={[styles.benefitDesc, { color: textSecondary }]}>Calms the mind before bed for deeper rest</Text>
                </View>
              </View>
            </View>

            {/* Tip card */}
            <View style={[styles.tipCard, { backgroundColor: darkMode ? "#1e293b" : "#EEF2FF", borderColor: darkMode ? "#4338ca" : "#c7d2fe" }]}>
              <Ionicons name="bulb-outline" size={15} color="#6366f1" />
              <Text style={[styles.tipText, { color: darkMode ? "#a5b4fc" : "#4338ca" }]}>
                Even 5 minutes of breathing lowers cortisol — your body's stress hormone
              </Text>
            </View>
          </View>

          {/* Breathing choice modal */}
          <Modal visible={showBreathChoice} transparent animationType="fade" onRequestClose={() => setShowBreathChoice(false)}>
            <View style={styles.modalOverlay}>
              <View style={[styles.sheet, { backgroundColor: cardBg }]}>
                <View style={styles.sheetHeader}>
                  <Text style={[styles.sheetTitle, { color: textPrimary }]}>Choose Breathing Type</Text>
                  <TouchableOpacity
                    onPress={() => setShowBreathChoice(false)}
                    style={[styles.sheetClose, { backgroundColor: darkMode ? "#0B1220" : "#F1F5F9" }]}
                  >
                    <Ionicons name="close" size={20} color={textSecondary} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={() => startBreathing("calming")}
                  style={[styles.choiceCard, { backgroundColor: darkMode ? "#0f172a" : "#F8FAFC", borderColor: "#6366f1" }]}
                  activeOpacity={0.9}
                >
                  <View style={styles.choiceCardRow}>
                    <View style={[styles.choiceIcon, { backgroundColor: darkMode ? "#1e293b" : "#EEF2FF" }]}>
                      <Ionicons name="leaf-outline" size={22} color="#6366f1" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.choiceTitle, { color: textPrimary }]}>Calming Breathing</Text>
                      <Text style={[styles.choiceSub, { color: textSecondary }]}>4–2–6 · longer exhale for deep relaxation</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => startBreathing("box")}
                  style={[styles.choiceCard, { backgroundColor: darkMode ? "#0f172a" : "#F8FAFC", borderColor: cardBorder }]}
                  activeOpacity={0.9}
                >
                  <View style={styles.choiceCardRow}>
                    <View style={[styles.choiceIcon, { backgroundColor: darkMode ? "#1e293b" : "#EEF2FF" }]}>
                      <Ionicons name="square-outline" size={22} color="#6366f1" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.choiceTitle, { color: textPrimary }]}>Box Breathing</Text>
                      <Text style={[styles.choiceSub, { color: textSecondary }]}>4–4–4–4 · steady rhythm for focus</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ---------------- BREATHING ----------------
  if (mode === "breathing") {
    const timerText = formatMMSS(sessionSecondsLeft);

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
        <LinearGradient
          colors={["#FAD1C6", "#F49B8C", "#F06A5E"]}
          style={styles.breathBg}
          start={{ x: 0.2, y: 0.1 }}
          end={{ x: 0.9, y: 0.9 }}
        >
          <View pointerEvents="none" style={[styles.blob, { top: 40, left: 30 }]} />
          <View
            pointerEvents="none"
            style={[
              styles.blob,
              { top: 130, right: -40, width: 220, height: 220, borderRadius: 110, opacity: 0.14 },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.blob,
              { bottom: 160, left: -60, width: 260, height: 260, borderRadius: 130, opacity: 0.12 },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.blob,
              { bottom: 60, right: 30, width: 180, height: 180, borderRadius: 90, opacity: 0.1 },
            ]}
          />

          <TouchableOpacity onPress={goHome} style={styles.roundBtnTopLeft} activeOpacity={0.9}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={styles.timerPill}>
            <Text style={styles.timerText}>{timerText}</Text>
          </View>

          <View style={styles.centerWrap}>
            {breathKind === "box" ? (
              <BoxBreathingSquare label={breathLabel} />
            ) : (
              <Animated.View style={[styles.ringOuter, { transform: [{ scale: ringScale }] }]}>
                <View style={styles.ringInner} />
                <View style={styles.ringCore}>
                  <Text style={styles.phaseText}>{breathLabel}</Text>
                </View>
              </Animated.View>
            )}

            <TouchableOpacity onPress={restartBreathing} style={styles.restartUnder} activeOpacity={0.9}>
              <Ionicons name="refresh-outline" size={18} color="#111" />
              <Text style={styles.restartUnderText}>Restart</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomLeftOnly}>
            <TouchableOpacity onPress={toggleMusic} style={styles.roundBtnBottom} activeOpacity={0.9} disabled={!musicReady}>
              <Ionicons name={isMusicOn ? "musical-notes" : "musical-note-outline"} size={22} color="#111" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // ---------------- BUBBLE POP ----------------
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <View style={[styles.bubbleHeader, { backgroundColor: cardBg, borderBottomColor: cardBorder }]}>
        <TouchableOpacity
          onPress={async () => {
            await saveLog({
              id: uid(),
              createdAt: new Date().toISOString(),
              game: "bubble",
              bubbleScore,
              level,
              detail: "bubble pop exited",
            });
            stopBubbleGame();
            await goHome();
          }}
          style={styles.bubbleBack}
          activeOpacity={0.9}
        >
          <Ionicons name="chevron-back" size={22} color="#6366f1" />
          <Text style={[styles.bubbleBackText, { color: "#6366f1" }]}>Back</Text>
        </TouchableOpacity>

        <Text style={[styles.bubbleHeaderTitle, { color: textPrimary }]}>Bubble Pop</Text>

        <TouchableOpacity
          onPress={() => {
            stopBubbleGame();
            setBubbleScore(0);
            setLevel(1);
            setFloatBubbles([]);
            setGameRunning(true);
          }}
          style={styles.bubbleReset}
          activeOpacity={0.9}
        >
          <Ionicons name="refresh-outline" size={18} color="#6366f1" />
        </TouchableOpacity>
      </View>

      <View style={[styles.bubbleStats, { backgroundColor: bg }]}>
        <Text style={[styles.bubbleScoreText, { color: textPrimary }]}>Score: {bubbleScore}</Text>
        <Text style={[styles.bubbleSubText, { color: textSecondary }]}>Tap bubbles to pop them!</Text>
        <Text style={[styles.bubbleLevelText, { color: textPrimary }]}>Level {level}</Text>
      </View>

      <View
        style={[styles.bubblePlayArea, { backgroundColor: darkMode ? "#0f172a" : "#f2f2f7" }]}
        onLayout={(e) => setPlayAreaH(e.nativeEvent.layout.height)}
      >
        {floatBubbles.map((b) => (
          <Animated.View
            key={b.id}
            style={[
              styles.floatBubbleWrap,
              {
                width: b.size,
                height: b.size,
                left: b.x,
                transform: [{ translateY: b.animY }],
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.floatBubble,
                { backgroundColor: b.fill, borderColor: b.border, borderRadius: b.size / 2 },
              ]}
              activeOpacity={0.85}
              onPress={() => popBubble(b.id)}
            />
          </Animated.View>
        ))}
      </View>

      <View style={[styles.bubbleFooter, { backgroundColor: bg }]}>
        <TouchableOpacity
          style={styles.finishBtn}
          activeOpacity={0.9}
          onPress={async () => {
            await saveLog({
              id: uid(),
              createdAt: new Date().toISOString(),
              game: "bubble",
              bubbleScore,
              level,
              detail: "bubble pop finished",
            });
            await recordBubblePopPlay({ maxLevel: level });
            Alert.alert("Saved", `Score: ${bubbleScore} • Level: ${level}`);
            stopBubbleGame();
            await goHome();
          }}
        >
          <Text style={styles.finishBtnText}>Finish</Text>
          <Ionicons name="checkmark-outline" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */
const styles = StyleSheet.create({
  /* HOME */
  homeHeader: {
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
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  iconButtonGhost: { width: 44, height: 44 },
  homeTitle: { fontSize: 24, fontWeight: "900" },
  homeSub: { marginTop: 2, fontSize: 13, fontWeight: "600" },
  homeBody: { flex: 1, paddingHorizontal: 20, paddingTop: 8, gap: 16 },
  bigCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 18, fontWeight: "900", marginBottom: 4 },
  cardSub: { fontSize: 13, fontWeight: "600", lineHeight: 18 },

  /* BENEFITS + TIP */
  benefitsCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    gap: 14,
  },
  benefitsSectionTitle: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 2,
  },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  benefitIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitLabel: { fontSize: 14, fontWeight: "800", marginBottom: 2 },
  benefitDesc: { fontSize: 12, fontWeight: "600", lineHeight: 17 },
  benefitDivider: { height: 1, opacity: 0.5 },
  tipCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  tipText: { flex: 1, fontSize: 13, fontWeight: "700", lineHeight: 19 },

  /* MODAL SHEET */
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sheetTitle: { fontSize: 17, fontWeight: "900" },
  sheetClose: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceCard: { borderRadius: 16, padding: 16, borderWidth: 1.5 },
  choiceCardRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  choiceIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceTitle: { fontSize: 15, fontWeight: "900", marginBottom: 2 },
  choiceSub: { fontSize: 13, fontWeight: "600" },

  /* BREATHING SCREEN */
  breathBg: { flex: 1, backgroundColor: "#fff" },
  blob: {
    position: "absolute",
    backgroundColor: "#fff",
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.18,
  },
  roundBtnTopLeft: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 28,
    left: 18,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(0,0,0,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  timerPill: {
    position: "absolute",
    top: Platform.OS === "ios" ? 74 : 40,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(60, 33, 30, 0.45)",
  },
  timerText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  centerWrap: { flex: 1, alignItems: "center", justifyContent: "center" },

  ringOuter: {
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(160, 35, 25, 0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  ringInner: {
    position: "absolute",
    width: 248,
    height: 248,
    borderRadius: 124,
    borderWidth: 7,
    borderColor: "rgba(255,255,255,0.45)",
  },
  ringCore: {
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(145, 25, 18, 0.60)",
    alignItems: "center",
    justifyContent: "center",
  },
  phaseText: { color: "#fff", fontSize: 44, fontWeight: "900" },

  boxFrame: {
    borderWidth: 6,
    borderColor: "rgba(255,255,255,0.70)",
    borderRadius: 42,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  boxInner: {
    width: 210,
    height: 210,
    borderRadius: 34,
    backgroundColor: "rgba(145, 25, 18, 0.60)",
    justifyContent: "center",
    alignItems: "center",
  },
  boxLabel: { color: "#fff", fontSize: 40, fontWeight: "900" },

  restartUnder: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.75)",
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.10)",
  },
  restartUnderText: { fontSize: 13, fontWeight: "900", color: "#111" },

  bottomLeftOnly: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 40 : 26,
    left: 34,
  },
  roundBtnBottom: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(255,255,255,0.80)",
    alignItems: "center",
    justifyContent: "center",
  },

  /* BUBBLE POP */
  bubbleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 10 : 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  bubbleBack: { flexDirection: "row", alignItems: "center", gap: 6 },
  bubbleBackText: { color: "#2563eb", fontSize: 16, fontWeight: "700" },
  bubbleHeaderTitle: { fontSize: 18, fontWeight: "900", color: "#111" },
  bubbleReset: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  bubbleStats: {
    paddingTop: 18,
    paddingBottom: 16,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  bubbleScoreText: { fontSize: 34, fontWeight: "900", color: "#111" },
  bubbleSubText: { marginTop: 8, fontSize: 16, fontWeight: "600", color: "#6b7280" },
  bubbleLevelText: { marginTop: 10, fontSize: 14, fontWeight: "800", color: "#111", opacity: 0.7 },

  bubblePlayArea: { flex: 1, backgroundColor: "#f2f2f7", overflow: "hidden" },
  floatBubbleWrap: { position: "absolute", bottom: 0 },
  floatBubble: { flex: 1, borderWidth: 3 },

  bubbleFooter: { paddingHorizontal: 20, paddingVertical: 14, backgroundColor: "#fff" },
  finishBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6366f1",
    flexDirection: "row",
    gap: 8,
  },
  finishBtnText: { color: "#fff", fontWeight: "900" },
});


