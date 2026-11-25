/**
 * Content sync: starts with the bundled copy of @zainlabs/content (works offline, first launch),
 * then loads the last cached copy, then fetches the latest from the website API.
 * Adding a project in content/src/projects.ts updates the website immediately and the app on next sync.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { contentBundle, type ContentBundle, type Project, type StreamSlug } from "@zainlabs/content";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
const CACHE_KEY = "zainlabs.content.v1";

type Source = "bundled" | "cache" | "live";
interface ContentState {
  content: ContentBundle;
  source: Source;
  syncing: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<ContentState | null>(null);

function isBundle(x: unknown): x is ContentBundle {
  const b = x as ContentBundle;
  return !!b && b.version === 1 && Array.isArray(b.streams) && Array.isArray(b.projects);
}

export function ContentProvider({ children }: { children: React.ReactNode }) {
  const [content, setContent] = useState<ContentBundle>(contentBundle());
  const [source, setSource] = useState<Source>("bundled");
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    setSyncing(true);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${API_URL}/api/content`, { signal: controller.signal });
      clearTimeout(timer);
      const data = await res.json();
      if (res.ok && isBundle(data)) {
        setContent(data);
        setSource("live");
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
      }
    } catch {
      // offline or API unreachable: keep cached / bundled content
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const cached = await AsyncStorage.getItem(CACHE_KEY).catch(() => null);
      if (cached) {
        try {
          const data = JSON.parse(cached);
          if (isBundle(data)) {
            setContent(data);
            setSource("cache");
          }
        } catch {}
      }
      await refresh();
    })();
  }, [refresh]);

  const value = useMemo(() => ({ content, source, syncing, refresh }), [content, source, syncing, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useContent() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useContent outside ContentProvider");
  const { content } = ctx;
  return {
    ...ctx,
    site: content.site,
    streams: content.streams,
    projects: content.projects,
    stream: (slug: string) => content.streams.find((s) => s.slug === slug),
    project: (slug: string) => content.projects.find((p) => p.slug === slug),
    projectsIn: (slug: StreamSlug): Project[] => content.projects.filter((p) => p.stream === slug),
  };
}

export async function sendContact(payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, source: "app" }),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, error: data.error ?? `HTTP ${res.status}` };
  } catch {
    return { ok: false, error: "No connection. Please try again when you are online." };
  }
}
