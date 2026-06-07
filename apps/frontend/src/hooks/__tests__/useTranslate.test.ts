import { act, renderHook } from '@testing-library/react';
import { useTranslate } from '../useTranslate';
import { apiClient } from '@/lib/api/client';

jest.mock('@/lib/api/client', () => ({
  apiClient: { post: jest.fn() },
}));

const mockPost = apiClient.post as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

describe('useTranslate', () => {
  it('returns the input unchanged for empty/whitespace text without calling the API', async () => {
    const { result } = renderHook(() => useTranslate());

    let out: string | undefined;
    await act(async () => { out = await result.current.translate('   '); });

    expect(out).toBe('   ');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('translates via the API and caches the result (second call hits no API)', async () => {
    mockPost.mockResolvedValueOnce({ data: { translatedText: '번역됨' } });
    const { result } = renderHook(() => useTranslate());

    let first: string | undefined;
    await act(async () => { first = await result.current.translate('unique-phrase-1', 'ko'); });
    expect(first).toBe('번역됨');
    expect(mockPost).toHaveBeenCalledWith('/translate', { text: 'unique-phrase-1', targetLang: 'ko' });

    // second call for the same key should be served from cache
    let second: string | undefined;
    await act(async () => { second = await result.current.translate('unique-phrase-1', 'ko'); });
    expect(second).toBe('번역됨');
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('falls back to the original text when the API fails', async () => {
    mockPost.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useTranslate());

    let out: string | undefined;
    await act(async () => { out = await result.current.translate('unique-phrase-2', 'ja'); });

    expect(out).toBe('unique-phrase-2');
  });
});
