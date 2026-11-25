import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ContentProvider } from "@/content";
import { colors } from "@/theme";

export default function RootLayout() {
  return (
    <ContentProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTintColor: colors.ink,
          headerStyle: { backgroundColor: colors.paper },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.paper },
          headerBackTitle: "Back",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="project/[slug]" options={{ title: "" }} />
        <Stack.Screen name="stream/[slug]" options={{ title: "" }} />
      </Stack>
    </ContentProvider>
  );
}
