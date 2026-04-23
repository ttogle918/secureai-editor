// components/layout/MobileBottomNav.tsx
// 모바일 하단 탭 네비게이션
// 와이어프레임: secureai-mobile.html 참조
'use client';
import { LayoutDashboard, Search, Zap, MessageSquare, Settings } from 'lucide-react';

export type MobileScreen = 'dashboard' | 'vulns' | 'scan' | 'chat' | 'settings';

interface NavItem {
  id: MobileScreen;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: '대시보드', icon: <LayoutDashboard size={22} /> },
  { id: 'vulns',     label: '취약점',   icon: <Search size={22} /> },
  { id: 'scan',      label: '분석',     icon: <Zap size={22} /> },
  { id: 'chat',      label: 'AI 채팅',  icon: <MessageSquare size={22} /> },
  { id: 'settings',  label: '설정',     icon: <Settings size={22} /> },
];

interface MobileBottomNavProps {
  activeScreen: MobileScreen;
  onNavigate: (screen: MobileScreen) => void;
}

export function MobileBottomNav({ activeScreen, onNavigate }: MobileBottomNavProps) {
  return (
    <nav
      aria-label="하단 네비게이션"
      style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 430,
        background: 'rgba(13,13,15,0.95)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid #1f1f24',
        display: 'flex',
        padding: '8px 0',
        zIndex: 100,
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = item.id === activeScreen;
        return (
          <button
            key={item.id}
            id={`nav-${item.id}`}
            onClick={() => onNavigate(item.id)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: 6,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'opacity 0.15s',
              color: isActive ? '#f97316' : '#555560',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                filter: isActive ? 'drop-shadow(0 0 4px rgba(249,115,22,0.6))' : 'none',
                transition: 'filter 0.15s',
              }}
            >
              {item.icon}
            </span>
            <span style={{ fontSize: 10, color: isActive ? '#f97316' : '#555560' }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
