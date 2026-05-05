'use client';
import { useState, useRef, useEffect } from 'react';
import { useSecureStore } from '@/store/useSecureStore';
import { useChat } from '@/hooks/useChat';
import type { ChatMessage } from '@/lib/mockData';

export default function ChatPanel() {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const chatMessages = useSecureStore((s) => s.chatMessages);
  const sseSessionId = useSecureStore((s) => s.sseSessionId);
  const { streamingText, isStreaming, sendMessage } = useChat();

  // 새 메시지 또는 스트리밍 텍스트 변경 시 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, streamingText]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput('');
    sendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 세션이 없을 때 안내 배너
  const noSessionBanner = !sseSessionId && (
    <div
      style={{
        margin: '12px',
        padding: '10px 12px',
        borderRadius: 6,
        background: 'rgba(234,88,12,0.08)',
        border: '1px solid rgba(234,88,12,0.25)',
        color: 'rgba(255,255,255,0.55)',
        fontSize: 11,
        lineHeight: 1.5,
      }}
    >
      분석 세션을 먼저 시작해주세요. 세션이 활성화되면 실제 AI 분석을 제공합니다.
    </div>
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0f0f0f',
      }}
    >
      {noSessionBanner}

      {/* 메시지 목록 */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {chatMessages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {/* 스트리밍 중 임시 AI 버블 */}
        {isStreaming && streamingText && (
          <StreamingBubble text={streamingText} />
        )}

        {/* 스트리밍 중이지만 아직 텍스트 없으면 로딩 점 표시 */}
        {isStreaming && !streamingText && (
          <TypingIndicator />
        )}

        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div
        style={{
          padding: '8px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? '응답 중...' : '질문하기...'}
            disabled={isStreaming}
            style={{
              flex: 1,
              fontSize: 11,
              padding: '6px 12px',
              borderRadius: 4,
              outline: 'none',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: '#e8e8ee',
              opacity: isStreaming ? 0.5 : 1,
            }}
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            style={{
              padding: '6px 12px',
              borderRadius: 4,
              background: isStreaming || !input.trim() ? 'rgba(234,88,12,0.3)' : '#ea580c',
              color: '#fff',
              border: 'none',
              fontSize: 11,
              fontWeight: 600,
              cursor: isStreaming || !input.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            &#8593;
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 하위 컴포넌트 ─────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      {!isUser && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginBottom: 4,
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: '#ea580c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 8,
              fontWeight: 700,
              color: '#fff',
            }}
          >
            AI
          </div>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
            {msg.timestamp}
          </span>
        </div>
      )}

      <div
        style={{
          maxWidth: '85%',
          padding: '7px 11px',
          borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
          background: isUser ? '#ea580c' : 'rgba(255,255,255,0.06)',
          color: isUser ? '#fff' : 'rgba(255,255,255,0.85)',
          fontSize: 11,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {msg.content}
      </div>

      {isUser && (
        <span
          style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.35)',
            marginTop: 2,
          }}
        >
          {msg.timestamp}
        </span>
      )}
    </div>
  );
}

function StreamingBubble({ text }: { text: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginBottom: 4,
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#ea580c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 8,
            fontWeight: 700,
            color: '#fff',
          }}
        >
          AI
        </div>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
          입력 중...
        </span>
      </div>
      <div
        style={{
          maxWidth: '85%',
          padding: '7px 11px',
          borderRadius: '12px 12px 12px 2px',
          background: 'rgba(255,255,255,0.06)',
          color: 'rgba(255,255,255,0.85)',
          fontSize: 11,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {text}
        <span
          style={{
            display: 'inline-block',
            width: 6,
            height: 12,
            background: '#ea580c',
            marginLeft: 2,
            borderRadius: 1,
            animation: 'blink 1s step-end infinite',
          }}
        />
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0' }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'rgba(234,88,12,0.6)',
            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
