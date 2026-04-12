// ESG Dashboard — ESG 지표 대시보드 — MTU-N559
// Design Ref: SVC-ESG-GOV DESIGN §1~§2
// Plan SC: FR-UP.AI.9

'use client';

import { useEffect, useState } from 'react';

interface ESGData {
  fiscalYear: number;
  framework: 'GRI' | 'SASB' | 'TCFD' | 'K-ESG';
  environmental: {
    score: number;
    carbonKgCO2e: number;
    energyKwh: number;
    waterUsageM3: number;
  };
  social: {
    score: number;
    diversityIndex: number;
    employeeSatisfaction: number;
    communityInvestment: number;
  };
  governance: {
    score: number;
    boardIndependencePercent: number;
    auditCoverage: number;
    ethicsTrainingPercent: number;
  };
  overallScore: number;
}

interface ESGDashboardProps {
  tenantId: string;
}

function scoreColor(score: number): string {
  if (score >= 80) return 'var(--color-success)';
  if (score >= 60) return 'var(--color-warning)';
  return 'var(--color-error)';
}

export function ESGDashboard({ tenantId }: ESGDashboardProps) {
  const [data, setData] = useState<ESGData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? '';
        const res = await fetch(`${apiBase}/api/ai/esg/report/generate?tenantId=${tenantId}&fiscalYear=2026`);
        if (!res.ok) return;
        const json = (await res.json()) as { data: ESGData };
        setData(json.data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tenantId]);

  if (loading) {
    return (
      <div className="p-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        ESG 데이터 로딩 중...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 text-xs" style={{ color: 'var(--color-error)' }}>
        ESG 데이터를 불러올 수 없습니다.
      </div>
    );
  }

  const sections = [
    {
      title: '환경 (E)',
      score: data.environmental.score,
      items: [
        { label: '탄소배출', value: `${data.environmental.carbonKgCO2e.toFixed(1)} kgCO₂e` },
        { label: '에너지 사용', value: `${data.environmental.energyKwh.toLocaleString('ko-KR')} kWh` },
        { label: '용수 사용', value: `${data.environmental.waterUsageM3.toLocaleString('ko-KR')} m³` },
      ],
    },
    {
      title: '사회 (S)',
      score: data.social.score,
      items: [
        { label: '다양성 지수', value: data.social.diversityIndex.toFixed(2) },
        { label: '직원 만족도', value: `${data.social.employeeSatisfaction.toFixed(1)}/5` },
        { label: '지역사회 투자', value: `₩${(data.social.communityInvestment / 10000).toFixed(0)}만` },
      ],
    },
    {
      title: '거버넌스 (G)',
      score: data.governance.score,
      items: [
        { label: '이사회 독립성', value: `${data.governance.boardIndependencePercent.toFixed(0)}%` },
        { label: '감사 커버리지', value: `${data.governance.auditCoverage.toFixed(0)}%` },
        { label: '윤리교육 이수', value: `${data.governance.ethicsTrainingPercent.toFixed(0)}%` },
      ],
    },
  ];

  return (
    <div className="space-y-4" role="region" aria-label="ESG 대시보드">
      <div
        className="p-4 border rounded-lg flex items-center justify-between"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
      >
        <div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            FY{data.fiscalYear} · {data.framework}
          </p>
          <p className="text-sm font-semibold mt-1" style={{ color: 'var(--color-text)' }}>
            ESG 종합 평가
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            종합 점수
          </p>
          <p className="text-3xl font-bold" style={{ color: scoreColor(data.overallScore) }}>
            {data.overallScore.toFixed(1)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {sections.map((s) => (
          <div
            key={s.title}
            className="p-4 border rounded-lg"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                {s.title}
              </p>
              <span className="text-xl font-bold" style={{ color: scoreColor(s.score) }}>
                {s.score.toFixed(0)}
              </span>
            </div>
            <ul className="space-y-1">
              {s.items.map((item) => (
                <li key={item.label} className="flex justify-between text-xs">
                  <span style={{ color: 'var(--color-text-muted)' }}>{item.label}</span>
                  <span style={{ color: 'var(--color-text)' }}>{item.value}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
