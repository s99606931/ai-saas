// Design Ref: MTU-N457 §gdpr
// Plan SC: FR-GDPR.1 ~ FR-GDPR.5

export interface GdprArticle {
  id: string;
  title: string;
  category: 'principles' | 'rights' | 'security' | 'transfer' | 'dpia';
  kpipaMapping: string; // 한국 개보법 대응 조항
}

// FR-GDPR.1: GDPR 조항 체크리스트 (Art.5~Art.35 핵심)
export const GDPR_ARTICLES: GdprArticle[] = [
  { id: 'Art.5', title: 'Principles of processing', category: 'principles', kpipaMapping: '개보법 §3' },
  { id: 'Art.6', title: 'Lawfulness of processing', category: 'principles', kpipaMapping: '개보법 §15' },
  { id: 'Art.7', title: 'Conditions for consent', category: 'principles', kpipaMapping: '개보법 §22' },
  { id: 'Art.9', title: 'Special categories', category: 'principles', kpipaMapping: '개보법 §23' },
  { id: 'Art.15', title: 'Right of access', category: 'rights', kpipaMapping: '개보법 §35' },
  { id: 'Art.16', title: 'Right to rectification', category: 'rights', kpipaMapping: '개보법 §36' },
  { id: 'Art.17', title: 'Right to erasure', category: 'rights', kpipaMapping: '개보법 §36' },
  { id: 'Art.18', title: 'Right to restrict', category: 'rights', kpipaMapping: '개보법 §37' },
  { id: 'Art.20', title: 'Right to portability', category: 'rights', kpipaMapping: '개보법 §35-2' },
  { id: 'Art.25', title: 'Privacy by design', category: 'security', kpipaMapping: '개보법 §29' },
  { id: 'Art.32', title: 'Security of processing', category: 'security', kpipaMapping: '개보법 §29' },
  { id: 'Art.33', title: 'Breach notification', category: 'security', kpipaMapping: '개보법 §34' },
  { id: 'Art.35', title: 'DPIA', category: 'dpia', kpipaMapping: '개보법 §33' },
  { id: 'Art.44', title: 'International transfers', category: 'transfer', kpipaMapping: '개보법 §28-8' },
];

export interface GdprCheckInput {
  articleId: string;
  compliant: boolean;
  evidence?: string;
  gap?: string;
}

export interface GdprGapReport {
  totalArticles: number;
  compliantCount: number;
  gaps: Array<{ articleId: string; title: string; gap: string; kpipa: string }>;
  coverage: number;
  internationalTransferChecked: boolean;
}

// FR-GDPR.2: 개보법 매핑 조회
export function kpipaFor(articleId: string): string | undefined {
  return GDPR_ARTICLES.find((a) => a.id === articleId)?.kpipaMapping;
}

// FR-GDPR.3 + FR-GDPR.5: 갭 분석 + 국외이전 체크
export class GdprAnalyzer {
  analyze(inputs: GdprCheckInput[]): GdprGapReport {
    const byId = new Map(inputs.map((i) => [i.articleId, i]));
    const gaps: GdprGapReport['gaps'] = [];
    let compliant = 0;
    for (const art of GDPR_ARTICLES) {
      const input = byId.get(art.id);
      if (input?.compliant) {
        compliant++;
      } else {
        gaps.push({
          articleId: art.id,
          title: art.title,
          gap: input?.gap ?? 'not_assessed',
          kpipa: art.kpipaMapping,
        });
      }
    }
    return {
      totalArticles: GDPR_ARTICLES.length,
      compliantCount: compliant,
      gaps,
      coverage: round4(compliant / GDPR_ARTICLES.length),
      internationalTransferChecked: byId.has('Art.44'),
    };
  }

  // FR-GDPR.4: DPIA 연동 — PIA 위험도 'high'면 Art.35 DPIA 필수
  requiresDpia(overallSensitivity: 'high' | 'medium' | 'low'): boolean {
    return overallSensitivity === 'high';
  }
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
