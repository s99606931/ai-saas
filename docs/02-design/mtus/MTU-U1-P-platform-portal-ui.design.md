# MTU-U1-P: 플랫폼 포털 UI 확장 — 설계 문서

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-U1-P |
| Phase | Phase P-UI (M4~M7) |
| 상태 | In Progress |
| 버전 | 2.0.0 |
| 작성일 | 2026-04-05 |
| 최종 수정 | 2026-04-05 |
| Plan 참조 | `docs/01-plan/mtus/MTU-U1-P-platform-portal-ui.plan.md` |
| 기반 문서 | `docs/archive/2026-04/MTU-U1-ui-design-system/MTU-U1-ui-design-system.design.md` (MTU-U1 원본 설계 — 읽기 전용) |
| 검증 데모 | `docs/demo/platform-portal-demo.html` (v2 브라우저 검증 완료) |
| 의존 MTU | MTU-U1 (디자인 시스템 완료), MTU-P01~P04 |

---

## Executive Summary (4관점 테이블)

| 관점 | 설계 결정 | 근거 | 달성 지표 |
|------|---------|------|---------|
| **슈퍼 어드민** | 좌측 레일(40px) + 동적 사이드바(240px) 이중 레이어 관리 UI | 서비스 50개 이상에서도 레이아웃 안정 | 레일 전환 300ms 이내 |
| **테넌트 고객** | 서비스 레일 스위처 + 서비스 마켓플레이스 허브 | 2클릭으로 서비스 전환 UX 달성 | 클릭 수 ≤ 2회 |
| **개발자** | SDK `registerService()` → 메뉴 자동 반영 | 재배포 없이 런타임 메뉴 동적 등록 | 재배포 불필요 |
| **규제** | MTU-U1 보안 갭 SG-01/SG-02 수정 선행 | CSAP D-06/D-08 위반 상태 이식 방지 | CRITICAL 2건 해결 |

---

## Design Anchor

**핵심 아키텍처 결정: App Shell + 확장형 레일 패턴 (v2.0 데모 검증)**

```
┌─ app-shell (flex column, 100vh) ──────────────────────────────────────────────┐
│  <navbar 56px>  테넌트명 | 글로벌 검색(Cmd+K)          [AI] [알림] [사용자]    │
├─ app-body (flex row, flex:1) ──────────────────────────────────────────────────┤
│                                                                                │
│ ┌─service-rail──┐  ┌─ main-area (flex:1, position:relative) ──────────────────┤
│ │ 52px(접힘)    │  │ ┌─ recent-tabs-bar (36px, 탭 히스토리) ──────────────── │
│ │ 200px(펼침)   │  │ └──────────────────────────────────────────────────────  │
│ │               │  │ ┌─ floating-sidebar (240px, absolute overlay) ─────────  │
│ │ [☰→←]        │  │ │  서비스 서브메뉴 플로팅 패널 (pin ↔ float 전환)        │
│ │ [대시보드]    │  │ └──────────────────────────────────────────────────────  │
│ │ [서비스A]     │  │ ┌─ main-content (overflow-y:auto) ────────────────────── │
│ │ [서비스A명]   │  │ │  페이지 콘텐츠                                          │
│ │ [서비스B]     │  │ └──────────────────────────────────────────────────────  │
│ │ [서비스B명]   │  └───────────────────────────────────────────────────────── │
│ │ [⋮ 더보기]   │                                                               │
│ │ ─────────── │  ┌─ ai-panel (260~600px, flex-shrink:0) ──────────────────── │
│ │ [AI ✦]      │  │  [← resize-handle]  AI 대화창 (슬라이드 인/아웃)           │
│ │ [알림 🔔]    │  │  우측에서 슬라이드, 드래그 리사이즈                        │
│ │ [설정 ⚙]    │  └──────────────────────────────────────────────────────────  │
│ └───────────────┘                                                              │
├─ bottom-tab (56px, 모바일 전용) ──────────────────────────────────────────────┤
│  [홈] [서비스] [AI] [알림] [설정]                                              │
└────────────────────────────────────────────────────────────────────────────────┘
```

**CSS 토큰 (Design Tokens)**:

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--rail-w` | `52px` | 레일 접힌 상태 폭 |
| `--rail-expanded-w` | `200px` | 레일 펼친 상태 폭 |
| `--tabs-h` | `36px` | 최근 탭 바 높이 |
| `--sidebar-w` | `240px` | 플로팅 사이드바 폭 |
| `--ai-panel-w` | `360px` | AI 패널 기본 폭 |
| `--navbar-h` | `56px` | 상단 네비게이션 바 높이 |
| `--bottom-tab-h` | `56px` | 하단 탭바 높이 (모바일) |

**선택 근거**:
- `flex column → flex row` 중첩으로 레이아웃 안정성 확보 (CSS Grid 미사용 — 크로스 브라우저 호환)
- recent-tabs-bar를 main-area 첫 번째 자식으로 배치 → 레일 너비와 독립, 자동 정렬
- FloatingSidebar `position:absolute` → 콘텐츠 위에 오버레이, pin 시 flex 형제로 전환
- AI 패널 `flex-shrink:0` → 본문을 밀어내는 슬라이드 효과 (overlay 아님)
- GitHub, Linear, Notion, Slack 등 검증된 엔터프라이즈 SaaS 패턴
- KRDS(범정부 UI/UX 디자인 시스템) 좌측 탐색 패턴 + 공공기관 현장 모바일 지원

---

## A. MTU-U1 보안 갭 수정 (SG-01, SG-02) — 선행 작업

> **우선순위 P0**: 플랫폼 UI 구현 전 CRITICAL 보안 이슈 반드시 수정

### A.1 SG-01 수정: 감사 로그 Prisma DB 기록 (CSAP D-06)

```typescript
// Design Ref: §A.1
// CSAP: D-06 (침해사고 관리)
// 수정 대상: lib/ai/provider.ts의 console.log → DB 기록으로 교체

// lib/audit/audit-logger.ts (수정)
import { db } from '@/lib/db'

export async function auditLog(entry: AuditEntry): Promise<void> {
  // 운영 환경: Prisma DB append-only 기록
  if (process.env.NODE_ENV === 'production') {
    await db.auditLog.create({
      data: {
        actor: entry.actor,
        action: entry.action,
        target: entry.target ?? null,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        timestamp: new Date(),
        // 무결성 체인: 직전 로그 해시값 포함
        prevHash: await getLastLogHash(),
      }
    })
  } else {
    // 개발 환경: 콘솔 출력 허용
    console.log('[AUDIT]', entry)
  }
}

// Prisma 모델 (schema.prisma에 추가)
// model AuditLog {
//   id        String   @id @default(cuid())
//   actor     String
//   action    String
//   target    String?
//   ip        String?
//   userAgent String?
//   metadata  String?  // JSON
//   prevHash  String?  // SHA-256 체인
//   timestamp DateTime @default(now())
//   @@index([actor, timestamp])
//   @@index([action, timestamp])
// }
```

### A.2 SG-02 수정: 대시보드 API 인증 + IDOR 방지 (CSAP D-08)

```typescript
// Design Ref: §A.2
// CSAP: D-08 (접근 통제)
// 수정 대상: app/api/dashboard/layout/route.ts

// Before (취약): 인증 없이 dashboardId로 직접 조회
// After (수정): JWT 검증 + 소유권 확인

export async function GET(req: Request) {
  // 1. JWT 인증 필수
  const user = await verifyToken(req.headers.get('Authorization'))
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { dashboardId } = await req.json()

  // 2. IDOR 방지: 요청자의 테넌트 내 대시보드인지 확인
  const dashboard = await db.dashboardLayout.findFirst({
    where: {
      id: dashboardId,
      userId: user.id,          // 소유자 검증
      tenantId: user.tenantId,  // 테넌트 격리
    }
  })

  if (!dashboard) {
    await auditLog({ actor: user.id, action: 'DASHBOARD_ACCESS_DENIED', target: dashboardId, ip: getClientIP(req) })
    return Response.json({ error: 'Not Found' }, { status: 404 })
  }

  return Response.json(dashboard.layout)
}
```

---

## B. 유기체(Organism) 컴포넌트 5종

> MTU-U1 Gap G-01 해결: 유기체 계층 완전 구현

### B.1 ServiceRail — 서비스 레일 (확장형, FR-UP.22)

> **v2 변경사항**: 고정 40px → 52px(접힘) ↔ 200px(펼침) 토글 지원
> 펼친 상태에서 서비스 이름 표시 → 별도 교육 없이 직관적 탐색

```typescript
// Design Ref: §B.1
// Plan FR: FR-UP.1, FR-UP.2, FR-UP.3, FR-UP.22
// 파일: components/organisms/ServiceRail.tsx

interface ServiceRailProps {
  items: ServiceRailItem[]
  activeServiceId?: string
  onServiceSelect: (serviceId: string) => void
  expanded: boolean               // 외부에서 제어 (앱 레벨 상태)
  onToggleExpand: () => void      // 토글 콜백
  maxVisible?: number             // 기본값 10
}

// 레일 폭 CSS 규칙 (design token 기반)
// .service-rail              { width: var(--rail-w, 52px); transition: width 250ms ease; }
// .service-rail.expanded     { width: var(--rail-expanded-w, 200px); }
// .service-rail .rail-label  { opacity: 0; width: 0; overflow: hidden; }
// .service-rail.expanded .rail-label { opacity: 1; width: auto; }

export function ServiceRail({
  items, activeServiceId, onServiceSelect, expanded, onToggleExpand, maxVisible = 10
}: ServiceRailProps) {
  const visibleItems = items.slice(0, maxVisible)
  const overflowItems = items.slice(maxVisible)

  return (
    <nav
      className={cn(
        "service-rail flex flex-col h-full bg-[--color-sidebar-bg] border-r border-[--color-border] py-3 gap-1",
        expanded && "expanded"
      )}
      style={{ width: expanded ? 'var(--rail-expanded-w)' : 'var(--rail-w)' }}
      aria-label="서비스 탐색"
    >
      {/* 확장/접기 토글 버튼 */}
      <button
        onClick={onToggleExpand}
        className="rail-toggle flex items-center justify-center w-9 h-9 mx-auto rounded-md hover:bg-[--color-hover] mb-1"
        aria-label={expanded ? '메뉴 접기' : '메뉴 펼치기'}
        title={expanded ? '접기' : '서비스 목록 펼치기'}
      >
        <span className="text-sm">{expanded ? '←' : '☰'}</span>
      </button>

      <Separator className="my-1 mx-3" />

      {/* 대시보드 (항상 첫 번째) */}
      <RailItem
        id="dashboard"
        icon={LayoutDashboard}
        label="대시보드"
        href="/dashboard"
        isActive={activeServiceId === 'dashboard'}
        showLabel={expanded}
        onSelect={onServiceSelect}
      />

      <Separator className="my-1 mx-3" />

      {/* 구독 서비스 목록 */}
      {visibleItems.map(item => (
        <RailItem
          key={item.id}
          {...item}
          isActive={item.id === activeServiceId}
          showLabel={expanded}      // 펼침 상태에서 서비스 이름 표시
          onSelect={onServiceSelect}
        />
      ))}

      {/* 10개 초과 시 더보기 팝오버 */}
      {overflowItems.length > 0 && (
        <ServiceOverflowPopover
          items={overflowItems}
          onSelect={onServiceSelect}
          activeServiceId={activeServiceId}
        />
      )}

      {/* 하단 고정 아이콘 */}
      <div className="mt-auto flex flex-col gap-1">
        <RailItem id="ai" icon={Sparkles} label="AI 어시스턴트" showLabel={expanded} onSelect={onServiceSelect} />
        <RailItem id="notifications" icon={Bell} label="알림" showLabel={expanded} onSelect={onServiceSelect} />
        <RailItem id="settings" icon={Settings} label="설정" showLabel={expanded} onSelect={onServiceSelect} />
      </div>
    </nav>
  )
}

// RailItem: 접힘 = 아이콘+툴팁, 펼침 = 아이콘+이름 나란히
function RailItem({ id, icon: Icon, label, showLabel, isActive, onSelect }: RailItemProps) {
  return (
    <button
      onClick={() => onSelect(id)}
      title={!showLabel ? label : undefined}   // 접힘 상태에서만 툴팁
      className={cn(
        "flex items-center gap-2 px-2 py-2 rounded-md w-full transition-colors",
        isActive ? "bg-[--color-primary-subtle] text-[--color-primary]" : "hover:bg-[--color-hover]"
      )}
    >
      <Icon className="size-5 shrink-0" />
      {showLabel && (
        <span className="rail-label text-sm font-medium truncate">{label}</span>
      )}
    </button>
  )
}
```

**서비스 수에 따른 렌더링 전략**:

| 서비스 수 | 접힘 상태 | 펼침 상태 |
|---------|---------|---------|
| 1~5개 | 아이콘 + 툴팁 | 아이콘 + 이름 |
| 6~10개 | 아이콘 + 툴팁 | 아이콘 + 이름 스크롤 |
| 11개+ | 10개 + 더보기 팝오버 | 10개 + 더보기 + Cmd+K 검색 유도 |

### B.2 FloatingSidebar — 플로팅 사이드바 (FR-UP.23)

> **v2 변경사항**: 고정형 사이드바 → 메인 콘텐츠 위에 떠오르는 플로팅 패널  
> 기본: `position:absolute` 오버레이 / 핀 버튼으로 flex 형제(콘텐츠 밀기) 전환

```typescript
// Design Ref: §B.2
// Plan FR: FR-UP.3, FR-UP.23
// 파일: components/organisms/FloatingSidebar.tsx

type SidebarMode = 'floating' | 'pinned'  // floating=오버레이, pinned=콘텐츠 밀기

interface FloatingSidebarProps {
  sections: SidebarMenuSection[]
  serviceName: string
  serviceIcon?: React.ComponentType<{ className?: string }>
  isOpen: boolean
  mode: SidebarMode
  onClose: () => void
  onToggleMode: (mode: SidebarMode) => void   // floating ↔ pinned 전환
}

// CSS 레이아웃 규칙:
// floating 모드: position:absolute; top:0; left:0; height:100%; z-index:100
//   .main-area { position:relative; }  → 기준 컨텍스트
//   .floating-sidebar { position:absolute; ... }  → main-area 위에 오버레이
// pinned 모드: position:relative; (flex 형제로 삽입) → 본문을 오른쪽으로 밀기

export function FloatingSidebar({
  sections, serviceName, serviceIcon: ServiceIcon,
  isOpen, mode, onClose, onToggleMode
}: FloatingSidebarProps) {
  if (!isOpen) return null

  return (
    <aside
      className={cn(
        "floating-sidebar flex flex-col bg-[--color-sidebar-bg] border-r border-[--color-border] shadow-lg",
        "w-[var(--sidebar-w)] transition-transform",
        mode === 'floating' && "absolute top-0 left-0 h-full z-[100]",
        mode === 'pinned' && "relative shrink-0"
      )}
      aria-label={`${serviceName} 서브메뉴`}
    >
      {/* 사이드바 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[--color-border]">
        <div className="flex items-center gap-2">
          {ServiceIcon && <ServiceIcon className="size-4 text-[--color-primary]" />}
          <span className="font-semibold text-sm truncate">{serviceName}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* 핀/언핀 버튼 */}
          <button
            onClick={() => onToggleMode(mode === 'pinned' ? 'floating' : 'pinned')}
            className="p-1 rounded hover:bg-[--color-hover]"
            title={mode === 'pinned' ? '고정 해제 (플로팅 모드)' : '고정 (본문 밀기 모드)'}
            aria-label={mode === 'pinned' ? '사이드바 고정 해제' : '사이드바 고정'}
          >
            <span className="text-xs">{mode === 'pinned' ? '📌' : '📍'}</span>
          </button>
          {/* 닫기 버튼 (floating 모드에서만) */}
          {mode === 'floating' && (
            <button onClick={onClose} className="p-1 rounded hover:bg-[--color-hover]" aria-label="닫기">
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* 메뉴 섹션 */}
      <nav className="flex-1 overflow-y-auto py-2">
        {sections.map((section, i) => (
          <SidebarSection key={i} section={section} />
        ))}
      </nav>
    </aside>
  )
}
```

**동작 매트릭스**:

| 상태 | 레이아웃 | 본문 영향 | 닫기 방법 |
|------|---------|---------|---------|
| `floating` (기본) | `position:absolute` z-index:100 | 영향 없음 (오버레이) | 닫기 버튼 or 외부 클릭 |
| `pinned` | flex 형제 (flex-shrink:0) | 본문 우측으로 밀림 | 핀 해제 버튼 |
| 모바일 (`≤768px`) | `position:fixed` 하단 시트 | 오버레이 (영향 없음) | 스와이프 다운 or 닫기 |

### B.3 AppNavbar — 글로벌 상단 바

```typescript
// Design Ref: §B.3
// Plan FR: FR-UP.10
// 파일: components/organisms/AppNavbar.tsx

export function AppNavbar({ tenantName, user }: AppNavbarProps) {
  return (
    <header className="h-14 border-b border-[--color-border] bg-[--color-header-bg] flex items-center px-4 gap-4">
      {/* 테넌트명 + 구독 플랜 뱃지 */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-semibold text-sm truncate">{tenantName}</span>
        <SubscriptionPlanBadge plan={user.tenantPlan} />
      </div>

      {/* 글로벌 검색 (Cmd+K) */}
      <GlobalSearchTrigger className="flex-1 max-w-md" />

      <div className="flex items-center gap-2 ml-auto">
        {/* AI 어시스턴트 트리거 */}
        <AiAssistantTrigger />
        {/* 알림 */}
        <NotificationBell count={user.unreadNotifications} />
        {/* 사용자 메뉴 */}
        <UserMenu user={user} />
        {/* 테마 토글 */}
        <ThemeToggle />
      </div>
    </header>
  )
}
```

### B.4 TenantDataGrid — 테넌트 관리 그리드

```typescript
// Design Ref: §B.4
// Plan FR: FR-UP.4, FR-UP.11
// 파일: components/organisms/TenantDataGrid.tsx
// TanStack Table v8 + CSAP D-08 컬럼 필터 + 페이지네이션

export function TenantDataGrid({ data, onTenantAction }: TenantDataGridProps) {
  const columns: ColumnDef<Tenant>[] = [
    columnHelper.accessor('name', { header: '테넌트명', cell: info => <TenantNameCell tenant={info.row.original} /> }),
    columnHelper.accessor('plan', { header: '구독 플랜', cell: info => <PlanBadge plan={info.getValue()} /> }),
    columnHelper.accessor('status', { header: '상태', cell: info => <StatusIndicator status={info.getValue()} /> }),
    columnHelper.accessor('userCount', { header: '사용자 수' }),
    columnHelper.accessor('csapCompliance', { header: 'CSAP 준수율', cell: info => <ComplianceGauge value={info.getValue()} /> }),
    columnHelper.display({ id: 'actions', cell: info => <TenantActionMenu tenant={info.row.original} onAction={onTenantAction} /> }),
  ]
  // ... TanStack Table 구현
}
```

### B.5 ComplianceMatrix — CSAP/N2SF/ISMS-P 매트릭스

```typescript
// Design Ref: §B.5
// Plan FR: FR-UP.14
// 파일: components/organisms/ComplianceMatrix.tsx

export function ComplianceMatrix({ csapItems, n2sfAreas, ismsPItems }: ComplianceMatrixProps) {
  return (
    <div className="grid gap-6">
      {/* CSAP 79항목 진척률 */}
      <ComplianceDomainSection
        title="CSAP 표준등급 (79항목)"
        domains={csapItems}
        totalLabel="79항목"
      />
      {/* N2SF 6영역 */}
      <ComplianceDomainSection
        title="N2SF 보안 영역 (6영역)"
        domains={n2sfAreas}
        totalLabel="6영역"
      />
      {/* ISMS-P 101항목 */}
      <ComplianceDomainSection
        title="ISMS-P (101항목)"
        domains={ismsPItems}
        totalLabel="101항목"
      />
    </div>
  )
}
```

---

## C. 동적 서비스 메뉴 — 규모별 UX 전략

> 비즈니스 서비스가 증가할 때 UX 붕괴를 막는 단계별 전략

### C.1 서비스 수에 따른 UX 전환점

| 서비스 수 | UX 패턴 | 핵심 컴포넌트 |
|---------|---------|------------|
| **1~5개** | 레일에 모두 표시 (라벨 표시) | `ServiceRail` (라벨 모드) |
| **6~15개** | 레일에 아이콘만 표시 (툴팁) + 모두 표시 | `ServiceRail` (아이콘 모드) |
| **16~50개** | 10개 + "더 보기" 팝오버 + Cmd+K 검색 | `ServiceRail` + `ServiceOverflowPopover` |
| **50개+** | 카테고리 그룹 팝오버 + 태그 필터 + 검색 | `ServiceCatalogPopover` |

### C.2 서비스 카테고리 표준 (공공기관)

```typescript
// Design Ref: §C.2
// 서비스 카테고리 — SDK registerService()의 category 필드

export const SERVICE_CATEGORIES = {
  TASK: { id: 'task', label: '업무 관리', icon: ClipboardList, color: 'blue' },
  DOCUMENT: { id: 'document', label: '문서 관리', icon: FileText, color: 'green' },
  CUSTOMER: { id: 'customer', label: '고객/민원', icon: Users, color: 'purple' },
  ANALYTICS: { id: 'analytics', label: '분석 & BI', icon: BarChart2, color: 'orange' },
  AI: { id: 'ai', label: 'AI 서비스', icon: Sparkles, color: 'violet' },
  SYSTEM: { id: 'system', label: '시스템 관리', icon: Settings, color: 'gray' },
} as const
```

### C.3 서비스 오버플로 팝오버

```typescript
// Design Ref: §C.3
// Plan FR: FR-UP.2
// 파일: components/organisms/ServiceOverflowPopover.tsx

export function ServiceOverflowPopover({ items, onSelect, activeServiceId }: ServiceOverflowPopoverProps) {
  const [search, setSearch] = useState('')
  const byCategory = groupBy(items.filter(i => i.name.includes(search)), 'category')

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="rail-item" aria-label="더 많은 서비스">
          <MoreHorizontal className="size-5" />
          {/* 오버플로 서비스 중 활성 서비스가 있으면 인디케이터 표시 */}
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" className="w-72 p-2">
        {/* 검색 인풋 */}
        <Input
          placeholder="서비스 검색... (Cmd+K)"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="mb-2"
        />
        {/* 카테고리별 서비스 목록 */}
        {Object.entries(byCategory).map(([category, services]) => (
          <ServiceCategoryGroup
            key={category}
            category={SERVICE_CATEGORIES[category as ServiceCategory]}
            services={services}
            onSelect={onSelect}
            activeServiceId={activeServiceId}
          />
        ))}
        {/* 서비스 마켓플레이스 바로가기 */}
        <Separator className="my-2" />
        <Link href="/marketplace" className="text-xs text-[--color-text-secondary] flex items-center gap-1 px-2 py-1">
          <Plus className="size-3" /> 서비스 추가하기
        </Link>
      </PopoverContent>
    </Popover>
  )
}
```

---

## D. 관리자 포털 핵심 페이지 컴포넌트

### D.1 BillingDashboard — 빌링 대시보드

```typescript
// Design Ref: §D.1
// Plan FR: FR-UP.5
// 파일: components/organisms/BillingDashboard.tsx

export function BillingDashboard({ metrics }: BillingDashboardProps) {
  return (
    <div className="space-y-6">
      {/* KPI 카드 4종 */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard title="월 수익" value={metrics.mrr} unit="원" trend={metrics.mrrTrend} />
        <KpiCard title="활성 구독" value={metrics.activeSubscriptions} trend={metrics.subscriptionTrend} />
        <KpiCard title="신규 테넌트" value={metrics.newTenants} period="이번달" />
        <KpiCard title="이탈률" value={metrics.churnRate} unit="%" trend={metrics.churnTrend} negative />
      </div>

      {/* 수익 추이 차트 (Recharts or Visx) */}
      <RevenueChart data={metrics.revenueHistory} />

      {/* 플랜별 분포 */}
      <PlanDistributionChart data={metrics.planDistribution} />

      {/* 최근 인보이스 목록 */}
      <InvoiceTable invoices={metrics.recentInvoices} />
    </div>
  )
}
```

### D.2 ServiceCatalogGrid — SaaS 서비스 카탈로그

```typescript
// Design Ref: §D.2
// Plan FR: FR-UP.7, FR-UP.8
// 파일: components/organisms/ServiceCatalogGrid.tsx
// 관리자 포털(등록/관리)과 테넌트 포털(마켓플레이스) 공용

export function ServiceCatalogGrid({
  services,
  mode,  // 'admin' | 'marketplace'
  onServiceAction
}: ServiceCatalogGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | 'all'>('all')
  const filtered = services.filter(s => selectedCategory === 'all' || s.category === selectedCategory)

  return (
    <div>
      {/* 카테고리 필터 탭 */}
      <CategoryFilterTabs
        categories={Object.values(SERVICE_CATEGORIES)}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />

      {/* 서비스 카드 그리드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
        {filtered.map(service => (
          <ServiceCard
            key={service.id}
            service={service}
            mode={mode}
            onAction={onServiceAction}
          />
        ))}
      </div>
    </div>
  )
}

function ServiceCard({ service, mode, onAction }: ServiceCardProps) {
  return (
    <div className="rounded-lg border border-[--color-border] bg-[--color-surface] p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <service.icon className="size-8 text-[--color-primary]" />
          <div>
            <p className="font-semibold text-sm">{service.name}</p>
            <CategoryBadge category={service.category} />
          </div>
        </div>
        {mode === 'admin' && <ServiceStatusToggle serviceId={service.id} status={service.status} />}
      </div>

      <p className="text-xs text-[--color-text-secondary] mb-4 line-clamp-2">{service.description}</p>

      {mode === 'marketplace' ? (
        <SubscribeButton service={service} onSubscribe={onAction} />
      ) : (
        <AdminServiceActions service={service} onAction={onAction} />
      )}
    </div>
  )
}
```

---

## E. 테넌트 포털 — 서비스 허브

### E.1 SubscriptionWizard — 구독 신청 위저드

```typescript
// Design Ref: §E.1
// Plan FR: FR-UP.8
// 파일: components/organisms/SubscriptionWizard.tsx
// 3단계: 서비스 선택 → 플랜 선택 → 확인

const WIZARD_STEPS = ['서비스 선택', '플랜 선택', '확인 및 구독'] as const

export function SubscriptionWizard({ service, onComplete, onCancel }: SubscriptionWizardProps) {
  const [step, setStep] = useState(0)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)

  return (
    <div className="max-w-2xl mx-auto">
      {/* 스텝 인디케이터 */}
      <WizardStepIndicator steps={WIZARD_STEPS} currentStep={step} />

      {/* 스텝별 콘텐츠 */}
      {step === 0 && <ServicePreviewStep service={service} onNext={() => setStep(1)} />}
      {step === 1 && (
        <PlanSelectionStep
          plans={service.plans}
          selected={selectedPlan}
          onSelect={setSelectedPlan}
          onNext={() => setStep(2)}
          onBack={() => setStep(0)}
        />
      )}
      {step === 2 && (
        <SubscriptionConfirmStep
          service={service}
          plan={selectedPlan!}
          onConfirm={() => { onComplete(selectedPlan!) }}
          onBack={() => setStep(1)}
        />
      )}
    </div>
  )
}
```

---

## F. 페이지 템플릿 3종

> MTU-U1 Gap G-02 해결

### F.1 AdminPageTemplate

```typescript
// Design Ref: §F.1
// Plan FR: FR-UP.15
// 파일: components/templates/AdminPageTemplate.tsx

interface AdminPageTemplateProps {
  title: string
  subtitle?: string
  breadcrumbs?: BreadcrumbItem[]
  actions?: React.ReactNode  // 우상단 액션 버튼
  children: React.ReactNode
}

export function AdminPageTemplate({ title, subtitle, breadcrumbs, actions, children }: AdminPageTemplateProps) {
  return (
    <div className="flex flex-col h-full">
      {/* 페이지 헤더 */}
      <div className="flex items-start justify-between px-6 py-4 border-b border-[--color-border]">
        <div>
          {breadcrumbs && <Breadcrumb items={breadcrumbs} className="mb-1" />}
          <h1 className="text-xl font-bold text-[--color-text-primary]">{title}</h1>
          {subtitle && <p className="text-sm text-[--color-text-secondary] mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* 페이지 콘텐츠 */}
      <main className="flex-1 overflow-auto p-6" id="main-content">
        {children}
      </main>
    </div>
  )
}
```

### F.2 TenantPageTemplate

```typescript
// Design Ref: §F.2
// Plan FR: FR-UP.16
// 파일: components/templates/TenantPageTemplate.tsx
// 테넌트 브랜딩(테마) + 서비스 컨텍스트 포함

export function TenantPageTemplate({ serviceName, sections, children, actions }: TenantPageTemplateProps) {
  return (
    <div className="flex flex-col h-full">
      {/* 서비스 컨텍스트 헤더 */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[--color-border]">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[--color-text-secondary]">{serviceName}</span>
          {sections && <BreadcrumbSeparator />}
          {sections?.map((s, i) => (
            <span key={i} className="text-sm text-[--color-text-primary]">{s}</span>
          ))}
        </div>
        {actions}
      </div>
      <main className="flex-1 overflow-auto p-6" id="main-content">{children}</main>
    </div>
  )
}
```

### F.3 DashboardTemplate

```typescript
// Design Ref: §F.3
// Plan FR: FR-UP.17
// dnd-kit 기반 위젯 그리드 + 위젯 추가/제거

export function DashboardTemplate({ widgets, onLayoutChange, availableWidgets }: DashboardTemplateProps) {
  return (
    <div className="p-6">
      {/* 위젯 추가 컨트롤 */}
      <div className="flex justify-end mb-4">
        <AddWidgetButton availableWidgets={availableWidgets} onAdd={/* handler */} />
      </div>
      {/* dnd-kit 위젯 그리드 (MTU-U1 S4 기반) */}
      <DashboardProvider initialWidgets={widgets} onLayoutChange={onLayoutChange}>
        <DashboardGrid />
      </DashboardProvider>
    </div>
  )
}
```

---

## G. 모바일 네비게이션

### G.1 BottomTabBar — 하단 탭바 (공공기관 현장 업무)

```typescript
// Design Ref: §G.1
// Plan FR: FR-UP.18
// 파일: components/organisms/BottomTabBar.tsx

const BOTTOM_TABS = [
  { id: 'home', label: '홈', icon: Home, href: '/dashboard' },
  { id: 'services', label: '서비스', icon: Grid3x3, href: '/services' },
  { id: 'ai', label: 'AI', icon: Sparkles, href: '/ai' },
  { id: 'notifications', label: '알림', icon: Bell, href: '/notifications' },
  { id: 'settings', label: '설정', icon: Settings, href: '/settings' },
] as const

export function BottomTabBar({ activeTab, notificationCount }: BottomTabBarProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 h-16 bg-[--color-surface-raised] border-t border-[--color-border] flex items-center safe-area-pb md:hidden"
      aria-label="주요 메뉴"
    >
      {BOTTOM_TABS.map(tab => (
        <Link
          key={tab.id}
          href={tab.href}
          className={cn(
            "flex-1 flex flex-col items-center gap-1 py-2 min-h-[44px]",  // 44px 최소 터치 타겟
            activeTab === tab.id ? "text-[--color-primary]" : "text-[--color-text-secondary]"
          )}
          aria-current={activeTab === tab.id ? 'page' : undefined}
        >
          <div className="relative">
            <tab.icon className="size-5" />
            {tab.id === 'notifications' && notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 size-4 bg-[--color-danger] text-white text-[10px] rounded-full flex items-center justify-center">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium">{tab.label}</span>
        </Link>
      ))}
    </nav>
  )
}
```

---

## H. 파일 구조 매핑

> `platform/packages/ui/src/` 기준

```
platform/packages/ui/src/
│
├── atoms/                        # MTU-U1 기존 (변경 없음)
│   ├── button.tsx
│   ├── badge.tsx
│   ├── input.tsx
│   └── ...
│
├── molecules/                    # MTU-U1 기존 (변경 없음)
│   ├── data-table.tsx
│   ├── form-field.tsx
│   └── ...
│
├── organisms/                    # ★ MTU-U1-P 신규 (G-01 해결)
│   ├── ServiceRail.tsx           # FR-UP.1~3, B.1
│   ├── ContextualSidebar.tsx     # FR-UP.3, B.2
│   ├── AppNavbar.tsx             # FR-UP.10, B.3
│   ├── TenantDataGrid.tsx        # FR-UP.4, FR-UP.11, B.4
│   ├── ComplianceMatrix.tsx      # FR-UP.14, B.5
│   ├── BillingDashboard.tsx      # FR-UP.5, D.1
│   ├── ServiceCatalogGrid.tsx    # FR-UP.7~8, D.2
│   └── SubscriptionWizard.tsx    # FR-UP.8, E.1
│
├── templates/                    # ★ MTU-U1-P 신규 (G-02 해결)
│   ├── AdminPageTemplate.tsx     # FR-UP.15, F.1
│   ├── TenantPageTemplate.tsx    # FR-UP.16, F.2
│   └── DashboardTemplate.tsx     # FR-UP.17, F.3
│
├── mobile/                       # ★ MTU-U1-P 신규
│   ├── BottomTabBar.tsx          # FR-UP.18, G.1
│   └── ServiceListSheet.tsx      # FR-UP.19
│
└── public-saas/                  # MTU-U1 기존 + 신규 추가
    ├── CsapStatusBadge.tsx       # 기존
    ├── N2sfGradeIndicator.tsx    # 기존
    ├── AuditTrailViewer.tsx      # 기존
    ├── AiAssistantPanel.tsx      # 기존
    ├── ServiceOverflowPopover.tsx # ★ 신규 (C.3)
    └── SubscriptionPlanBadge.tsx  # ★ 신규
```

---

## I. 추적성 매트릭스

| FR ID | 설계 섹션 | 컴포넌트/파일 | 테스트 | CSAP |
|-------|---------|------------|--------|------|
| FR-UP.1~3 | §B.1, §C | ServiceRail.tsx, ServiceOverflowPopover.tsx | rail.spec.tsx | - |
| FR-UP.4, 11 | §B.4 | TenantDataGrid.tsx | datagrid.spec.tsx | D-08 |
| FR-UP.5 | §D.1 | BillingDashboard.tsx | billing.spec.tsx | - |
| FR-UP.6 | §B.5 | ComplianceMatrix.tsx | compliance.spec.tsx | D-06 |
| FR-UP.7~8 | §D.2, §E.1 | ServiceCatalogGrid.tsx, SubscriptionWizard.tsx | catalog.spec.tsx | - |
| FR-UP.9 | §E | ServiceHubCard.tsx | hub.spec.tsx | - |
| FR-UP.10 | §B.3 | AppNavbar.tsx | navbar.spec.tsx | D-08 |
| FR-UP.12 | §B.1 | ServiceRail.tsx | rail.spec.tsx | - |
| FR-UP.13 | §B.2 | ContextualSidebar.tsx | sidebar.spec.tsx | - |
| FR-UP.14 | §B.5 | ComplianceMatrix.tsx | compliance.spec.tsx | - |
| FR-UP.15~17 | §F | *PageTemplate.tsx, DashboardTemplate.tsx | template.spec.tsx | - |
| FR-UP.18~19 | §G | BottomTabBar.tsx, ServiceListSheet.tsx | mobile.spec.tsx | - |
| FR-UP.20 | §A.1 | lib/audit/audit-logger.ts | audit.csap.spec.ts | **D-06** |
| FR-UP.21 | §A.2 | api/dashboard/layout/route.ts | auth.csap.spec.ts | **D-08** |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — MTU-U1 Gap 해결 + 플랫폼 포털 UI 설계 | PM Agent (CTO팀 검토) |
