import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";

function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { darkMode } = useTheme();

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.tabBarWrap,
        {
          paddingBottom: Math.max(insets.bottom, 12),
        },
      ]}
    >
      <View style={[styles.tabBarPill, darkMode && styles.tabBarPillDark]}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            });
          };

          const iconName =
            route.name === "home"
              ? ("home-outline" as const)
              : route.name === "calendar"
              ? ("calendar-outline" as const)
              : route.name === "pomodoro"
              ? ("timer-outline" as const)
              : route.name.includes("stats")
              ? ("stats-chart-outline" as const)
              : ("ellipse-outline" as const);

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              activeOpacity={0.9}
              style={styles.tabItem}
            >
              {isFocused ? (
                <LinearGradient
                  colors={["#6366f1", "#a855f7"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.activeCircle}
                >
                  <Ionicons name={iconName} size={22} color="#fff" />
                </LinearGradient>
              ) : (
                <Ionicons
                  name={iconName}
                  size={22}
                  color={darkMode ? "#CBD5E1" : "#9CA3AF"}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { darkMode } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        contentStyle: { backgroundColor: darkMode ? "#0B1220" : "#F8FAFC" },
      }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="calendar" />
      <Tabs.Screen name="pomodoro" />
      <Tabs.Screen name="stats/index" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
  },

  tabBarPill: {
    width: "86%",
    height: 64,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.95)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
      },
      android: {
        elevation: 10,
      },
    }),
  },

  tabBarPillDark: {
    backgroundColor: "rgba(17,24,39,0.95)",
    ...Platform.select({
      ios: {
        shadowOpacity: 0.0,
      },
      android: {
        elevation: 0,
      },
    }),
  },

  tabItem: {
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },

  activeCircle: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
});
