'use client';
import { useCallback, useRef, useState } from 'react';
import { apiClient } from '@/lib/api/client';

const LS_KEY = 'secureai:translate:cache';
const MAX_LS_ENTRIES = 500;

function loadCache(): Map<string, string> {
  if (typeof window === 'undefined') return new Map();
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return new Map();
    return new Map(JSON.parse(raw) as [string, string][]);
  } catch {
    return new Map();
  }
}

function persistCache(cache: Map<string, string>): void {
  try {
    // keep only the most-recently-added entries if the cache grows too large
    const entries = [...cache.entries()];
    const trimmed = entries.length > MAX_LS_ENTRIES
      ? entries.slice(entries.length - MAX_LS_ENTRIES)
      : entries;
    localStorage.setItem(LS_KEY, JSON.stringify(trimmed));
  } catch {
    // quota exceeded — silently ignore
  }
}

const cache = loadCache();

export function useTranslate() {
  const [translating, setTranslating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const translate = useCallback(async (text: string, targetLang = 'ko'): Promise<string> => {
    if (!text.trim()) return text;

    const cacheKey = `${targetLang}::${text}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey)!;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setTranslating(true);
    try {
      const res = await apiClient.post<{ data: { translatedText: string } }>(
        '/translate',
        { text, targetLang },
      );
      const translated = res.data.translatedText;
      cache.set(cacheKey, translated);
      persistCache(cache);
      return translated;
    } catch {
      return text;
    } finally {
      setTranslating(false);
    }
  }, []);

  return { translate, translating };
}
