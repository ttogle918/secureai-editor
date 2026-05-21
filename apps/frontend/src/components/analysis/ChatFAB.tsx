// components/analysis/ChatFAB.tsx
// 모바일 전용 플로팅 AI 채팅 버튼 (768px 이하에서만 표시)
// 상태: closed(FAB만) → open(말풍선 팝업)
// 위치: fixed, bottom-right (bottom: 88px — 하단 네비 위)
'use client';
import { useState } from 'react';
import { Sparkles, X, ArrowRight } from 'lucide-react';
import { useSecureStore } from '@/store/useSecureStore';

// ── 닫힌 상태: 주황색 원형 FAB ──────────────────────────────
function ClosedFAB({ unread, onClick }: { unread: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="AI 채팅 열기"
      style={{
        position: 'relative',
        width: 56,
        height: 56,
        borderRadius: 28,
        background: 'linear-gradient(135deg, var(--orange) 0%, var(--orange-2) 100%)',
        border: 'none',
        color: '#fff',
        boxShadow: '0 8px 24px rgba(234,88,12,0.55), 0 0 0 1px rgba(255,255,255,0.10) inset',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Sparkles size={24} color="#fff" />
      {unread > 0 && (
        <span style={{
          position: 'absolute',
          top: -2,
          right: -2,
          minWidth: 20,
          height: 20,
          borderRadius: 10,
          background: 'var(--critical)',
          color: '#fff',
          fontSize: 11,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid var(--bg-0)',
        }}>
          {unread}
        </span>
      )}
    </button>
  );
}

// ── 열린 상태: 말풍선 팝업 ───────────────────────────────────
function ChatBubble({ onClose, chatMessages, onSend }: {
  onClose: () => void;
  chatMessages: Array<{ id: string; role: 'user' | 'ai'; content: string; timestamp: string }>;
  onSend: (text: string) => void;
}) {
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{
      width: 332,
      maxHeight: 440,
      background: 'var(--bg-1)',
      border: '1px solid var(--border-2)',
      borderRadius: 18,
      boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      animation: 'fadein 0.2s',
    }}>
      {/* 말풍선 꼬리 — FAB 방향 */}
      <span style={{
        position: 'absolute',
        bottom: -8,
        right: 22,
        width: 16,
        height: 16,
        background: 'var(--bg-1)',
        border: '1px solid var(--border-2)',
        borderTop: 'none',
        borderLeft: 'none',
        transform: 'rotate(45deg)',
        zIndex: -1,
      }} />

      {/* 헤더 */}
      <div style={{
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderBottom: '1px solid var(--hairline)',
        background: 'var(--bg-2)',
      }}>
        <div style={{
          width: 22,
          height: 22,
          borderRadius: 5,
          background: 'var(--orange-dim)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Sparkles size={11} color="var(--orange)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-active)' }}>Pagori 보안 에이전트</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>AI 채팅</div>
        </div>
        <button
          onClick={onClose}
          aria-label="채팅 닫기"
          style={{
            width: 22,
            height: 22,
            borderRadius: 5,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={12} />
        </button>
      </div>

      {/* 메시지 목록 */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        {chatMessages.length === 0 && (
          <div style={{
            display: 'flex',
            gap: 6,
            alignItems: 'flex-start',
          }}>
            <div style={{
              width: 20,
              height: 20,
              borderRadius: 5,
              background: 'var(--orange-dim)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Sparkles size={10} color="var(--orange)" />
            </div>
            <div style={{
              fontSize: 13,
              lineHeight: 1.5,
              color: 'var(--text-on-bg)',
            }}>
              안녕하세요! 보안 취약점에 대해 질문해보세요.
            </div>
          </div>
        )}
        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              gap: 6,
            }}
          >
            {msg.role === 'ai' && (
              <div style={{
                width: 20,
                height: 20,
                borderRadius: 5,
                background: 'var(--orange-dim)',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Sparkles size={10} color="var(--orange)" />
              </div>
            )}
            <div style={{
              padding: '7px 11px',
              borderRadius: 14,
              background: msg.role === 'user' ? 'var(--orange-2)' : 'var(--bg-3)',
              color: msg.role === 'user' ? '#fff' : 'var(--text-on-bg)',
              maxWidth: '85%',
              fontSize: 13,
              lineHeight: 1.45,
            }}>
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      {/* 입력창 */}
      <div style={{
        padding: '8px 10px',
        borderTop: '1px solid var(--hairline)',
        background: 'var(--bg-2)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          borderRadius: 14,
          background: 'var(--bg-3)',
          border: '1px solid var(--border)',
        }}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지 입력…"
            aria-label="AI 채팅 입력"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: 13,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
            }}
          />
          <button
            onClick={handleSend}
            aria-label="전송"
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              background: 'var(--orange-2)',
              color: '#fff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <ArrowRight size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ChatFAB 메인 컴포넌트 ─────────────────────────────────────
export function ChatFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const chatMessages = useSecureStore((s) => s.chatMessages);
  const sendChat     = useSecureStore((s) => s.sendChat);

  const unreadCount = 0;

  return (
    // @media (min-width: 768px) { display: none } — 데스크톱에서 숨김
    <div
      className="chat-fab-container"
      style={{
        position: 'fixed',
        bottom: 88,
        right: 18,
        zIndex: 25,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 10,
      }}
    >
      {isOpen && (
        <ChatBubble
          onClose={() => setIsOpen(false)}
          chatMessages={chatMessages}
          onSend={sendChat}
        />
      )}
      <ClosedFAB
        unread={unreadCount}
        onClick={() => setIsOpen((prev) => !prev)}
      />
    </div>
  );
}
