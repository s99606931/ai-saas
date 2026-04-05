// Design Ref: DESIGN-MTU-U1-P §C — FloatingSidebar 유기체 컴포넌트
// Plan SC: FR-UP.3, FR-UP.13, FR-UP.23

'use client';

interface MenuItem {
  id: string;
  label: string;
  href: string;
}

const SERVICE_MENUS: Record<string, MenuItem[]> = {
  dashboard: [
    { id: 'overview', label: '전체 현황', href: '/dashboard' },
    { id: 'analytics', label: '분석', href: '/dashboard/analytics' },
  ],
  tenants: [
    { id: 'list', label: '테넌트 목록', href: '/tenants' },
    { id: 'create', label: '테넌트 등록', href: '/tenants/create' },
    { id: 'plans', label: '요금제 관리', href: '/tenants/plans' },
  ],
  users: [
    { id: 'list', label: '사용자 목록', href: '/users' },
    { id: 'roles', label: '역할 관리', href: '/users/roles' },
    { id: 'sessions', label: '세션 관리', href: '/users/sessions' },
  ],
  catalog: [
    { id: 'services', label: '서비스 목록', href: '/catalog' },
    { id: 'features', label: '기능 플래그', href: '/catalog/features' },
  ],
  subscription: [
    { id: 'list', label: '구독 목록', href: '/subscriptions' },
    { id: 'plans', label: '요금제', href: '/subscriptions/plans' },
  ],
  billing: [
    { id: 'invoices', label: '청구서', href: '/billing/invoices' },
    { id: 'payments', label: '결제 내역', href: '/billing/payments' },
    { id: 'dashboard', label: '수익 대시보드', href: '/billing/dashboard' },
  ],
  crm: [
    { id: 'customers', label: '고객사', href: '/crm/customers' },
    { id: 'contacts', label: '연락처', href: '/crm/contacts' },
    { id: 'contracts', label: '계약', href: '/crm/contracts' },
    { id: 'pipeline', label: '파이프라인', href: '/crm/pipeline' },
  ],
  ai: [
    { id: 'chat', label: 'AI 대화', href: '/ai/chat' },
    { id: 'models', label: '모델 관리', href: '/ai/models' },
    { id: 'usage', label: '사용량', href: '/ai/usage' },
  ],
  compliance: [
    { id: 'csap', label: 'CSAP 준수', href: '/compliance/csap' },
    { id: 'n2sf', label: 'N2SF 현황', href: '/compliance/n2sf' },
    { id: 'readiness', label: '감리 준비도', href: '/compliance/readiness' },
  ],
  security: [
    { id: 'alerts', label: '보안 알림', href: '/security/alerts' },
    { id: 'failures', label: '로그인 실패', href: '/security/failures' },
    { id: 'blocklist', label: 'IP 차단', href: '/security/blocklist' },
  ],
  audit: [
    { id: 'logs', label: '감사 로그', href: '/audit/logs' },
    { id: 'verify', label: '무결성 검증', href: '/audit/verify' },
    { id: 'export', label: '내보내기', href: '/audit/export' },
  ],
  notifications: [
    { id: 'list', label: '알림 목록', href: '/notifications' },
    { id: 'settings', label: '알림 설정', href: '/notifications/settings' },
  ],
  files: [
    { id: 'list', label: '파일 목록', href: '/files' },
    { id: 'upload', label: '파일 업로드', href: '/files/upload' },
  ],
};

interface FloatingSidebarProps {
  serviceId: string;
  pinned: boolean;
  onTogglePin: () => void;
  onClose: () => void;
}

export function FloatingSidebar({
  serviceId,
  pinned,
  onTogglePin,
  onClose,
}: FloatingSidebarProps) {
  const menuItems = SERVICE_MENUS[serviceId] ?? [];

  return (
    <aside
      className="flex flex-col border-r z-40 transition-all duration-300"
      style={{
        width: 'var(--sidebar-w)',
        backgroundColor: 'var(--color-bg-sidebar)',
        borderColor: 'var(--color-border)',
        position: pinned ? 'relative' : 'absolute',
        top: pinned ? undefined : 0,
        left: pinned ? undefined : 'var(--rail-w)',
        height: pinned ? undefined : '100%',
        boxShadow: pinned ? 'none' : '4px 0 12px rgba(0,0,0,0.1)',
      }}
      role="complementary"
      aria-label="서비스 메뉴"
    >
      {/* 헤더: 서비스명 + 핀/닫기 */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          {serviceId}
        </span>
        <div className="flex gap-1">
          <button
            onClick={onTogglePin}
            className="p-1 rounded text-xs"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label={pinned ? '사이드바 플로팅' : '사이드바 고정'}
            aria-pressed={pinned}
          >
            {pinned ? '📌' : '📍'}
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded text-xs"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="사이드바 닫기"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 메뉴 항목 */}
      <nav className="flex-1 overflow-y-auto p-2">
        {menuItems.map((item) => (
          <a
            key={item.id}
            href={item.href}
            className="block px-3 py-2 rounded-lg text-sm hover:opacity-80 transition-colors"
            style={{ color: 'var(--color-text)' }}
          >
            {item.label}
          </a>
        ))}
        {menuItems.length === 0 && (
          <p className="text-sm p-3" style={{ color: 'var(--color-text-muted)' }}>
            메뉴 항목이 없습니다.
          </p>
        )}
      </nav>
    </aside>
  );
}
