# Portal 앱 심화 학습

> **문서 ID**: ONBOARD-02-SVC-17
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **작성자**: Implementer (Sonnet)
> **실제 파일 위치**: `/data/ai-saas/platform/apps/portal/`
> **예상 학습 시간**: 2시간 30분
> **CSAP 매핑**: D-08 (접근 통제), D-12 (시스템 개발 보안 — XSS/CSP)
> **Design Ref**: DESIGN-MTU-U1-P, DESIGN-MTU-P16a, DESIGN-MTU-P17, L-04-CSP-NONCE.design.md
> **Plan SC**: FR-UP.1 ~ FR-UP.27, FR-L04.1 ~ FR-L04.4

---

## 1. 역할 및 개요

포털 앱은 공공기관 SaaS 플랫폼의 유일한 사용자 접점(Front Door)입니다. 플랫폼 운영자와 기관 담당자가 모두 이 포털을 통해 서비스를 사용합니다.

**핵심 역할:**
- 플랫폼 관리자 포털: 테넌트, 사용자, 결제, CSAP 준수 현황 관리
- 테넌트(기관) 포털: 서비스 구독, 사용 현황, AI 어시스턴트
- 인증 흐름 UI: JWT 기반 로그인 → 세션 → 역할 기반 페이지 접근 통제
- AI 사이드 패널: RAG 기반 AI 어시스턴트 인터페이스

---

## 2. Next.js 15 App Router 디렉터리 구조

```
platform/apps/portal/src/
├── app/                          # App Router 루트
│   ├── layout.tsx                # 루트 레이아웃 (CSP nonce 주입)
│   ├── page.tsx                  # 홈 (관리자 대시보드 진입)
│   ├── admin/                    # 관리자 포털 페이지
│   │   ├── dashboard/page.tsx    # 플랫폼 통계 대시보드
│   │   ├── users/page.tsx        # 사용자 관리
│   │   ├── tenants/page.tsx      # 테넌트 관리
│   │   ├── billing/              # 청구·결제 관리
│   │   ├── catalog/              # 서비스 카탈로그 관리
│   │   ├── compliance/           # CSAP 준수 현황
│   │   ├── security/             # 보안 모니터링
│   │   ├── audit/                # 감사 로그 조회
│   │   ├── crm/                  # CRM 관리
│   │   ├── menus/                # 메뉴 관리
│   │   ├── notifications/        # 알림 관리
│   │   ├── files/                # 파일 관리
│   │   ├── subscriptions/        # 구독 관리
│   │   └── ai/                   # AI 관리
│   ├── tenant/                   # 테넌트 포털 페이지
│   │   ├── dashboard/page.tsx    # 테넌트 대시보드
│   │   ├── services/             # 서비스 목록
│   │   ├── marketplace/          # 서비스 마켓플레이스
│   │   ├── users/                # 기관 내 사용자 관리
│   │   ├── settings/             # 기관 설정
│   │   └── ai/                   # AI 어시스턴트
│   └── api/                      # Next.js Route Handlers (BFF)
│       ├── dashboard/stats/      # 플랫폼 통계 API
│       ├── compliance/csap/      # CSAP 준수 현황 API
│       ├── health/               # 헬스체크 API
│       ├── tenants/              # 테넌트 데이터 API
│       ├── users/                # 사용자 데이터 API
│       ├── subscriptions/        # 구독 데이터 API
│       └── audit-logs/           # 감사 로그 API
├── components/                   # 컴포넌트
│   ├── layout/                   # 레이아웃 컴포넌트
│   │   ├── AppShell.tsx          # 전체 레이아웃 껍데기 (Client Component)
│   │   ├── AppNavbar.tsx         # 상단 네비게이션 바
│   │   ├── ServiceRail.tsx       # 좌측 서비스 레일
│   │   ├── FloatingSidebar.tsx   # 플로팅 사이드바
│   │   └── RecentTabsBar.tsx     # 최근 방문 탭 바
│   ├── admin/                    # 관리자 포털 전용 컴포넌트
│   │   ├── AdminPageTemplate.tsx # 관리자 페이지 표준 레이아웃
│   │   ├── DashboardContent.tsx  # 대시보드 콘텐츠 (Server Component)
│   │   ├── ServiceCatalogGrid.tsx
│   │   └── TenantDataGrid.tsx
│   ├── tenant/                   # 테넌트 포털 전용 컴포넌트
│   │   ├── TenantPageTemplate.tsx
│   │   └── ServiceMarketplace.tsx
│   ├── common/                   # 공통 컴포넌트
│   │   ├── DataGrid.tsx          # 데이터 테이블 (정렬, 필터, 페이지네이션)
│   │   ├── ComplianceMatrix.tsx  # CSAP 준수 현황 표
│   │   └── AppNavbar.tsx
│   ├── ai/                       # AI 패널
│   │   └── AiSidePanel.tsx       # AI 어시스턴트 사이드 패널
│   └── mobile/                   # 모바일 전용
│       ├── BottomTabBar.tsx      # 모바일 하단 탭 바
│       └── SidebarBottomSheet.tsx
├── lib/                          # 유틸리티
│   ├── auth-guard.ts             # 인증 가드 (CSAP D-08)
│   └── prisma.ts                 # Prisma 클라이언트
├── middleware.ts                 # CSP nonce 미들웨어 (CSAP D-12)
└── styles/
    └── globals.css               # CSS 변수 기반 디자인 시스템
```

---

## 3. 관리자 포털 vs 테넌트 포털

```mermaid
graph TD
    HOME[/ 진입점] --> ADMIN[/admin/*\n관리자 포털]
    HOME --> TENANT[/tenant/*\n테넌트 포털]

    ADMIN --> AD[플랫폼 대시보드\n전체 테넌트 현황]
    ADMIN --> AU[사용자 관리\n전체 계정]
    ADMIN --> AT[테넌트 관리]
    ADMIN --> AB[청구·결제]
    ADMIN --> AC[CSAP 준수 현황\n79항목 매트릭스]
    ADMIN --> AS[보안 모니터링]

    TENANT --> TD[기관 대시보드\n구독 서비스 현황]
    TENANT --> TM[서비스 마켓플레이스]
    TENANT --> TU[기관 내 사용자]
    TENANT --> TS[기관 설정]
    TENANT --> TAI[AI 어시스턴트]

    style ADMIN fill:#e3f2fd
    style TENANT fill:#f3e5f5
```

**접근 권한 차이:**

| 항목 | 관리자 포털 | 테넌트 포털 |
|------|-----------|-----------|
| 대상 역할 | SUPER_ADMIN, ADMIN | TENANT_ADMIN, USER, VIEWER |
| 테넌트 범위 | 전체 또는 선택 | 본인 테넌트만 |
| 결제 관리 | 전체 인보이스 | 본인 기관 청구서 |
| CSAP 현황 | 플랫폼 전체 79항목 | 기관별 준수 현황 |
| 메뉴 관리 | 전체 테넌트 메뉴 | 본인 기관 메뉴 |

---

## 4. Server Component vs Client Component 구분

Next.js 15 App Router에서 컴포넌트를 서버/클라이언트로 올바르게 구분하는 것이 핵심입니다.

```mermaid
graph TD
    RSC[Server Component\n기본값] --> |DB 직접 접근| DB[(PostgreSQL)]
    RSC --> |API fetch| API[백엔드 서비스]
    CC[Client Component\n'use client' 선언] --> |인터랙션| BROWSER[브라우저 이벤트]
    CC --> |상태 관리| STATE[useState/useEffect]
```

**현재 구분 방식:**

| 컴포넌트 | 유형 | 이유 |
|---------|------|------|
| `layout.tsx` | Server Component | headers() 사용 (CSP nonce) |
| `DashboardContent.tsx` | Server Component | DB 데이터 fetch (Suspense 활용) |
| `AppShell.tsx` | Client Component | useState(rail, sidebar, AI 패널) |
| `ServiceRail.tsx` | Client Component | onClick, useState |
| `DataGrid.tsx` | Client Component | 정렬/필터/페이지네이션 상태 |
| `AiSidePanel.tsx` | Client Component | 채팅 UI 상태 |
| `BottomTabBar.tsx` | Client Component | 탭 선택 상태 |
| `/app/api/**` 라우트 | Route Handler | 서버 전용 API (BFF 레이어) |

---

## 5. 데이터 패칭 패턴

### 5.1 Server Component에서 직접 fetch (권장)

서버 컴포넌트에서 백엔드 API를 직접 호출하고 데이터를 UI에 렌더링합니다. 클라이언트에 민감한 데이터가 노출되지 않습니다.

```typescript
// DashboardContent.tsx 패턴 (서버 컴포넌트)
async function fetchDashboardStats(): Promise<DashboardStats | null> {
  const apiBase = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? 'http://localhost:4000';
  const response = await fetch(`${apiBase}/api/dashboard/stats`, {
    next: { revalidate: 30 },  // 30초 캐시
  });
  if (!response.ok) return null;
  return response.json();
}

// Suspense로 로딩 상태 처리
export function DashboardContent() {
  return (
    <Suspense fallback={<StatsSkeleton />}>
      <StatsCards />  {/* 내부에서 fetchDashboardStats() 호출 */}
    </Suspense>
  );
}
```

### 5.2 Route Handler (BFF 패턴)

포털의 `/app/api/` 경로는 Next.js Route Handler를 사용하는 BFF(Backend For Frontend) 레이어입니다.

```typescript
// /app/api/dashboard/stats/route.ts
export async function GET(): Promise<NextResponse> {
  // 1. 인증 검사 (CSAP D-08)
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  // 2. Prisma로 DB 직접 조회
  const [tenantCount, userCount] = await Promise.all([
    prisma.tenant.count({ where: { slug: { not: 'platform-internal' } } }),
    prisma.user.count({ ... }),
  ]);

  // 3. 에러 메시지에 내부 정보 미노출 (CSAP D-12)
  return NextResponse.json({ tenants: tenantCount, users: userCount });
}
```

### 5.3 캐시 전략

| 데이터 | revalidate | 이유 |
|--------|-----------|------|
| 대시보드 통계 | 30초 | 자주 변하지만 실시간 불필요 |
| CSAP 준수 현황 | 300초 (5분) | 변경 빈도 낮음 |
| 감사 로그 | no-cache | 항상 최신 데이터 필요 |
| 서비스 카탈로그 | 600초 (10분) | 변경 빈도 매우 낮음 |

---

## 6. 인증 흐름 (JWT → 세션 → UI)

```mermaid
sequenceDiagram
    participant Browser as 브라우저
    participant Portal as Portal App
    participant GW as API Gateway
    participant Auth as Auth Service

    Browser->>GW: POST /auth/login (email, password)
    GW->>Auth: 인증 요청
    Auth-->>GW: JWT (access: 15분, refresh: 7일)
    GW-->>Browser: Set-Cookie: jwt=...

    Browser->>GW: GET /api/dashboard/stats
    Note over GW: JWT 검증 후 헤더 주입
    GW->>Portal: x-user-id, x-user-tenant-id, x-user-role
    Portal->>Portal: getAuthContext() 호출
    Portal-->>Browser: 역할에 맞는 대시보드 렌더링
```

**`getAuthContext()` 함수** (`lib/auth-guard.ts`):

API 게이트웨이가 JWT를 검증하고 사용자 정보를 헤더로 주입합니다. 포털은 이 헤더를 신뢰하여 인증 컨텍스트를 구성합니다.

```
x-user-id      → userId
x-user-tenant-id → tenantId (SUPER_ADMIN은 없어도 허용)
x-user-role    → role (없으면 VIEWER로 폴백)
```

SUPER_ADMIN이 아닌데 `x-user-tenant-id`가 없으면 `null`을 반환하여 401을 응답합니다 (테넌트 격리 우회 방지, CSAP D-08-05).

---

## 7. CSP 보안 헤더 (CSAP D-12)

**미들웨어** (`middleware.ts`)가 모든 요청에 보안 헤더를 적용합니다.

```mermaid
sequenceDiagram
    participant Browser as 브라우저
    participant Middleware as middleware.ts
    participant App as Next.js App

    Browser->>Middleware: 모든 페이지 요청
    Middleware->>Middleware: crypto.randomUUID() → nonce 생성
    Middleware->>App: 요청 + x-nonce 헤더
    App->>App: layout.tsx에서 nonce 읽기
    App-->>Browser: HTML + CSP 헤더\n+ <body nonce="...">
```

**적용되는 보안 헤더:**

| 헤더 | 값 | 목적 |
|------|---|------|
| Content-Security-Policy | nonce 기반, strict-dynamic | XSS 방지 |
| X-Frame-Options | DENY | 클릭재킹 방지 |
| X-Content-Type-Options | nosniff | MIME 스니핑 방지 |
| Referrer-Policy | strict-origin-when-cross-origin | 정보 유출 방지 |
| X-XSS-Protection | 0 | 구형 브라우저 XSS 비활성화 |
| Permissions-Policy | camera, microphone 등 비활성화 | 권한 최소화 |
| HSTS | 2년 (프로덕션만) | HTTPS 강제 |

**CSP script-src 정책:**
- `'self'`: 같은 도메인 스크립트만 허용
- `'nonce-{값}'`: 요청마다 새로 생성된 nonce가 있는 스크립트만 허용
- `'strict-dynamic'`: nonce 허용 스크립트가 로드하는 스크립트도 허용

---

## 8. AppShell 레이아웃 구조

`AppShell`은 포털 전체의 레이아웃 뼈대입니다. 모든 페이지가 이 안에서 렌더링됩니다.

```
┌─────────────────────────────────────────────────────┐
│  AppNavbar (상단 네비게이션 바)                        │
├────────┬──────────────────────────────┬──────────────┤
│Service │  FloatingSidebar             │              │
│Rail    │  (서비스 선택 시 표시)         │  AI Side     │
│(좌측)  │                              │  Panel       │
│        │  RecentTabsBar (탭 히스토리)  │  (우측)      │
│        │  ─────────────────────────── │              │
│        │  Main Content (페이지 콘텐츠) │              │
└────────┴──────────────────────────────┴──────────────┘
│  BottomTabBar (모바일 하단 탭)                         │
└─────────────────────────────────────────────────────┘
```

**AppShell 상태 (Client Component):**

| 상태 | 기본값 | 역할 |
|------|--------|------|
| `railExpanded` | false | ServiceRail 확장/축소 |
| `activeService` | null | FloatingSidebar에 표시할 서비스 |
| `sidebarPinned` | false | FloatingSidebar 고정 여부 |
| `aiPanelOpen` | false | AI 사이드 패널 열기/닫기 |

**ServiceRail:** 13개 플랫폼 서비스 아이콘이 나열됩니다. 10개를 초과하면 "더 보기" 팝오버로 노출됩니다. 서비스 클릭 시 FloatingSidebar가 활성화됩니다.

---

## 9. 주요 컴포넌트 상세

### 9.1 DataGrid (공통 데이터 테이블)

재사용 가능한 Generic 데이터 테이블입니다. 정렬, 필터, 페이지네이션을 내장합니다.

```typescript
<DataGrid
  columns={[
    { key: 'name', label: '이름', sortable: true },
    { key: 'email', label: '이메일' },
    { key: 'role', label: '역할', sortable: true,
      render: (value) => <Badge>{String(value)}</Badge> },  // 커스텀 렌더러
  ]}
  data={users}
  pageSize={20}
  onRowClick={(row) => router.push(`/admin/users/${row.id}`)}
/>
```

**내장 기능:**
- 클라이언트 사이드 전문 검색 (모든 필드 대상)
- 컬럼별 오름/내림차순 정렬 (3단계 토글: ASC → DESC → 해제)
- 페이지네이션 (이전/다음, 현재 범위 표시)
- 한국어 정렬 (`localeCompare('ko')`)

### 9.2 ComplianceMatrix (CSAP 준수 현황)

CSAP 79항목의 준수 현황을 도메인별로 시각화합니다.

```typescript
<ComplianceMatrix
  title="CSAP 79항목 준수 현황"
  domains={compliance.domains}   // D-01 ~ D-14 도메인별 현황
  overallRate={compliance.overallRate}  // 전체 준수율 (%)
/>
```

### 9.3 AdminPageTemplate / TenantPageTemplate

페이지별 표준 레이아웃 래퍼입니다. 제목, 설명, 액션 버튼 영역을 일관되게 제공합니다.

```typescript
// 관리자 페이지
<AdminPageTemplate
  title="사용자 관리"
  description="전체 사용자 계정을 관리합니다."
  actions={<Button onClick={openCreateModal}>사용자 추가</Button>}
>
  <DataGrid ... />
</AdminPageTemplate>

// 테넌트 페이지
<TenantPageTemplate
  title="대시보드"
  description="구독 서비스 현황을 확인하세요."
>
  ...
</TenantPageTemplate>
```

---

## 10. CSAP 접근 통제 UI 구현 패턴 (CSAP D-08)

포털에서 역할에 따라 UI를 조건부로 렌더링하는 표준 패턴입니다.

**Server Component에서 역할 기반 렌더링:**
```typescript
// app/admin/billing/page.tsx
export default async function BillingPage() {
  const auth = await getAuthContext();

  // CSAP D-08: SUPER_ADMIN 전용 페이지
  if (!auth || auth.role !== 'SUPER_ADMIN') {
    redirect('/');  // 접근 불가 시 홈으로 이동
  }

  return (
    <AppShell>
      <AdminPageTemplate title="청구·결제 관리">
        <BillingContent />
      </AdminPageTemplate>
    </AppShell>
  );
}
```

**API Route Handler에서 권한 검사:**
```typescript
// app/api/tenants/route.ts
export async function POST(req: Request) {
  const auth = await getAuthContext();
  if (!auth) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

  // CSAP D-08-05: SUPER_ADMIN만 테넌트 생성 가능
  if (auth.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 });
  }
  // ...
}
```

---

## 11. 실습: 새 관리자 페이지 추가하기

**시나리오**: `/admin/reports` 경로에 월별 리포트 페이지를 추가합니다.

**1단계: 페이지 파일 생성**

`platform/apps/portal/src/app/admin/reports/page.tsx`를 생성합니다.

```typescript
// CSAP D-08: SUPER_ADMIN, ADMIN 전용
import { AppShell } from '@/components/layout/AppShell';
import { AdminPageTemplate } from '@/components/admin/AdminPageTemplate';
import { getAuthContext } from '@/lib/auth-guard';
import { redirect } from 'next/navigation';

// DB 데이터 fetch 함수 (서버 컴포넌트)
async function fetchMonthlyReport() {
  const apiBase = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? 'http://localhost:4000';
  const res = await fetch(`${apiBase}/reports/monthly`, {
    next: { revalidate: 300 },  // 5분 캐시
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function ReportsPage() {
  // 인증 검사 (CSAP D-08-01)
  const auth = await getAuthContext();
  if (!auth) redirect('/');

  // 접근 제어 (CSAP D-08-05)
  if (auth.role !== 'SUPER_ADMIN' && auth.role !== 'ADMIN') {
    redirect('/');
  }

  const report = await fetchMonthlyReport();

  return (
    <AppShell>
      <AdminPageTemplate
        title="월별 리포트"
        description="월간 플랫폼 사용 현황을 조회합니다."
      >
        {report ? (
          <pre>{JSON.stringify(report, null, 2)}</pre>
        ) : (
          <p>리포트 데이터를 불러올 수 없습니다.</p>
        )}
      </AdminPageTemplate>
    </AppShell>
  );
}
```

**2단계: ServiceRail에 서비스 추가**

`ServiceRail.tsx`의 `PLATFORM_SERVICES` 배열에 추가합니다.
```typescript
{ id: 'reports', name: '월별 리포트', icon: '📈', category: '관리' },
```

**3단계: 메뉴 서비스에 등록**

메뉴 서비스 API로 해당 경로의 메뉴 항목을 등록합니다.
```
POST /menu
{
  "tenantId": "platform-internal",
  "label": "월별 리포트",
  "path": "/admin/reports",
  "icon": "reports",
  "order": 10,
  "roles": ["SUPER_ADMIN", "ADMIN"]
}
```

**4단계: 검증**

- `SUPER_ADMIN`으로 접속 → 리포트 페이지 정상 접근
- `USER` 역할로 접속 → `/`로 리다이렉트 확인
- `getAuthContext()`가 null 반환 시 → `/`로 리다이렉트 확인

---

## 12. 개발 환경 설정

**환경 변수** (`platform/apps/portal/.env.local`):
```
NEXT_PUBLIC_API_GATEWAY_URL=http://localhost:4000
DATABASE_URL=postgresql://user:pass@localhost:5432/saas_platform
```

**개발 서버 실행:**
```
cd platform/apps/portal
pnpm dev
```

기본 접속 URL: `http://localhost:3000`

---

## 13. 자주 묻는 질문

**Q: 왜 Client Component인 AppShell이 Server Component인 DashboardContent를 감쌀 수 있나요?**
A: Next.js 15에서는 Client Component의 `children` prop으로 Server Component를 전달할 수 있습니다. `AppShell`이 레이아웃 상태(rail, sidebar)를 가지면서 `children`으로 서버 컴포넌트를 받는 구조입니다.

**Q: API Gateway 없이 포털에 직접 접근하면 어떻게 되나요?**
A: `getAuthContext()`가 `x-user-id` 헤더를 찾지 못해 `null`을 반환합니다. 이후 `redirect('/')` 또는 401 응답으로 처리됩니다. 개발 환경에서는 API 게이트웨이 목(mock)을 설정하거나 헤더를 직접 주입하여 테스트합니다.

**Q: Tailwind CSS와 CSS 변수를 함께 사용하는 이유는 무엇인가요?**
A: Tailwind는 레이아웃/간격에 사용하고, CSS 변수(`--color-primary` 등)는 테마 토큰으로 사용합니다. 테넌트별 브랜딩 커스터마이징이 필요할 때 CSS 변수만 오버라이드하면 됩니다.

**Q: `export const dynamic = 'force-dynamic'`은 언제 사용하나요?**
A: DB를 직접 조회하거나 요청 시마다 다른 데이터를 반환해야 하는 API Route Handler에 사용합니다. 이 선언이 없으면 빌드 시 정적으로 생성되어 항상 같은 응답을 반환할 수 있습니다.

---

## 14. 서버/클라이언트 컴포넌트 결정 트리

초보자가 새 컴포넌트를 작성할 때 빠르게 판단할 수 있는 플로우차트입니다.

```mermaid
flowchart TD
    Start(["새 컴포넌트 만들기"])
    Start --> Q1{"useState, useEffect,\nonClick, onChange,\n브라우저 이벤트 필요?"}

    Q1 -- 예 --> UseClient["'use client' 추가\n→ 클라이언트 컴포넌트"]
    Q1 -- 아니오 --> Q2{"async 데이터 페칭\n또는 process.env\n서버 전용 기능 필요?"}

    Q2 -- 예 --> ServerAsync["async function 컴포넌트\n→ 서버 컴포넌트 (데이터 페칭)"]
    Q2 -- 아니오 --> PureServer["순수 표시 컴포넌트\n→ 서버 컴포넌트 (기본값)"]

    UseClient --> Note1["⚠️ 서버 전용 API\n(prisma, fs, headers)\n사용 불가"]
    ServerAsync --> Note2["✅ DB 직접 접근\n환경 변수 안전\n브라우저에 코드 미노출"]
    PureServer --> Note3["✅ 가장 가벼움\n번들 크기 0\nSEO 최적화"]
```

---

## 15. 컴포넌트 간 데이터 흐름 전체 그림

```mermaid
graph TD
    subgraph Server["서버 (Node.js)"]
        MW["middleware.ts\n모든 요청 차단, CSP nonce 생성"]
        Layout["RootLayout (서버)\nnonce 읽어 body에 적용"]
        Page["page.tsx (서버)\n홈 라우트"]
        DC["DashboardContent (서버)\nasync 데이터 페칭"]
        Stats["StatsCards (서버)\nAPI Gateway → 통계"]
        CSAP["CsapSection (서버)\nAPI Gateway → CSAP 데이터"]
    end

    subgraph Client["클라이언트 (브라우저)"]
        Shell["AppShell (클라이언트)\nrail, sidebar, AI 패널 상태"]
        Navbar["AppNavbar (클라이언트)"]
        Rail["ServiceRail (클라이언트)"]
        Sidebar["FloatingSidebar (클라이언트)"]
        AI["AiSidePanel (클라이언트)"]
        Mobile["BottomTabBar (클라이언트)"]
    end

    MW --> Layout
    Layout --> Page
    Page --> Shell
    Shell -- children prop --> DC
    DC --> Stats
    DC --> CSAP
    Shell --> Navbar
    Shell --> Rail
    Shell --> Sidebar
    Shell --> AI
    Shell --> Mobile

    style Server fill:#E3F2FD,stroke:#1565C0
    style Client fill:#FFF3E0,stroke:#E65100
```

---

## 16. 초보자 실습: CSP 헤더 직접 확인하기

Portal 앱의 보안 헤더가 실제로 어떻게 작동하는지 확인하는 실습입니다.

### 준비

```bash
# 개발 서버 실행
cd /data/ai-saas
pnpm --filter portal dev
# → http://localhost:3000
```

### 실습 1: curl로 CSP 헤더 확인

```bash
# 응답 헤더만 출력 (-I 옵션)
curl -I http://localhost:3000/

# 기대 출력 (관련 헤더):
# Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-abc123' 'strict-dynamic'; ...
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# Referrer-Policy: strict-origin-when-cross-origin
```

### 실습 2: nonce 값이 요청마다 바뀌는지 확인

```bash
# 같은 요청을 두 번 보내서 nonce가 다른지 확인
curl -sI http://localhost:3000/ | grep nonce
curl -sI http://localhost:3000/ | grep nonce
# 두 nonce 값이 달라야 정상 (요청마다 새 nonce 생성)
```

### 실습 3: 브라우저에서 인라인 스크립트 차단 확인

```bash
# 브라우저 개발자 도구 → Console 탭에서 아래를 실행 시도
# eval("alert('test')")
# → Refused to evaluate a string as JavaScript because 'unsafe-eval' is not an allowed source
# → CSP에 의해 차단됨 → 정상 동작
```

### 실습 완료 체크

- [ ] 개발 서버 실행 성공 (`http://localhost:3000`)
- [ ] curl 응답에 `Content-Security-Policy` 헤더 확인
- [ ] `X-Frame-Options: DENY` 헤더 확인
- [ ] 두 요청의 nonce 값이 다름을 확인
- [ ] 브라우저 콘솔에서 CSP 차단 메시지 확인

---

## 다음 단계

Portal 앱 구조를 이해했다면, 공유 패키지 레이어를 학습해보세요.

- **[패키지 개요 → packages/README.md]**: 모든 공유 패키지 목록
- **[핵심 패키지 → packages/01-core-packages.md]**: auth-sdk, rbac 패키지 심화
- **[인프라 패키지 → packages/02-infra-packages.md]**: mesh-ready, health, feature-flag-sdk

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|------|
| 1.0.0 | 2026-04-12 | 최초 작성 (기존 내용 보강 + 학습 가이드 추가) | Implementer (Sonnet) |
