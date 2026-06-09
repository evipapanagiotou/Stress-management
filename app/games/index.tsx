
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
  const { width: W } = Dimensions.get("window");

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
          await saveLog({
            id: uid(),
            createdAt: new Date().toISOString(),
            game: "breathing",
            breathKind,
            pattern: p.label,
            breathsCompleted,
            detail: "breathing session completed",
          });
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
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <LinearGradient
          colors={["#FAD1C6", "#F49B8C", "#F06A5E"]}
          style={styles.header}
          start={{ x: 0.2, y: 0.1 }}
          end={{ x: 0.9, y: 0.9 }}
        >
          <View pointerEvents="none" style={[styles.homeBlob, { top: 18, left: 18 }]} />
          <View
            pointerEvents="none"
            style={[
              styles.homeBlob,
              { top: 34, right: -30, width: 140, height: 140, borderRadius: 70, opacity: 0.14 },
            ]}
          />

          <View style={styles.headerContent}>
            <TouchableOpacity
              onPress={() => (router.canGoBack() ? router.back() : router.push("/home"))}
              style={styles.navBtn}
            >
              <Ionicons name="chevron-back" size={22} color="#111" />
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.title}>Your Calm Space</Text>
              <Text style={styles.subtitle}>Tools to ease stress and anxiety</Text>
            </View>

            <View style={{ width: 40 }} />
          </View>
        </LinearGradient>

        <View style={styles.homeBody}>
          <TouchableOpacity style={styles.bigCard} activeOpacity={0.9} onPress={() => setShowBreathChoice(true)}>
            <View style={styles.cardRow}>
              <View style={styles.cardIcon}>
                <Ionicons name="leaf-outline" size={34} color="#2563eb" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Breathing Exercise</Text>
                <Text style={styles.cardSub}>Follow the rhythm to breathe deeply and relax</Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.bigCard} activeOpacity={0.9} onPress={startBubbleGame}>
            <View style={styles.cardRow}>
              <View style={styles.cardIcon}>
                <Ionicons name="apps-outline" size={34} color="#7c3aed" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Bubble Pop</Text>
                <Text style={styles.cardSub}>Tap bubbles to pop them and level up</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Breathing choice modal */}
        <Modal visible={showBreathChoice} transparent animationType="fade" onRequestClose={() => setShowBreathChoice(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Breathing Exercise</Text>
                <TouchableOpacity onPress={() => setShowBreathChoice(false)} style={styles.sheetClose}>
                  <Ionicons name="close" size={20} color="#111" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => startBreathing("calming")}
                style={[styles.choiceCard, { backgroundColor: "rgba(255,255,255,0.75)", borderColor: "#F06A5E" }]}
                activeOpacity={0.9}
              >
                <Text style={styles.choiceTitle}>Calming Breathing</Text>
                <Text style={styles.choiceSub}>4–2–6 (longer exhale)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => startBreathing("box")}
                style={[styles.choiceCard, { backgroundColor: "rgba(255,255,255,0.65)", borderColor: "#F49B8C" }]}
                activeOpacity={0.9}
              >
                <Text style={styles.choiceTitle}>Box Breathing</Text>
                <Text style={styles.choiceSub}>4–4–4–4 (steady rhythm)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // ---------------- BREATHING ----------------
  if (mode === "breathing") {
    const timerText = formatMMSS(sessionSecondsLeft);

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={styles.bubbleHeader}>
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
          <Ionicons name="chevron-back" size={22} color="#2563eb" />
          <Text style={styles.bubbleBackText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.bubbleHeaderTitle}>Bubble Pop</Text>

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
          <Ionicons name="refresh-outline" size={18} color="#2563eb" />
        </TouchableOpacity>
      </View>

      <View style={styles.bubbleStats}>
        <Text style={styles.bubbleScoreText}>Score: {bubbleScore}</Text>
        <Text style={styles.bubbleSubText}>Tap bubbles to pop them!</Text>
        <Text style={styles.bubbleLevelText}>Level {level}</Text>
      </View>

      <View
        style={styles.bubblePlayArea}
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

      <View style={styles.bubbleFooter}>
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
  /* HOME HEADER */
  header: {
    paddingTop: 64,
    paddingBottom: 28,
    minHeight: 160,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: "hidden",
  },
  headerContent: {
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  headerCenter: { flex: 1, alignItems: "center", paddingHorizontal: 6 },
  navBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "rgba(255,255,255,0.75)",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#111",
    textAlign: "center",
    marginTop: 6,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "700",
    color: "#111",
    opacity: 0.7,
    textAlign: "center",
  },
  homeBlob: {
    position: "absolute",
    backgroundColor: "#fff",
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0.16,
  },

  homeBody: { flex: 1, paddingHorizontal: 20, paddingTop: 18, gap: 18 },
  bigCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eef2f7",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
    minHeight: 120,
    justifyContent: "center",
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 22, fontWeight: "900", color: "#111" },
  cardSub: { marginTop: 6, fontSize: 14, fontWeight: "700", color: "#6b7280", lineHeight: 18 },

  /* MODAL SHEET */
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#FAD1C6",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 16,
    gap: 12,
    maxHeight: "75%",
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { fontSize: 16, fontWeight: "900", color: "#3B0D0B" },
  sheetClose: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.75)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.10)",
  },
  choiceCard: { borderRadius: 18, padding: 14, borderWidth: 1, gap: 6 },
  choiceTitle: { fontSize: 15, fontWeight: "900", color: "#3B0D0B" },
  choiceSub: { fontSize: 13, fontWeight: "700", color: "#3B0D0B", opacity: 0.7 },

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
    backgroundColor: "#fff",
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
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111",
    flexDirection: "row",
    gap: 8,
  },
  finishBtnText: { color: "#fff", fontWeight: "900" },
});


