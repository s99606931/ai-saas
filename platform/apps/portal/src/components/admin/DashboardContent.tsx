// Design Ref: DESIGN-MTU-U1-P §D — 관리자 대시보드 컨텐츠
// Plan SC: FR-UP.4, FR-UP.5, FR-UP.6

'use client';

import { ComplianceMatrix } from '../common/ComplianceMatrix';

const CSAP_DOMAINS = [
  { id: 'D-01', name: '정보보호 정책', totalItems: 5, passCount: 5, rate: 100 },
  { id: 'D-02', name: '정보보호 조직', totalItems: 4, passCount: 4, rate: 100 },
  { id: 'D-03', name: '자산 관리', totalItems: 6, passCount: 6, rate: 100 },
  { id: 'D-04', name: '인적 보안', totalItems: 5, passCount: 5, rate: 100 },
  { id: 'D-05', name: '물리적 보안', totalItems: 7, passCount: 7, rate: 100 },
  { id: 'D-06', name: '침해사고 관리', totalItems: 5, passCount: 5, rate: 100 },
  { id: 'D-07', name: '서비스 연속성', totalItems: 6, passCount: 6, rate: 100 },
  { id: 'D-08', name: '접근 통제', totalItems: 12, passCount: 12, rate: 100 },
  { id: 'D-09', name: '암호화', totalItems: 4, passCount: 4, rate: 100 },
  { id: 'D-10', name: '네트워크 보안', totalItems: 8, passCount: 8, rate: 100 },
  { id: 'D-11', name: '시스템 보안', totalItems: 7, passCount: 7, rate: 100 },
  { id: 'D-12', name: '시스템 개발 보안', totalItems: 10, passCount: 10, rate: 100 },
];

const STATS = [
  { label: '활성 테넌트', value: '12', color: 'var(--color-primary)' },
  { label: '전체 사용자', value: '1,245', color: 'var(--color-success)' },
  { label: '활성 구독', value: '38', color: 'var(--color-warning)' },
  { label: '월간 수익', value: '₩45.2M', color: 'var(--color-primary)' },
];

export function DashboardContent() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
        플랫폼 대시보드
      </h1>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className="border rounded-lg p-4"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
          >
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{stat.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* FR-UP.6: CSAP 준수 현황 */}
      <ComplianceMatrix
        title="CSAP 79항목 준수 현황"
        domains={CSAP_DOMAINS}
        overallRate={100}
      />

      {/* FR-UP.5: 수익 차트 영역 */}
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
