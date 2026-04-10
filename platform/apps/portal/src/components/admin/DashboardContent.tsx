// Design Ref: DESIGN-MTU-U1-P §D — 관리자 대시보드 컨텐츠
// Plan SC: FR-UP.4, FR-UP.5, FR-UP.6
// CSAP: D-08 — 서버 컴포넌트, 클라이언트 직접 DB 접근 없음

// 서버 컴포넌트 (use client 제거 — Next.js 15 기본값)
import { Suspense } from 'react';
import { ComplianceMatrix } from '../common/ComplianceMatrix';
import type { DashboardStats } from '@/app/api/dashboard/stats/route';
import type { CsapComplianceResponse } from '@/app/api/compliance/csap/route';

// ============================================================
// 데이터 fetch 함수 (서버 사이드)
// ============================================================

async function fetchDashboardStats(): Promise<DashboardStats | null> {
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? 'http://localhost:4000';
    const response = await fetch(`${apiBase}/api/dashboard/stats`, {
      next: { revalidate: 30 }, // 30초 캐시
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function fetchCsapCompliance(): Promise<CsapComplianceResponse | null> {
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? 'http://localhost:4000';
    const response = await fetch(`${apiBase}/api/compliance/csap`, {
      next: { revalidate: 300 }, // 5분 캐시
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

// ============================================================
// 통계 카드 컴포넌트
// ============================================================

interface StatCard {
  label: string;
  value: string;
  color: string;
}

function buildStatCards(stats: DashboardStats): StatCard[] {
  const revenueInManWon = (stats.revenue / 10000).toFixed(1);
  return [
    { label: '활성 테넌트', value: String(stats.tenants), color: 'var(--color-primary)' },
    { label: '전체 사용자', value: stats.users.toLocaleString('ko-KR'), color: 'var(--color-success)' },
    { label: '활성 구독', value: String(stats.activeSubscriptions), color: 'var(--color-warning)' },
    { label: '월간 수익', value: `₩${revenueInManWon}만`, color: 'var(--color-primary)' },
  ];
}

// 폴백: DB 연결 실패 시 표시할 기본값
function buildFallbackStatCards(): StatCard[] {
  return [
    { label: '활성 테넌트', value: '-', color: 'var(--color-primary)' },
    { label: '전체 사용자', value: '-', color: 'var(--color-success)' },
    { label: '활성 구독', value: '-', color: 'var(--color-warning)' },
    { label: '월간 수익', value: '-', color: 'var(--color-primary)' },
  ];
}

// ============================================================
// 서브 컴포넌트: 통계 카드 영역
// ============================================================

async function StatsCards() {
  const stats = await fetchDashboardStats();
  const cards = stats ? buildStatCards(stats) : buildFallbackStatCards();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="border rounded-lg p-4"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
        >
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {card.label}
          </p>
          <p className="text-2xl font-bold mt-1" style={{ color: card.color }}>
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// 서브 컴포넌트: CSAP 준수 현황 영역
// ============================================================

async function CsapSection() {
  const compliance = await fetchCsapCompliance();

  if (!compliance) {
    return (
      <div
        className="border rounded-lg p-4"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
      >
        <p style={{ color: 'var(--color-text-muted)' }}>CSAP 데이터 로드 실패 — DB 연결을 확인하세요.</p>
      </div>
    );
  }

  return (
    <ComplianceMatrix title="CSAP 79항목 준수 현황" domains={compliance.domains} overallRate={compliance.overallRate} />
  );
}

// ============================================================
// 로딩 스켈레톤
// ============================================================

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="border rounded-lg p-4 h-20 animate-pulse"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}
        />
      ))}
    </div>
  );
}

function ComplianceSkeleton() {
  return (
    <div
      className="border rounded-lg p-4 h-64 animate-pulse"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}
    />
  );
}

// ============================================================
// 메인 대시보드 컴포넌트 (서버 컴포넌트)
// Plan SC: FR-UP.4, FR-UP.5, FR-UP.6
// ============================================================

export function DashboardContent() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
        플랫폼 대시보드
      </h1>

      {/* FR-UP.4: 요약 카드 — 실DB 데이터 */}
      <Suspense fallback={<StatsSkeleton />}>
        <StatsCards />
      </Suspense>

      {/* FR-UP.6: CSAP 준수 현황 — 실DB 기반 계산 */}
      <Suspense fallback={<ComplianceSkeleton />}>
        <CsapSection />
      </Suspense>

      {/* FR-UP.5: 수익 차트 영역 (차트 라이브러리 연동 Phase 2 예정) */}
      {/* NOTE: 미사용 아님 — Phase 2 FR-UP.5 차트 컴포넌트 연동 시 교체 예정 */}
      <div
        className="border rounded-lg p-6"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
      >
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
          월간 수익 추이
        </h3>
        <div
          className="h-48 flex items-center justify-center rounded-lg"
          style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-muted)' }}
        >
          차트 영역 (차트 라이브러리 연동 시 대체)
        </div>
      </div>
    </div>
  );
}
