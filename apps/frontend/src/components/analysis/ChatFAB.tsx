// components/analysis/ChatFAB.tsx
// 3단계 플로팅 AI 채팅:
//   closed  → 오른쪽 하단 52px FAB (오렌지 그라디언트, 힌트 레이블)
//   popup   → 오른쪽 하단 380×480 플로팅 팝업 (도크 버튼 포함)
//   docked  → Zustand chatDockMode=true → editor/page.tsx가 오른쪽 패널을 대체
// 데스크톱도 표시 (globals.css @media hide 제거됨)
'use client';
import { useState, useRef, useEffect } from 'react';
import { Sparkles, X, ArrowRight, PanelRight } from 'lucide-react';
import { useSecureStore } from '@/store/useSecureStore';

type ChatState = 'closed' | 'popup' | 'docked';

// ── FAB (closed 상태) ──────────────────────────────────────────
function ClosedFAB({
  unread,
  onClick,
  onDoubleClick,
}: {
  unread: number;
  onClick: () => void;
  onDoubleClick: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {/* 힌트 레이블 */}
      <div style={{
        padding: '6px 10px',
        borderRadius: 8,
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 10,
        color: 'var(--text-secondary)',
        userSelect: 'none',
        pointerEvents: 'none',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>한번 클릭</span>
        <span>·</span>
        <span style={{ fontWeight: 600 }}>AI 채팅</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-tertiary)' }}>(더블클릭 → 도크)</span>
      </div>

      {/* FAB 버튼 */}
      <button
        onClick={onClick}
        onDoubleClick={(e) => { e.preventDefault(); onDoubleClick(); }}
        aria-label="AI 채팅 열기 (더블클릭: 도크)"
        style={{
          position: 'relative',
          width: 52,
          height: 52,
          borderRadius: 26,
          background: 'linear-gradient(135deg, var(--orange) 0%, var(--orange-2) 100%)',
          border: 'none',
          color: '#fff',
          boxShadow: '0 8px 24px rgba(234,88,12,0.55), 0 0 0 1px rgba(255,255,255,0.10) inset',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Sparkles size={22} color="#fff" />
        {unread > 0 && (
          <span style={{
            position: 'absolute',
            top: -2,
            right: -2,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            background: 'var(--critical)',
            color: '#fff',
            fontSize: 10,
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
    </div>
  );
}

// ── 채팅 팝업 (popup 상태) ──────────────────────────────────────
function ChatPopup({
  onClose,
  onDock,
  chatMessages,
  onSend,
}: {
  onClose: () => void;
  onDock: () => void;
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
    <div
      style={{
        width: 380,
        height: 480,
        background: 'var(--bg-1)',
        border: '1px solid var(--border-2)',
        borderRadius: 12,
        boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'fadein 0.2s',
      }}
    >
      {/* 헤더 */}
      <div style={{
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderBottom: '1px solid var(--hairline)',
        background: 'var(--bg-2)',
        flexShrink: 0,
      }}>
        <div style={{ width: 22, height: 22, borderRadius: 5, background: 'var(--orange-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Sparkles size={11} color="var(--orange)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-active)' }}>Pagori 보안 에이전트</div>
          <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>AI 채팅</div>
        </div>
        <button
          onClick={onDock}
          title="오른쪽 패널에 도크"
          aria-label="도크 모드"
          style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <PanelRight size={12} />
        </button>
        <button
          onClick={onClose}
          aria-label="채팅 닫기"
          style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={12} />
        </button>
      </div>

      {/* 메시지 목록 */}
      <div style={{ flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {chatMessages.length === 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ width: 20, height: 20, borderRadius: 5, background: 'var(--orange-dim)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={10} color="var(--orange)" />
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-on-bg)' }}>
              안녕하세요! 보안 취약점에 대해 질문해보세요.
            </div>
          </div>
        )}
        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 6 }}
          >
            {msg.role === 'ai' && (
              <div style={{ width: 20, height: 20, borderRadius: 5, background: 'var(--orange-dim)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
      <div style={{ padding: '8px 10px', borderTop: '1px solid var(--hairline)', background: 'var(--bg-2)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 14, background: 'var(--bg-3)', border: '1px solid var(--border)' }}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지 입력…"
            aria-label="AI 채팅 입력"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}
          />
          <button
            onClick={handleSend}
            aria-label="전송"
            style={{ width: 22, height: 22, borderRadius: 11, background: 'var(--orange-2)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            <ArrowRight size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ChatFAB 메인 컴포넌트 ──────────────────────────────────────
export function ChatFAB() {
  const [chatState, setChatState] = useState<ChatState>('closed');
  const chatMessages  = useSecureStore((s) => s.chatMessages);
  const sendChat      = useSecureStore((s) => s.sendChat);
  const setChatDockMode = useSecureStore((s) => s.setChatDockMode);
  const chatDockMode  = useSecureStore((s) => s.chatDockMode);

  // chatDockMode가 외부에서 false로 바뀌면 closed로 복귀
  useEffect(() => {
    if (!chatDockMode && chatState === 'docked') {
      setChatState('closed');
    }
  }, [chatDockMode, chatState]);

  const handleOpen = () => {
    setChatState('popup');
  };

  const handleDock = () => {
    setChatState('docked');
    setChatDockMode(true);
  };

  const handleClose = () => {
    setChatState('closed');
    setChatDockMode(false);
  };

  const unreadCount = 0;

  // docked 상태에서는 FAB를 숨김 (패널이 EditorLayout에서 렌더링됨)
  if (chatState === 'docked') return null;

  return (
    <div
      className="chat-fab-container"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 20,
        zIndex: 30,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 10,
      }}
    >
      {chatState === 'popup' && (
        <ChatPopup
          onClose={handleClose}
          onDock={handleDock}
          chatMessages={chatMessages}
          onSend={sendChat}
        />
      )}
      {chatState === 'closed' && (
        <ClosedFAB
          unread={unreadCount}
          onClick={handleOpen}
          onDoubleClick={handleDock}
        />
      )}
    </div>
  );
}

// ── DockedChatPanel — EditorLayout에서 렌더링됨 ───────────────
export function DockedChatPanel({ onUndock }: { onUndock: () => void }) {
  const chatMessages  = useSecureStore((s) => s.chatMessages);
  const sendChat      = useSecureStore((s) => s.sendChat);
  const setChatDockMode = useSecureStore((s) => s.setChatDockMode);
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    sendChat(trimmed);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClose = () => {
    setChatDockMode(false);
    onUndock();
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: '#0f0f0f',
      borderLeft: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* 헤더 */}
      <div style={{
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.02)',
        flexShrink: 0,
      }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--orange-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Sparkles size={12} color="var(--orange)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>AI 채팅 · 도크됨</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)' }}>Pagori 보안 에이전트</div>
        </div>
        <button
          onClick={handleClose}
          title="패널 닫기"
          style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={12} />
        </button>
      </div>

      {/* 메시지 목록 */}
      <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {chatMessages.length === 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ width: 22, height: 22, borderRadius: 5, background: 'var(--orange-dim)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={11} color="var(--orange)" />
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: 'rgba(255,255,255,0.7)' }}>
              안녕하세요! 보안 취약점에 대해 질문해보세요.
            </div>
          </div>
        )}
        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 8 }}
          >
            {msg.role === 'ai' && (
              <div style={{ width: 22, height: 22, borderRadius: 5, background: 'var(--orange-dim)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={11} color="var(--orange)" />
              </div>
            )}
            <div style={{
              padding: '8px 12px',
              borderRadius: 14,
              background: msg.role === 'user' ? 'var(--orange-2)' : 'rgba(255,255,255,0.07)',
              color: msg.role === 'user' ? '#fff' : 'rgba(255,255,255,0.8)',
              maxWidth: '85%',
              fontSize: 13,
              lineHeight: 1.5,
            }}>
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      {/* 입력창 */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요…"
            aria-label="AI 채팅 입력"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'rgba(255,255,255,0.85)', fontFamily: 'var(--font-sans)' }}
          />
          <button
            onClick={handleSend}
            aria-label="전송"
            style={{ width: 24, height: 24, borderRadius: 12, background: 'var(--orange-2)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            <ArrowRight size={12} />
          </button>
        </div>
        <div style={{ marginTop: 5, fontSize: 9, color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-mono)' }}>
          @ 취약점 · # 태그 · ⇧↵ 줄바꿈
        </div>
      </div>
    </div>
  );
}
