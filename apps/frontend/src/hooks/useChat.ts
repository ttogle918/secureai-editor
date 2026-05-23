'use client';

import { useState, useCallback, useRef } from 'react';
import { useSecureStore } from '@/store/useSecureStore';
import type { ChatMessage } from '@/lib/mockData';

// ─── 타입 정의 ────────────────────────────────────────────────

interface ChatHistoryItem {
  role: string;
  content: string;
}

interface UseChatReturn {
  streamingText: string;
  isStreaming: boolean;
  sendMessage: (text: string) => Promise<void>;
}

// ─── 상수 ─────────────────────────────────────────────────────

const CHAT_API_BASE = '/api/v1/analysis/sessions';
const MAX_HISTORY_ITEMS = 20; // 이력 10턴 제한

// ─── SSE 파서 유틸 ────────────────────────────────────────────

function parseSseLine(line: string): { event: string; data: string } | null {
  if (!line.startsWith('data: ')) return null;
  return { event: '', data: line.slice('data: '.length) };
}

// ─── 훅 구현 ─────────────────────────────────────────────────

export function useChat(): UseChatReturn {
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sseSessionId = useSecureStore((s) => s.sseSessionId);
  const chatMessages = useSecureStore((s) => s.chatMessages);
  const addChatMessage = useSecureStore((s) => s.addChatMessage);

  const sendMessage = useCallback(
    async (text: string): Promise<void> => {
      if (!text.trim()) return;

      // 사용자 메시지를 즉시 스토어에 추가
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: text,
        timestamp: new Date().toLocaleTimeString('ko-KR'),
      };
      addChatMessage(userMsg);

      // sseSessionId 가 없으면 mock 응답 반환
      if (!sseSessionId) {
        setTimeout(() => {
          const aiMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'ai',
            content: '분석 세션을 먼저 시작해주세요. 세션이 활성화되면 실제 AI 분석을 제공합니다.',
            timestamp: new Date().toLocaleTimeString('ko-KR'),
          };
          addChatMessage(aiMsg);
        }, 400);
        return;
      }

      // 이전 스트리밍이 있으면 중단
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      setStreamingText('');
      setIsStreaming(true);

      // 이력을 ChatHistoryItem 형식으로 변환 (최신 MAX_HISTORY_ITEMS 개만)
      const history: ChatHistoryItem[] = chatMessages
        .slice(-MAX_HISTORY_ITEMS)
        .map((m) => ({
          role: m.role === 'ai' ? 'assistant' : 'user',
          content: m.content,
        }));

      const jwt = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;

      try {
        const response = await fetch(`${CHAT_API_BASE}/${sseSessionId}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
          },
          body: JSON.stringify({ message: text, history }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`API 오류: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulated = '';
        let currentEvent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            const lines = part.split('\n');
            for (const line of lines) {
              if (line.startsWith('event: ')) {
                currentEvent = line.slice('event: '.length).trim();
              } else if (line.startsWith('data: ')) {
                const rawData = line.slice('data: '.length).trim();
                handleSseData(currentEvent, rawData, {
                  onDelta: (chunk) => {
                    accumulated += chunk;
                    setStreamingText(accumulated);
                  },
                  onDone: (fullText) => {
                    const aiMsg: ChatMessage = {
                      id: Date.now().toString(),
                      role: 'ai',
                      content: fullText,
                      timestamp: new Date().toLocaleTimeString('ko-KR'),
                    };
                    addChatMessage(aiMsg);
                    setStreamingText('');
                    setIsStreaming(false);
                  },
                  onError: (message) => {
                    const errMsg: ChatMessage = {
                      id: Date.now().toString(),
                      role: 'ai',
                      content: `오류가 발생했습니다: ${message}`,
                      timestamp: new Date().toLocaleTimeString('ko-KR'),
                    };
                    addChatMessage(errMsg);
                    setStreamingText('');
                    setIsStreaming(false);
                  },
                });
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;

        const errMsg: ChatMessage = {
          id: Date.now().toString(),
          role: 'ai',
          content: '채팅 요청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
          timestamp: new Date().toLocaleTimeString('ko-KR'),
        };
        addChatMessage(errMsg);
        setStreamingText('');
        setIsStreaming(false);
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [sseSessionId, chatMessages, addChatMessage]
  );

  return { streamingText, isStreaming, sendMessage };
}

// ─── SSE 데이터 처리 유틸 ─────────────────────────────────────

interface SseHandlers {
  onDelta: (chunk: string) => void;
  onDone: (fullText: string) => void;
  onError: (message: string) => void;
}

function handleSseData(event: string, rawData: string, handlers: SseHandlers): void {
  try {
    const parsed = JSON.parse(rawData) as Record<string, string>;
    if (event === 'delta' && typeof parsed.text === 'string') {
      handlers.onDelta(parsed.text);
    } else if (event === 'done' && typeof parsed.full_text === 'string') {
      handlers.onDone(parsed.full_text);
    } else if (event === 'error' && typeof parsed.message === 'string') {
      handlers.onError(parsed.message);
    }
  } catch {
    // JSON 파싱 실패 시 전체 세션 중단 금지 — skip
  }
}
