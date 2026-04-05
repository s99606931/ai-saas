// Design Ref: DESIGN-MTU-P16b — CSAP/N2SF 준수 현황
import { AppShell } from '@/components/layout/AppShell';
import { AdminPageTemplate } from '@/components/admin/AdminPageTemplate';
import { ComplianceMatrix } from '@/components/common/ComplianceMatrix';

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

const N2SF_DOMAINS = [
  { id: 'N-01', name: '네트워크 분리', totalItems: 3, passCount: 3, rate: 100 },
  { id: 'N-02', name: '데이터 등급 분류', totalItems: 4, passCount: 4, rate: 100 },
  { id: 'N-03', name: '접근 통제', totalItems: 3, passCount: 3, rate: 100 },
  { id: 'N-04', name: '인증 강화', totalItems: 2, passCount: 2, rate: 100 },
  { id: 'N-05', name: 'AI 연동 보안', totalItems: 3, passCount: 3, rate: 100 },
  { id: 'N-06', name: '감사 추적', totalItems: 3, passCount: 3, rate: 100 },
];

export default function CompliancePage() {
  return (
    <AppShell>
      <AdminPageTemplate title="규제 준수 현황" description="CSAP/N2SF 준수 현황을 확인합니다.">
        <div className="space-y-6">
          <ComplianceMatrix title="CSAP 79항목" domains={CSAP_DOMAINS} overallRate={100} />
          <ComplianceMatrix title="N2SF 6영역" domains={N2SF_DOMAINS} overallRate={100} />
        </div>
      </AdminPageTemplate>
    </AppShell>
  );
}
