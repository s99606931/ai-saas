// Design Ref: DESIGN-MTU-U1-P §A — App Shell 레이아웃
// Plan SC: FR-UP.1, FR-UP.3, FR-UP.10, FR-UP.22, FR-UP.23, FR-UP.24

'use client';

import { useState, useCallback, type ReactNode } from 'react';
import { AppNavbar } from './AppNavbar';
import { ServiceRail } from './ServiceRail';
import { FloatingSidebar } from './FloatingSidebar';
import { RecentTabsBar } from './RecentTabsBar';
import { AiSidePanel } from '../ai/AiSidePanel';
import { BottomTabBar } from '../mobile/BottomTabBar';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  // FR-UP.22: 레일 확장/축소 토글
  const [railExpanded, setRailExpanded] = useState(false);
  // FR-UP.3: FloatingSidebar 활성 서비스
  const [activeService, setActiveService] = useState<string | null>(null);
  // FR-UP.23: 사이드바 핀 고정
  const [sidebarPinned, setSidebarPinned] = useState(false);
  // FR-UP.24: AI 패널 열기/닫기
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  const handleServiceSelect = useCallback((serviceId: string) => {
    setActiveService((prev) => (prev === serviceId ? null : serviceId));
  }, []);

  const railWidth = railExpanded ? 'var(--rail-expanded-w)' : 'var(--rail-w)';

  return (
    <div className="app-shell">
      {/* FR-UP.10: AppNavbar */}
      <AppNavbar
        onAiToggle={() => setAiPanelOpen((v) => !v)}
        aiPanelOpen={aiPanelOpen}
      />

      <div className="app-body">
        {/* FR-UP.1, FR-UP.12, FR-UP.22: ServiceRail */}
        <ServiceRail
          expanded={railExpanded}
          onToggleExpand={() => setRailExpanded((v) => !v)}
          activeService={activeService}
          onServiceSelect={handleServiceSelect}
        />

        {/* FR-UP.13, FR-UP.23: FloatingSidebar */}
        {activeService && (
          <FloatingSidebar
            serviceId={activeService}
            pinned={sidebarPinned}
            railExpanded={railExpanded}
            onTogglePin={() => setSidebarPinned((v) => !v)}
            onClose={() => setActiveService(null)}
          />
        )}

        {/* Main Area */}
        <div className="main-area">
          {/* FR-UP.25: 최근 탭바 */}
          <RecentTabsBar />

          {/* 페이지 콘텐츠 */}
          <div className="main-content">
            {children}
          </div>
        </div>

        {/* FR-UP.24: AI 사이드 패널 */}
        {aiPanelOpen && (
          <AiSidePanel
            onClose={() => setAiPanelOpen(false)}
          />
        )}
      </div>

      {/* FR-UP.18: 모바일 하단 탭바 */}
      <BottomTabBar />
    </div>
  );
}
