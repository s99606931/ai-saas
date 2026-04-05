// Design Ref: DESIGN-MTU-U1-P §E — 최근 방문 탭바
// Plan SC: FR-UP.25, FR-UP.26

'use client';

import { useState, useEffect } from 'react';

interface RecentTab {
  id: string;
  label: string;
  href: string;
}

type RecentMode = 'tabs' | 'list';

export function RecentTabsBar() {
  // FR-UP.26: 최근 표시 모드 개인 설정 (localStorage)
  const [mode, setMode] = useState<RecentMode>('tabs');
  const [tabs, setTabs] = useState<RecentTab[]>([
    { id: '1', label: '대시보드', href: '/dashboard' },
    { id: '2', label: '테넌트 관리', href: '/tenants' },
  ]);

  useEffect(() => {
    const saved = localStorage.getItem('recentMode');
    if (saved === 'tabs' || saved === 'list') {
      setMode(saved);
    }
  }, []);

  const handleModeToggle = () => {
    const next: RecentMode = mode === 'tabs' ? 'list' : 'tabs';
    setMode(next);
    localStorage.setItem('recentMode', next);
  };

  const handleCloseTab = (tabId: string) => {
    setTabs((prev) => prev.filter((t) => t.id !== tabId));
  };

  return (
    <div
      className="flex items-center border-b px-2 shrink-0"
      style={{
        height: 'var(--tabs-h)',
        backgroundColor: 'var(--color-bg-secondary)',
        borderColor: 'var(--color-border)',
      }}
      role="tablist"
      aria-label="최근 방문 탭"
    >
      <div className="flex-1 flex items-center gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs shrink-0"
            style={{ color: 'var(--color-text)' }}
            role="tab"
          >
            <a href={tab.href} className="hover:underline">
              {tab.label}
            </a>
            <button
              onClick={() => handleCloseTab(tab.id)}
              className="ml-1 opacity-50 hover:opacity-100"
              aria-label={`${tab.label} 탭 닫기`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* FR-UP.26: 모드 전환 버튼 */}
      <button
        onClick={handleModeToggle}
        className="text-xs px-2 py-1 rounded shrink-0"
        style={{ color: 'var(--color-text-muted)' }}
        aria-label={`${mode === 'tabs' ? '목록' : '탭'} 모드로 전환`}
      >
        {mode === 'tabs' ? '☰' : '⬚'}
      </button>
    </div>
  );
}
