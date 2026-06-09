import React, { useEffect } from "react"; // Εισαγωγή της βιβλιοθήκης React
import { Stack } from "expo-router"; // Εισαγωγή του Stack navigator από το expo-router
import { StatusBar } from "expo-status-bar"; // Εισαγωγή του component για τη status bar
import { ThemeProvider, useTheme } from "../context/ThemeContext"; // Εισαγωγή του ThemeProvider και του hook useTheme από το context
import { AuthProvider } from "../context/AuthContext";
import { addNotificationResponseListener } from "../services/notification-service";
import { useRouter } from "expo-router";

function AppStack() {
  const { darkMode } = useTheme(); // Παίρνουμε την τιμή darkMode από το ThemeContext
  const router = useRouter();

  useEffect(() => {
    const subscription = addNotificationResponseListener((response) => {
      const screen = response.notification.request.content.data?.screen;
      if (screen === "pomodoro") router.push("/(tabs)/pomodoro");
      else if (screen === "calendar" || screen === "exams") router.push("/(tabs)/calendar");
      else if (screen === "games") router.push("/games");
      else router.push("/(tabs)/home");
    });
    return () => subscription.remove();
  }, [router]);

  return (
    <>
      {/* Ρύθμιση του στυλ της status bar ανάλογα με το dark mode */}
      <StatusBar style={darkMode ? "light" : "dark"} />

      {/* Ορισμός του Stack navigator */}
      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
        
        {/* Οθόνη αρχικής σελίδας */}
        <Stack.Screen name="index" />

        {/* Οθόνες tabs (nested navigation) */}
        <Stack.Screen name="(tabs)" />

        {/* Οθόνη για προσθήκη exam */}
        <Stack.Screen name="exams/add" />

        {/* Οθόνη games */}
        <Stack.Screen name="games/index" />

        {/* Οθόνη profile */}
        <Stack.Screen name="profile/index" />

        <Stack.Screen name="auth/login" />
        <Stack.Screen name="analytics/index" />
        <Stack.Screen name="settings/notifications" />
      </Stack>
    </>
  );
}

// Root component της εφαρμογής
export default function RootLayout() {
  return (
    // Provider που δίνει theme (dark/light mode) σε όλη την εφαρμογή
    <ThemeProvider>
      <AuthProvider>
        {/* Το βασικό navigation stack */}
        <AppStack />
      </AuthProvider>
    </ThemeProvider>
  );
}


