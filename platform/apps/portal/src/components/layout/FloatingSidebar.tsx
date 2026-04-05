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
    { id: 'overview', label: '전체 현황', href: '/admin/dashboard' },
    { id: 'analytics', label: '분석', href: '/admin/dashboard' },
  ],
  tenants: [
    { id: 'list', label: '테넌트 목록', href: '/admin/tenants' },
    { id: 'create', label: '테넌트 등록', href: '/admin/tenants' },
    { id: 'plans', label: '요금제 관리', href: '/admin/tenants' },
  ],
  users: [
    { id: 'list', label: '사용자 목록', href: '/admin/users' },
    { id: 'roles', label: '역할 관리', href: '/admin/users' },
    { id: 'sessions', label: '세션 관리', href: '/admin/users' },
  ],
  catalog: [
    { id: 'services', label: '서비스 목록', href: '/admin/catalog' },
    { id: 'features', label: '기능 플래그', href: '/admin/catalog' },
  ],
  subscription: [
    { id: 'list', label: '구독 목록', href: '/admin/tenants' },
    { id: 'plans', label: '요금제', href: '/admin/tenants' },
  ],
  billing: [
    { id: 'invoices', label: '청구서', href: '/admin/dashboard' },
    { id: 'payments', label: '결제 내역', href: '/admin/dashboard' },
    { id: 'dashboard', label: '수익 대시보드', href: '/admin/dashboard' },
  ],
  crm: [
    { id: 'customers', label: '고객사', href: '/admin/crm' },
    { id: 'contacts', label: '연락처', href: '/admin/crm' },
    { id: 'contracts', label: '계약', href: '/admin/crm' },
    { id: 'pipeline', label: '파이프라인', href: '/admin/crm' },
  ],
  ai: [
    { id: 'chat', label: 'AI 대화', href: '/admin/ai' },
    { id: 'models', label: '모델 관리', href: '/admin/ai' },
    { id: 'usage', label: '사용량', href: '/admin/ai' },
  ],
  compliance: [
    { id: 'csap', label: 'CSAP 준수', href: '/admin/compliance' },
    { id: 'n2sf', label: 'N2SF 현황', href: '/admin/compliance' },
    { id: 'readiness', label: '감리 준비도', href: '/admin/compliance' },
  ],
  security: [
    { id: 'alerts', label: '보안 알림', href: '/admin/security' },
    { id: 'failures', label: '로그인 실패', href: '/admin/security' },
    { id: 'blocklist', label: 'IP 차단', href: '/admin/security' },
  ],
  audit: [
    { id: 'logs', label: '감사 로그', href: '/admin/audit' },
    { id: 'verify', label: '무결성 검증', href: '/admin/audit' },
    { id: 'export', label: '내보내기', href: '/admin/audit' },
  ],
  notifications: [
    { id: 'list', label: '알림 목록', href: '/admin/notifications' },
    { id: 'settings', label: '알림 설정', href: '/admin/notifications' },
  ],
  files: [
    { id: 'list', label: '파일 목록', href: '/admin/files' },
    { id: 'upload', label: '파일 업로드', href: '/admin/files' },
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
