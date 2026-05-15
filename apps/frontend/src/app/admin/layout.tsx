'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';
import { ShieldCheck, Users, CreditCard, ArrowLeft } from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin/users', label: '사용자 관리', icon: <Users size={15} /> },
  { href: '/admin/plans', label: '플랜 관리',   icon: <CreditCard size={15} /> },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isInitialized } = useAuthStore();
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);

  useEffect(() => {
    if (!isInitialized) return;
    if (!user || !user.isAdmin) {
      router.replace('/');
    }
  }, [isInitialized, user, router]);

  if (!isInitialized || !user || !user.isAdmin) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0d0d0f', color: '#e8e8ee', fontFamily: 'var(--font-sans, system-ui)' }}>
      {/* ── Sidebar ── */}
      <aside style={{
        width: 200,
        flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 0,
      }}>
        {/* Sidebar Header */}
        <div style={{
          padding: '18px 16px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <ShieldCheck size={16} color="#ea580c" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#e8e8ee' }}>Admin Console</span>
          </div>
          <Link
            href="/editor"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              color: 'rgba(255,255,255,0.35)',
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={12} />
            에디터로 돌아가기
          </Link>
        </div>

        {/* Nav Items */}
        <nav style={{ padding: '12px 8px', flex: 1 }}>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const isHovered = hoveredLink === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onMouseEnter={() => setHoveredLink(item.href)}
                onMouseLeave={() => setHoveredLink(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 7,
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#ea580c' : isHovered ? '#e8e8ee' : 'rgba(255,255,255,0.5)',
                  background: isActive
                    ? 'rgba(234,88,12,0.10)'
                    : isHovered
                    ? 'rgba(255,255,255,0.04)'
                    : 'transparent',
                  textDecoration: 'none',
                  marginBottom: 2,
                  transition: 'background 0.12s, color 0.12s',
                }}
              >
                <span style={{ color: isActive ? '#ea580c' : 'inherit' }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* ── Main Content ── */}
      <main style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
