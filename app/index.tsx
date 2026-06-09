import React, { useEffect, useRef, useState } from "react";
// React = η βασική βιβλιοθήκη
// useEffect = για ενέργειες που τρέχουν όταν φορτώνει το component
// useRef = για να κρατάω τιμές σταθερές ανάμεσα στα renders
// useState = για state, δηλαδή μεταβαλλόμενα δεδομένα του component

import {
  View, // βασικό container, σαν "κουτί"
  Text, // για εμφάνιση κειμένου
  StyleSheet, // για ορισμό styles
  Animated, // για animations στο React Native
  Pressable, // για clickable / πατήσιμο στοιχείο
  Platform, // για έλεγχο αν είμαστε σε iOS ή Android
  StatusBar, // για τη system bar πάνω στο κινητό
  Dimensions, // για να πάρω πλάτος/ύψος οθόνης
} from "react-native";

import { LinearGradient } from "expo-linear-gradient";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import * as Haptics from "expo-haptics";

const canUseHaptics = Platform.OS !== "web";

function impact(style: Haptics.ImpactFeedbackStyle) {
  if (canUseHaptics) {
    Haptics.impactAsync(style);
  }
}

function notify(type: Haptics.NotificationFeedbackType) {
  if (canUseHaptics) {
    Haptics.notificationAsync(type);
  }
}

const { width, height } = Dimensions.get("window");
// Παίρνω το πλάτος και το ύψος της οθόνης της συσκευής
// Εδώ χρησιμοποιώ το width πιο κάτω για responsive πλάτος του κουμπιού

export default function BreathingHome() {
  // Αυτό είναι το βασικό component της αρχικής οθόνης

  const router = useRouter();
  // Παίρνω πρόσβαση στον router για να μπορώ να αλλάξω οθόνη

  // =========================
  // Χρονισμοί αναπνοής
  // =========================
  const INHALE = 4000;
  const HOLD = 1500;
  const EXHALE = 4000;
  const HOLD2 = 1500;


  const scaleVal = useRef(new Animated.Value(0)).current;
  // Animated τιμή για το scale της κεντρικής bubble
  // Ξεκινά από 0 και μέσω interpolation θα μετατραπεί σε πραγματικό scale

  const ringVal = useRef(new Animated.Value(0)).current;
  // Animated τιμή για το πρώτο εξωτερικό ring

  const ringVal2 = useRef(new Animated.Value(0)).current;
  // Animated τιμή για το δεύτερο εξωτερικό ring

  const [phase, setPhase] = useState<"Inhale" | "Hold" | "Exhale">("Inhale");
  // State για να κρατάω ποια φάση αναπνοής δείχνω στον χρήστη
  // Επιτρέπονται μόνο οι τιμές: "Inhale", "Hold", "Exhale"

  // =========================
  // Animated value για το background
  // =========================
  const floatingAnim = useRef(new Animated.Value(0)).current;
  // Τιμή που χρησιμοποιώ για αργή κίνηση των διακοσμητικών κύκλων στο background

  // =========================
  // Taglines
  // =========================
  const taglines = [
    "Turn exam stress into exam success",
    "Focus. Breathe. Achieve.",
    "From panic to plan-it",
  ];
  // Πίνακας με εναλλασσόμενα motivational μηνύματα

  const [taglineIndex, setTaglineIndex] = useState(0);
  // Κρατάω ποιο tagline εμφανίζεται αυτή τη στιγμή

  const taglineOpacity = useRef(new Animated.Value(1)).current;
  // Animated τιμή για το fade in / fade out του tagline

  // =========================================================
  // 1ο useEffect: Breathing loop με haptics
  // =========================================================
  useEffect(() => {
    // Αυτό το effect τρέχει μία φορά όταν φορτώσει η οθόνη

    let stop = false;
    // Flag για να σταματήσει ο βρόχος όταν το component γίνει unmount

    const loop = () => {
      // Η συνάρτηση που επαναλαμβάνει συνέχεια τον κύκλο αναπνοής

      if (stop) return;
      // Αν έχει δοθεί εντολή stop, σταματάω

      setPhase("Inhale");
      // Θέτω τη φάση σε εισπνοή

      impact(Haptics.ImpactFeedbackStyle.Medium);
      // Κάνω μέτρια δόνηση όταν ξεκινά η εισπνοή

      Animated.parallel([
        // Τρέχω 2 animations ταυτόχρονα στην εισπνοή:
        Animated.timing(scaleVal, {
          toValue: 1,
          duration: INHALE,
          useNativeDriver: true,
        }),
        // Η bubble "μεγαλώνει" κατά τη διάρκεια της εισπνοής

        Animated.timing(ringVal, {
          toValue: 1,
          duration: INHALE,
          useNativeDriver: true,
        }),
        // Το πρώτο ring ενεργοποιείται / μεγαλώνει με την εισπνοή
      ]).start(() => {
        // Όταν τελειώσουν τα δύο παραπάνω animations...

        if (stop) return;
        // Αν έχει δοθεί stop, σταματάω

        setPhase("Hold");
        // Η φάση γίνεται κράτημα

        notify(Haptics.NotificationFeedbackType.Success);
        // Κάνω δόνηση και στο hold για feedback

        Animated.timing(ringVal, {
          toValue: 0,
          duration: HOLD,
          useNativeDriver: true,
        }).start(() => {
          // Κατά το hold, "σβήνω" το πρώτο ring

          if (stop) return;
          // Αν έχει δοθεί stop, σταματάω

          setPhase("Exhale");
          // Μετά αλλάζω τη φάση σε εκπνοή

          Animated.parallel([
            Animated.timing(scaleVal, {
              toValue: 0,
              duration: EXHALE,
              useNativeDriver: true,
            }),
            // Στην εκπνοή η bubble "μικραίνει"

            Animated.timing(ringVal2, {
              toValue: 1,
              duration: EXHALE,
              useNativeDriver: true,
            }),
            // Παράλληλα ενεργοποιείται το δεύτερο ring
          ]).start(() => {
            // Όταν τελειώσει η εκπνοή...

            if (stop) return;
            // Αν έχει δοθεί stop, σταματάω

            setPhase("Hold");
            // Ξαναμπαίνω σε hold

            Animated.timing(ringVal2, {
              toValue: 0,
              duration: HOLD2,
              useNativeDriver: true,
            }).start(loop);
            // Σβήνω το δεύτερο ring και ξανακαλώ τη loop()
            // Άρα ο κύκλος αναπνοής συνεχίζεται ασταμάτητα
          });
        });
      });
    };

    loop();
    // Ξεκινάω αμέσως το breathing loop

    return () => {
      stop = true;
    };
    // Cleanup: όταν φύγω από την οθόνη, το stop γίνεται true
    // και έτσι σταματά ο βρόχος αναπνοής
  }, []);
  // [] => τρέχει μόνο μία φορά όταν φορτώσει η οθόνη

  // =========================================================
  // 2ο useEffect: Tagline switcher + floating background
  // =========================================================
  useEffect(() => {
    // Αυτό το effect επίσης τρέχει μία φορά όταν φορτώσει η οθόνη

    const interval = setInterval(() => {
      // Κάθε 4.5 δευτερόλεπτα αλλάζω το tagline

      Animated.sequence([
        Animated.timing(taglineOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        // Fade out του παλιού tagline

        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        // Fade in του νέου tagline
      ]).start();

      setTaglineIndex((prev) => (prev + 1) % taglines.length);
      // Πάω στο επόμενο tagline κυκλικά
      // Όταν φτάσω στο τέλος, ξαναπάω στο πρώτο
    }, 4500);

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatingAnim, {
          toValue: 1,
          duration: 10000,
          useNativeDriver: true,
        }),
        // Κίνηση background από 0 -> 1

        Animated.timing(floatingAnim, {
          toValue: 0,
          duration: 10000,
          useNativeDriver: true,
        }),
        // Και μετά από 1 -> 0
      ])
    ).start();
    // Ξεκινάω loop για αργή, συνεχόμενη κίνηση των background κύκλων

    return () => clearInterval(interval);
    // Cleanup: σταματάω το interval όταν φύγω από την οθόνη
  }, []);
  // [] => τρέχει μόνο μία φορά

  // =========================================================
  // Interpolations
  // =========================================================
  const bubbleScale = scaleVal.interpolate({
    inputRange: [0, 1],
    outputRange: [1.0, 1.25],
  });
  // Όταν η scaleVal πάει από 0 -> 1,
  // το πραγματικό scale της bubble πάει από 1.0 -> 1.25

  const ringScale = ringVal.interpolate({
    inputRange: [0, 1],
    outputRange: [1.0, 1.6],
  });
  // Το πρώτο ring μεγαλώνει από 1.0 -> 1.6

  const ringOpacity = ringVal.interpolate({
    inputRange: [0, 1],
    outputRange: [0.0, 0.4],
  });
  // Το πρώτο ring γίνεται πιο ορατό όσο αυξάνεται το ringVal

  const ringScale2 = ringVal2.interpolate({
    inputRange: [0, 1],
    outputRange: [1.0, 1.8],
  });
  // Το δεύτερο ring μεγαλώνει από 1.0 -> 1.8

  const ringOpacity2 = ringVal2.interpolate({
    inputRange: [0, 1],
    outputRange: [0.0, 0.3],
  });
  // Το δεύτερο ring αποκτά opacity καθώς ενεργοποιείται

  const bgMove = floatingAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 30],
  });
  // Η floatingAnim μετατρέπεται σε μετακίνηση 0 -> 30 pixels
  // για τους διακοσμητικούς κύκλους background

  return (
    <View style={styles.root}>
      {/* Βασικό root container της οθόνης */}

      <StatusBar barStyle="dark-content" />
      {/* Η status bar έχει σκούρα στοιχεία επειδή το background είναι ανοιχτό */}

      <LinearGradient
        colors={["#F8FAFC", "#EEF2FF"]}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Gradient background που γεμίζει όλη την οθόνη */}

      {/* Floating Decor Circles */}
      <Animated.View
        style={[
          styles.decorCircle,
          {
            transform: [
              { translateY: bgMove },
              { translateX: bgMove },
            ],
          },
        ]}
      />
      {/* Πάνω δεξιά διακοσμητικός κύκλος που κινείται αργά */}

      <Animated.View
        style={[
          styles.decorCircleBottom,
          {
            transform: [
              { translateY: Animated.multiply(bgMove, -1) },
            ],
          },
        ]}
      />
      {/* Κάτω αριστερά διακοσμητικός κύκλος που κινείται αντίθετα */}

      <View style={styles.heroText}>
        {/* Επάνω περιοχή με badge, τίτλο και tagline */}

        <View style={styles.logoBadge}>
          {/* Μικρό badge "WELLNESS" */}

          <Ionicons name="leaf" size={16} color="#6366f1" />
          {/* Εικονίδιο φύλλου */}

          <Text style={styles.logoBadgeText}>WELLNESS</Text>
          {/* Κείμενο του badge */}
        </View>

        <Text style={styles.title}>Unstressify</Text>
        {/* Ο κύριος τίτλος της εφαρμογής */}

        <Animated.Text
          style={[
            styles.tagline,
            { opacity: taglineOpacity },
          ]}
        >
          {taglines[taglineIndex]}
        </Animated.Text>
        {/* Το κείμενο tagline αλλάζει με fade animation */}

        {/* Pagination Dots */}
        <View style={styles.pagination}>
          {/* Τα μικρά dots που δείχνουν ποιο tagline είναι ενεργό */}

          {taglines.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    i === taglineIndex ? "#6366f1" : "#CBD5E1",
                  // Αν είναι το ενεργό dot, γίνεται μωβ
                  // αλλιώς γκρι

                  width: i === taglineIndex ? 16 : 6,
                  // Το ενεργό dot είναι πιο φαρδύ
                },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.center}>
        {/* Η κεντρική περιοχή της οθόνης */}

        {/* Breathing Rings */}
        <Animated.View
          style={[
            styles.ring,
            {
              transform: [{ scale: ringScale }],
              opacity: ringOpacity,
            },
          ]}
        />
        {/* Πρώτο εξωτερικό ring με animation */}

        <Animated.View
          style={[
            styles.ring,
            {
              transform: [{ scale: ringScale2 }],
              opacity: ringOpacity2,
            },
          ]}
        />
        {/* Δεύτερο εξωτερικό ring με animation */}

        {/* The Bubble */}
        <Animated.View
          style={[
            styles.bubble,
            {
              transform: [{ scale: bubbleScale }],
            },
          ]}
        >
          {/* Η βασική κεντρική σφαίρα που μεγαλώνει/μικραίνει */}

          <LinearGradient
            colors={["#ffffff", "#F0F4FF"]}
            style={[
              StyleSheet.absoluteFillObject,
              { borderRadius: 100 },
            ]}
          />
          {/* Gradient μέσα στην bubble */}

          <Text style={styles.bubbleText}>
            {phase.toUpperCase()}
          </Text>
          {/* Δείχνω τη φάση αναπνοής με κεφαλαία:
              INHALE / HOLD / EXHALE */}
        </Animated.View>
      </View>

      <View style={styles.footer}>
        {/* Κάτω περιοχή με το κουμπί */}

        <Pressable
          onPress={() => {
            impact(Haptics.ImpactFeedbackStyle.Heavy);
            // Δόνηση όταν πατά ο χρήστης το κουμπί

            router.replace("/(tabs)/home");
            // Μετάβαση στην κύρια home οθόνη του app
            // replace = αντικατάσταση της τρέχουσας οθόνης
          }}
          style={({ pressed }) => [
            styles.btn,
            pressed && { transform: [{ scale: 0.98 }] },
          ]}
        >
          {/* Αν το κουμπί πατηθεί, μικραίνει ελαφρά */}

          <LinearGradient
            colors={["#6366f1", "#4f46e5"]}
            style={styles.btnBg}
          />
          {/* Gradient background του κουμπιού */}

          <Text style={styles.btnText}>Get Started</Text>
          {/* Κείμενο κουμπιού */}

          <Ionicons
            name="arrow-forward"
            size={20}
            color="#fff"
            style={{ marginLeft: 10 }}
          />
          {/* Βελάκι προς τα δεξιά */}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
  },
  // Το root πιάνει όλο το διαθέσιμο ύψος
  // και κεντράρει τα παιδιά οριζόντια

  decorCircle: {
    position: "absolute",
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(99, 102, 241, 0.05)",
  },
  // Διακοσμητικός κύκλος πάνω δεξιά

  decorCircleBottom: {
    position: "absolute",
    bottom: 50,
    left: -60,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "rgba(99, 102, 241, 0.03)",
  },
  // Διακοσμητικός κύκλος κάτω αριστερά

  heroText: {
    marginTop: 90,
    alignItems: "center",
    paddingHorizontal: 40,
  },
  // Περιοχή με badge, τίτλο και tagline

  logoBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#E0E7FF",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 5,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  // Badge WELLNESS με icon + text

  logoBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#6366f1",
    marginLeft: 6,
    letterSpacing: 1.2,
  },
  // Στυλ για το κείμενο WELLNESS

  title: {
    fontSize: 44,
    fontWeight: "900",
    color: "#0F172A",
    textAlign: "center",
    letterSpacing: -1,
  },
  // Μεγάλος τίτλος εφαρμογής

  tagline: {
    marginTop: 15,
    fontSize: 17,
    fontWeight: "500",
    color: "#64748B",
    textAlign: "center",
    lineHeight: 24,
    height: 50,
  },
  // Στυλ για το εναλλασσόμενο motivational μήνυμα

  pagination: {
    flexDirection: "row",
    marginTop: 10,
    alignItems: "center",
    gap: 6,
  },
  // Container για τα dots

  dot: {
    height: 6,
    borderRadius: 3,
  },
  // Βασικό στυλ των dots

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // Κεντρική περιοχή της οθόνης όπου είναι η bubble

  ring: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: "rgba(99, 102, 241, 0.3)",
  },
  // Βασικό στυλ των εξωτερικών rings

  bubble: {
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    ...Platform.select({
      ios: {
        shadowColor: "#6366f1",
        shadowOpacity: 0.12,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: 15 },
      },
      android: {
        elevation: 10,
      },
    }),
  },
  // Η βασική λευκή κυκλική bubble στο κέντρο

  bubbleText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#6366f1",
    letterSpacing: 2,
  },
  // Κείμενο μέσα στην bubble

  footer: {
    width: "100%",
    alignItems: "center",
    marginBottom: 70,
  },
  // Κάτω περιοχή για το κουμπί

  btn: {
    flexDirection: "row",
    width: width * 0.82,
    height: 66,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#6366f1",
        shadowOpacity: 0.3,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: {
        elevation: 6,
      },
    }),
  },
  // Κύριο style του κουμπιού Get Started

  btnBg: {
    ...StyleSheet.absoluteFillObject,
  },
  // Το gradient background καλύπτει όλο το κουμπί

  btnText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
  },
  // Κείμενο κουμπιού
});



