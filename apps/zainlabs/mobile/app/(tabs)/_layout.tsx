import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "@/theme";

const glyph: Record<string, string> = { index: "◉", projects: "▦", studio: "▶", contact: "✉" };

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.ink, borderTopWidth: 0, height: 64, paddingTop: 6 },
        tabBarActiveTintColor: colors.paper,
        tabBarInactiveTintColor: colors.mutedOnDark,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 16 }}>{glyph[route.name] ?? "•"}</Text>,
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="projects" options={{ title: "Projects" }} />
      <Tabs.Screen name="studio" options={{ title: "Studio" }} />
      <Tabs.Screen name="contact" options={{ title: "Contact" }} />
    </Tabs>
  );
}
