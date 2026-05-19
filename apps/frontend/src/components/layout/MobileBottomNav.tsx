// components/layout/MobileBottomNav.tsx
// 모바일 하단 탭 네비게이션
// 레퍼런스: ResponsiveScreens.jsx MobileTabBar
'use client';
import {
  LayoutDashboard, ShieldAlert, Sparkles, Bell, User,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export type MobileScreen = 'home' | 'vulns' | 'chat' | 'notif' | 'me';

interface NavItem {
  id: MobileScreen;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  /** 실제 라우팅 경로. 없으면 onNavigate 콜백만 호출 */
  href?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home',  label: '홈',     icon: <LayoutDashboard size={20} />, href: '/editor?view=dashboard' },
  { id: 'vulns', label: '취약점', icon: <ShieldAlert size={20} />,    badge: 10, href: '/editor?view=editor' },
  { id: 'chat',  label: 'AI',    icon: <Sparkles size={20} /> },
  { id: 'notif', label: '알림',   icon: <Bell size={20} />,            badge: 2 },
  { id: 'me',    label: '내 정보', icon: <User size={20} />,            href: '/profile' },
];

interface MobileBottomNavProps {
  activeScreen: MobileScreen;
  onNavigate: (screen: MobileScreen) => void;
}

export function MobileBottomNav({ activeScreen, onNavigate }: MobileBottomNavProps) {
  const router = useRouter();

  const handleTap = (item: NavItem) => {
    if (item.href) {
      router.push(item.href);
    }
    // 채팅/알림 패널은 onNavigate 콜백으로 처리
    onNavigate(item.id);
  };

  return (
    <nav
      aria-label="하단 네비게이션"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        paddingBottom: 22,
        paddingTop: 8,
        background: 'rgba(8,8,9,0.85)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderTop: '1px solid var(--hairline)',
        display: 'flex',
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = item.id === activeScreen;
        return (
          <button
            key={item.id}
            id={`nav-${item.id}`}
            onClick={() => handleTap(item)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            style={{
              flex: 1,
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: isActive ? 'var(--orange)' : 'var(--text-tertiary)',
            }}
          >
            <span style={{ position: 'relative' }}>
              <span
                aria-hidden="true"
                style={{
                  display: 'flex',
                  strokeWidth: isActive ? 2 : 1.6,
                  filter: isActive ? 'drop-shadow(0 0 4px rgba(249,115,22,0.6))' : 'none',
                  transition: 'filter 0.15s',
                }}
              >
                {item.icon}
              </span>
              {item.badge != null && item.badge > 0 && (
                <span style={{
                  position: 'absolute',
                  top: -3,
                  right: -8,
                  minWidth: 14,
                  height: 14,
                  borderRadius: 7,
                  background: 'var(--critical)',
                  color: '#fff',
                  fontSize: 8,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 3px',
                  border: '1.5px solid var(--bg-0)',
                }}>
                  {item.badge}
                </span>
              )}
            </span>
            <span style={{ fontSize: 10, fontWeight: 600 }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
