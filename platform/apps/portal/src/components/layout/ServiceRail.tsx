// Design Ref: DESIGN-MTU-U1-P §C — ServiceRail 유기체 컴포넌트
// Plan SC: FR-UP.1, FR-UP.2, FR-UP.3, FR-UP.12, FR-UP.22

'use client';

import { useState } from 'react';

interface ServiceItem {
  id: string;
  name: string;
  icon: string;
  category: string;
}

const PLATFORM_SERVICES: ServiceItem[] = [
  { id: 'dashboard', name: '대시보드', icon: '📊', category: '관리' },
  { id: 'tenants', name: '테넌트 관리', icon: '🏢', category: '관리' },
  { id: 'users', name: '사용자 관리', icon: '👤', category: '관리' },
  { id: 'catalog', name: '서비스 카탈로그', icon: '📦', category: '서비스' },
  { id: 'subscription', name: '구독 관리', icon: '📋', category: '서비스' },
  { id: 'billing', name: '빌링', icon: '💰', category: '서비스' },
  { id: 'crm', name: 'CRM', icon: '🤝', category: '서비스' },
  { id: 'ai', name: 'AI 서비스', icon: '🤖', category: '서비스' },
  { id: 'compliance', name: 'CSAP 준수', icon: '🛡️', category: '보안' },
  { id: 'security', name: '보안 모니터링', icon: '🔒', category: '보안' },
  { id: 'audit', name: '감사 로그', icon: '📝', category: '보안' },
  { id: 'notifications', name: '알림', icon: '🔔', category: '시스템' },
  { id: 'files', name: '파일 관리', icon: '📁', category: '시스템' },
];

const MAX_VISIBLE = 10;

interface ServiceRailProps {
  expanded: boolean;
  onToggleExpand: () => void;
  activeService: string | null;
  onServiceSelect: (serviceId: string) => void;
}

export function ServiceRail({ expanded, onToggleExpand, activeService, onServiceSelect }: ServiceRailProps) {
  // FR-UP.2: 10개 초과 시 "더 보기" 팝오버
  const [showMore, setShowMore] = useState(false);

  const visibleServices = PLATFORM_SERVICES.slice(0, MAX_VISIBLE);
  const overflowServices = PLATFORM_SERVICES.slice(MAX_VISIBLE);

  return (
    <nav
      className="hidden md:flex flex-col shrink-0 border-r transition-all duration-300"
      style={{
        width: expanded ? 'var(--rail-expanded-w)' : 'var(--rail-w)',
        backgroundColor: 'var(--color-bg-rail)',
        borderColor: 'var(--color-border)',
      }}
      role="navigation"
      aria-label="서비스 레일"
    >
      {/* FR-UP.22: 확장/축소 토글 */}
      <button
        onClick={onToggleExpand}
        className="flex items-center justify-center p-3 hover:opacity-80"
        style={{ color: 'var(--color-text-rail)' }}
        aria-label={expanded ? '레일 축소' : '레일 확장'}
        aria-expanded={expanded}
      >
        {expanded ? '◀' : '▶'}
      </button>

      {/* 서비스 아이콘 목록 */}
      <div className="flex-1 flex flex-col gap-1 px-1 overflow-y-auto">
        {visibleServices.map((service) => (
          <button
            key={service.id}
            onClick={() => onServiceSelect(service.id)}
            className="flex items-center gap-2 p-2 rounded-lg transition-colors"
            style={{
              backgroundColor: activeService === service.id ? 'rgba(255,255,255,0.15)' : 'transparent',
              color: 'var(--color-text-rail)',
            }}
            title={service.name}
            aria-label={service.name}
            aria-current={activeService === service.id ? 'page' : undefined}
          >
            <span className="text-lg" aria-hidden>
              {service.icon}
            </span>
            {expanded && <span className="text-sm truncate">{service.name}</span>}
          </button>
        ))}

        {/* FR-UP.2: 더 보기 팝오버 */}
        {overflowServices.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowMore((v) => !v)}
              className="flex items-center gap-2 p-2 rounded-lg w-full"
              style={{ color: 'var(--color-text-rail)' }}
              aria-label="더 보기"
              aria-expanded={showMore}
            >
              <span className="text-lg" aria-hidden>
                ⋮
              </span>
              {expanded && <span className="text-sm">더 보기</span>}
            </button>
            {showMore && (
              <div
                className="absolute left-full top-0 ml-2 p-2 rounded-lg shadow-lg border z-50 min-w-[180px]"
                style={{
                  backgroundColor: 'var(--color-bg)',
                  borderColor: 'var(--color-border)',
                }}
                role="menu"
              >
                {overflowServices.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => {
                      onServiceSelect(service.id);
                      setShowMore(false);
                    }}
                    className="flex items-center gap-2 p-2 rounded w-full text-left hover:opacity-80"
                    style={{ color: 'var(--color-text)' }}
                    role="menuitem"
                  >
                    <span aria-hidden>{service.icon}</span>
                    <span className="text-sm">{service.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 하단 고정: AI + 설정 */}
      <div className="flex flex-col gap-1 px-1 pb-2 border-t pt-2" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        <button
          className="flex items-center gap-2 p-2 rounded-lg"
          style={{ color: 'var(--color-text-rail)' }}
          aria-label="설정"
        >
          <span className="text-lg" aria-hidden>
            ⚙️
          </span>
          {expanded && <span className="text-sm">설정</span>}
        </button>
      </div>
    </nav>
  );
}
