'use client';
import { useCallback, useRef, useState } from 'react';
import { apiClient } from '@/lib/api/client';

const cache = new Map<string, string>();

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
      return translated;
    } catch {
      return text;
    } finally {
      setTranslating(false);
    }
  }, []);

  return { translate, translating };
}
