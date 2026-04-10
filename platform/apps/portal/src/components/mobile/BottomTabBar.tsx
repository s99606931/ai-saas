// Design Ref: DESIGN-MTU-U1-P §G — BottomTabBar 모바일 컴포넌트
// Plan SC: FR-UP.18

'use client';

interface TabItem {
  id: string;
  label: string;
  icon: string;
  href: string;
}

const TABS: TabItem[] = [
  { id: 'home', label: '홈', icon: '🏠', href: '/admin/dashboard' },
  { id: 'services', label: '서비스', icon: '📦', href: '/admin/catalog' },
  { id: 'ai', label: 'AI', icon: '🤖', href: '/admin/ai' },
  { id: 'notifications', label: '알림', icon: '🔔', href: '/admin/notifications' },
  { id: 'settings', label: '설정', icon: '⚙️', href: '/admin/security' },
];

export function BottomTabBar() {
  return (
    <nav
      className="md:hidden flex items-center justify-around border-t shrink-0"
      style={{
        height: 'var(--bottom-tab-h)',
        backgroundColor: 'var(--color-bg)',
        borderColor: 'var(--color-border)',
      }}
      role="tablist"
      aria-label="하단 탭 네비게이션"
    >
      {TABS.map((tab) => (
        <a
          key={tab.id}
          href={tab.href}
          className="flex flex-col items-center justify-center gap-0.5 py-1"
          style={{
            color: 'var(--color-text-muted)',
            minWidth: '44px',
            minHeight: '44px',
          }}
          role="tab"
          aria-label={tab.label}
        >
          <span className="text-lg" aria-hidden>
            {tab.icon}
          </span>
          <span className="text-[10px]">{tab.label}</span>
        </a>
      ))}
    </nav>
  );
}
