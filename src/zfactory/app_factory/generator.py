"""Mobile app factory: spec -> Expo (React Native, expo-router) app for iOS + Android.

Screen kinds:
  list     - tappable list of items (each item gets a detail page)
  form     - simple form (e.g. booking) that posts JSON to `submit_url` if set
  content  - static text page (about, aftercare instructions, policies)
"""
from __future__ import annotations

import json
from pathlib import Path

from ..core.files import slugify, write_files


def _js(value) -> str:
    return json.dumps(value, indent=2, ensure_ascii=False)


def _list_screen(screen: dict, key: str) -> str:
    return f"""import {{ Link }} from "expo-router";
import {{ FlatList, Pressable, Text, View }} from "react-native";
import {{ content }} from "../../data/content";
import {{ styles }} from "../../constants/theme";

export default function {key}Screen() {{
  const items = content["{key}"].items;
  return (
    <FlatList
      contentContainerStyle={{styles.container}}
      data={{items}}
      keyExtractor={{(item) => item.id}}
      renderItem={{({{ item }}) => (
        <Link href={{{{ pathname: "/item/[id]", params: {{ id: item.id, screen: "{key}" }} }}}} asChild>
          <Pressable style={{styles.card}}>
            <Text style={{styles.cardTitle}}>{{item.title}}</Text>
            {{item.subtitle ? <Text style={{styles.muted}}>{{item.subtitle}}</Text> : null}}
          </Pressable>
        </Link>
      )}}
      ListEmptyComponent={{<View><Text style={{styles.muted}}>Nothing here yet.</Text></View>}}
    />
  );
}}
"""


def _form_screen(screen: dict, key: str) -> str:
    return f"""import {{ useState }} from "react";
import {{ Alert, Pressable, ScrollView, Text, TextInput }} from "react-native";
import {{ content }} from "../../data/content";
import {{ styles }} from "../../constants/theme";

export default function {key}Screen() {{
  const {{ fields, submitUrl, submitLabel }} = content["{key}"];
  const [values, setValues] = useState<Record<string, string>>({{}});

  async function submit() {{
    const missing = fields.filter((f) => !values[f]);
    if (missing.length) return Alert.alert("Missing information", missing.join(", "));
    try {{
      if (submitUrl) {{
        const res = await fetch(submitUrl, {{
          method: "POST",
          headers: {{ "Content-Type": "application/json" }},
          body: JSON.stringify(values),
        }});
        if (!res.ok) throw new Error(`HTTP ${{res.status}}`);
      }}
      Alert.alert("Thank you", "We received your request and will be in touch.");
      setValues({{}});
    }} catch (e) {{
      Alert.alert("Could not send", String(e));
    }}
  }}

  return (
    <ScrollView contentContainerStyle={{styles.container}}>
      {{fields.map((f) => (
        <TextInput
          key={{f}}
          placeholder={{f}}
          value={{values[f] ?? ""}}
          onChangeText={{(t) => setValues((v) => ({{ ...v, [f]: t }}))}}
          style={{styles.input}}
        />
      ))}}
      <Pressable style={{styles.button}} onPress={{submit}}>
        <Text style={{styles.buttonText}}>{{submitLabel}}</Text>
      </Pressable>
    </ScrollView>
  );
}}
"""


def _content_screen(screen: dict, key: str) -> str:
    return f"""import {{ ScrollView, Text }} from "react-native";
import {{ content }} from "../../data/content";
import {{ styles }} from "../../constants/theme";

export default function {key}Screen() {{
  return (
    <ScrollView contentContainerStyle={{styles.container}}>
      <Text style={{styles.body}}>{{content["{key}"].body}}</Text>
    </ScrollView>
  );
}}
"""


RENDERERS = {"list": _list_screen, "form": _form_screen, "content": _content_screen}


def _key(name: str) -> str:
    return "".join(w.capitalize() for w in slugify(name).split("-"))


def generate(spec: dict, out_dir: Path) -> list[Path]:
    app = spec["app"]
    screens = spec.get("screen", [])
    if not screens:
        raise ValueError("App spec needs at least one [[screen]]")
    slug = slugify(app["name"])
    primary = app.get("primary", "#4f46e5")

    data: dict[str, dict] = {}
    files: dict[str, str] = {}
    tab_entries = []
    for i, s in enumerate(screens):
        kind = s.get("kind", "content")
        if kind not in RENDERERS:
            raise ValueError(f"Unknown screen kind {kind!r}; use one of {sorted(RENDERERS)}")
        key = _key(s["name"])
        route = "index" if i == 0 else slugify(s["name"])
        files[f"app/(tabs)/{route}.tsx"] = RENDERERS[kind](s, key)
        tab_entries.append(f'      <Tabs.Screen name="{route}" options={{{{ title: {_js(s["name"])} }}}} />')
        if kind == "list":
            data[key] = {"items": [{"id": slugify(it["title"]), **it} for it in s.get("items", [])]}
        elif kind == "form":
            data[key] = {"fields": s.get("fields", ["Name", "Email"]), "submitUrl": s.get("submit_url", ""),
                         "submitLabel": s.get("submit_label", "Submit")}
        else:
            data[key] = {"body": s.get("body", "")}

    files.update({
        "package.json": _js({
            "name": slug, "version": "0.1.0", "private": True, "main": "expo-router/entry",
            "scripts": {"start": "expo start", "android": "expo start --android",
                        "ios": "expo start --ios", "web": "expo start --web"},
            "dependencies": {"expo": "*", "expo-router": "*", "expo-status-bar": "*",
                             "expo-linking": "*", "expo-constants": "*", "react": "*", "react-native": "*",
                             "react-native-safe-area-context": "*", "react-native-screens": "*"},
            "devDependencies": {"typescript": "*", "@types/react": "*"},
        }),
        "app.json": _js({"expo": {
            "name": app["name"], "slug": slug, "scheme": slug, "version": "0.1.0",
            "orientation": "portrait", "userInterfaceStyle": "automatic",
            "ios": {"bundleIdentifier": app.get("bundle_id", f"com.example.{slug.replace('-', '')}")},
            "android": {"package": app.get("bundle_id", f"com.example.{slug.replace('-', '')}")},
            "plugins": ["expo-router"],
        }}),
        "tsconfig.json": _js({"extends": "expo/tsconfig.base", "compilerOptions": {"strict": True}}),
        "data/content.ts": f"export const content = {_js(data)} as const;\n",
        "constants/theme.ts": f"""import {{ StyleSheet }} from "react-native";

export const colors = {{ primary: "{primary}", text: "#1b1b1f", muted: "#6b6b75", card: "#f3f3f6" }};

export const styles = StyleSheet.create({{
  container: {{ padding: 16, gap: 12 }},
  card: {{ backgroundColor: colors.card, borderRadius: 14, padding: 16 }},
  cardTitle: {{ fontSize: 17, fontWeight: "600", color: colors.text }},
  muted: {{ color: colors.muted, marginTop: 4 }},
  body: {{ fontSize: 16, lineHeight: 24, color: colors.text }},
  input: {{ borderWidth: 1, borderColor: "#d8d8de", borderRadius: 10, padding: 12, fontSize: 16 }},
  button: {{ backgroundColor: colors.primary, borderRadius: 999, padding: 14, alignItems: "center" }},
  buttonText: {{ color: "#fff", fontWeight: "700", fontSize: 16 }},
}});
""",
        "app/_layout.tsx": """import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="item/[id]" options={{ title: "" }} />
    </Stack>
  );
}
""",
        "app/(tabs)/_layout.tsx": f"""import {{ Tabs }} from "expo-router";
import {{ colors }} from "../../constants/theme";

export default function TabLayout() {{
  return (
    <Tabs screenOptions={{{{ tabBarActiveTintColor: colors.primary }}}}>
{chr(10).join(tab_entries)}
    </Tabs>
  );
}}
""",
        "app/item/[id].tsx": """import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, Text } from "react-native";
import { content } from "../../data/content";
import { styles } from "../../constants/theme";

export default function ItemDetail() {
  const { id, screen } = useLocalSearchParams<{ id: string; screen: string }>();
  const section = (content as any)[screen]?.items ?? [];
  const item = section.find((i: any) => i.id === id);
  if (!item) return <Text style={styles.body}>Not found</Text>;
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: item.title }} />
      {item.subtitle ? <Text style={styles.muted}>{item.subtitle}</Text> : null}
      <Text style={styles.body}>{item.body ?? ""}</Text>
    </ScrollView>
  );
}
""",
        "README.md": f"""# {app['name']}

Generated by zfactory app-factory (Expo + expo-router, iOS/Android/web).

```bash
npm install
npx expo install --fix   # align package versions with the installed Expo SDK
npx expo start
```

Edit `data/content.ts` to change content. Build store binaries with EAS: `npx eas build`.
""",
    })
    return write_files(Path(out_dir), files)
