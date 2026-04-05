// Design Ref: DESIGN-MTU-U1-P §B — AppNavbar 유기체 컴포넌트
// Plan SC: FR-UP.10

'use client';

interface AppNavbarProps {
  onAiToggle: () => void;
  aiPanelOpen: boolean;
}

export function AppNavbar({ onAiToggle, aiPanelOpen }: AppNavbarProps) {
  return (
    <header
      className="flex items-center justify-between px-4 border-b shrink-0"
      style={{
        height: 'var(--navbar-h)',
        backgroundColor: 'var(--color-bg)',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* 좌측: 로고 + 포털 전환 */}
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>
          공공 SaaS
        </span>
        <select
          className="text-sm border rounded px-2 py-1"
          style={{ borderColor: 'var(--color-border)' }}
          aria-label="포털 전환"
        >
          <option>관리자 포털</option>
          <option>테넌트 포털</option>
        </select>
      </div>

      {/* 중앙: 글로벌 검색 (Cmd+K) */}
      <div className="hidden md:flex items-center">
        <button
          className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg"
          style={{
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-muted)',
          }}
          aria-label="검색 (Cmd+K)"
        >
          <span>검색...</span>
          <kbd className="text-xs px-1.5 py-0.5 border rounded" style={{ borderColor: 'var(--color-border)' }}>
            ⌘K
          </kbd>
        </button>
      </div>

      {/* 우측: AI 버튼 + 알림 + 테마 + 사용자 */}
      <div className="flex items-center gap-2">
        <button
          onClick={onAiToggle}
          className="p-2 rounded-lg text-sm"
          style={{
            backgroundColor: aiPanelOpen ? 'var(--color-primary)' : 'transparent',
            color: aiPanelOpen ? '#fff' : 'var(--color-text)',
          }}
          aria-label="AI 패널 토글"
          aria-pressed={aiPanelOpen}
        >
          AI
        </button>
        <button
          className="p-2 rounded-lg"
          style={{ color: 'var(--color-text-muted)' }}
          aria-label="알림"
        >
          <span aria-hidden>🔔</span>
        </button>
        <button
          className="w-8 h-8 rounded-full text-sm font-medium"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: '#fff',
          }}
          aria-label="사용자 메뉴"
        >
          관
        </button>
      </div>
    </header>
  );
}
