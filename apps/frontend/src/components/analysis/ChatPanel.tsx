'use client';
import { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '@/lib/mockData';

interface Props {
  messages: ChatMessage[];
  onSend: (text: string) => void;
}

export default function ChatPanel({ messages, onSend }: Props) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            {msg.role === 'ai' && (
              <div className="flex items-center gap-1 mb-1">
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: 'var(--accent-blue)', color: '#fff', fontSize: 8 }}
                >
                  AI
                </div>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{msg.timestamp}</span>
              </div>
            )}
            <div className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}>
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <span className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{msg.timestamp}</span>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div className="p-2 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="질문하기..."
            className="flex-1 text-xs px-3 py-2 rounded outline-none"
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-light)',
              color: 'var(--text-primary)',
            }}
          />
          <button onClick={handleSend} className="btn-primary px-3 text-xs">↑</button>
        </div>
      </div>
    </div>
  );
}
