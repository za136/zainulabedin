import type { StorePublic } from '@factory/sdk';
import { API_URL } from './api';

/** Locale-independent store fetch for metadata routes (manifest, icons). Never throws. */
export async function fetchStorePublic(): Promise<StorePublic | null> {
  try {
    const res = await fetch(`${API_URL}/v1/store`, { next: { revalidate: 300 } });
    return res.ok ? ((await res.json()) as StorePublic) : null;
  } catch {
    return null;
  }
}
