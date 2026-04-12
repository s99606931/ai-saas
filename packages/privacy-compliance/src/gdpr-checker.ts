/**
 * GDPR/개보법 컴플라이언스 체크
 * Design Ref: MTU-N457 §3
 * Plan SC: FR-GDPR.1~5
 */

export interface ComplianceCheckItem {
  code: string;
  regulation: 'GDPR' | 'PIPA';
  article: string;
  title: string;
  required: boolean;
}

export const GDPR_CHECKLIST: ComplianceCheckItem[] = [
  { code: 'GDPR-5', regulation: 'GDPR', article: 'Art.5', title: '개인정보 처리 원칙 (합법성·공정성·투명성)', required: true },
  { code: 'GDPR-6', regulation: 'GDPR', article: 'Art.6', title: '처리의 법적 근거', required: true },
  { code: 'GDPR-7', regulation: 'GDPR', article: 'Art.7', title: '동의의 조건', required: true },
  { code: 'GDPR-9', regulation: 'GDPR', article: 'Art.9', title: '특별 범주(민감) 정보 처리', required: true },
  { code: 'GDPR-13', regulation: 'GDPR', article: 'Art.13', title: '정보 수집 시 통지', required: true },
  { code: 'GDPR-15', regulation: 'GDPR', article: 'Art.15', title: '열람권', required: true },
  { code: 'GDPR-17', regulation: 'GDPR', article: 'Art.17', title: '삭제권 (잊혀질 권리)', required: true },
  { code: 'GDPR-20', regulation: 'GDPR', article: 'Art.20', title: '이동권', required: true },
  { code: 'GDPR-25', regulation: 'GDPR', article: 'Art.25', title: 'Privacy by Design & Default', required: true },
  { code: 'GDPR-32', regulation: 'GDPR', article: 'Art.32', title: '처리 보안', required: true },
  { code: 'GDPR-33', regulation: 'GDPR', article: 'Art.33', title: '유출 통지 (72시간)', required: true },
  { code: 'GDPR-35', regulation: 'GDPR', article: 'Art.35', title: 'DPIA', required: true },
  { code: 'GDPR-44', regulation: 'GDPR', article: 'Art.44', title: '국외 이전 일반 원칙', required: true },
];

export const PIPA_CHECKLIST: ComplianceCheckItem[] = [
  { code: 'PIPA-15', regulation: 'PIPA', article: '§15', title: '수집 근거', required: true },
  { code: 'PIPA-17', regulation: 'PIPA', article: '§17', title: '제3자 제공', required: true },
  { code: 'PIPA-18', regulation: 'PIPA', article: '§18', title: '목적 외 이용 금지', required: true },
  { code: 'PIPA-21', regulation: 'PIPA', article: '§21', title: '파기', required: true },
  { code: 'PIPA-23', regulation: 'PIPA', article: '§23', title: '민감정보 처리 제한', required: true },
  { code: 'PIPA-29', regulation: 'PIPA', article: '§29', title: '안전조치 의무', required: true },
  { code: 'PIPA-33', regulation: 'PIPA', article: '§33', title: '개인정보영향평가', required: true },
  { code: 'PIPA-34', regulation: 'PIPA', article: '§34', title: '유출 통지', required: true },
  { code: 'PIPA-35', regulation: 'PIPA', article: '§35', title: '열람', required: true },
  { code: 'PIPA-36', regulation: 'PIPA', article: '§36', title: '정정·삭제', required: true },
  { code: 'PIPA-37', regulation: 'PIPA', article: '§37', title: '처리정지', required: true },
];

/**
 * 매핑 테이블 (FR-GDPR.2)
 */
export const GDPR_PIPA_MAPPING: Record<string, string> = {
  'GDPR-15': 'PIPA-35',
  'GDPR-17': 'PIPA-36',
  'GDPR-20': 'PIPA-35',
  'GDPR-33': 'PIPA-34',
  'GDPR-35': 'PIPA-33',
  'GDPR-32': 'PIPA-29',
};

export class ComplianceChecker {
  /**
   * 체크 수행 (FR-GDPR.1)
   */
  check(
    regulation: 'GDPR' | 'PIPA',
    implementedCodes: Set<string>,
  ): {
    total: number;
    passed: number;
    failed: string[];
    coveragePercent: number;
  } {
    const checklist = regulation === 'GDPR' ? GDPR_CHECKLIST : PIPA_CHECKLIST;
    const required = checklist.filter((c) => c.required);
    const failed = required.filter((c) => !implementedCodes.has(c.code)).map((c) => c.code);
    const passed = required.length - failed.length;
    const coveragePercent = required.length > 0 ? (passed / required.length) * 100 : 100;
    return {
      total: required.length,
      passed,
      failed,
      coveragePercent: Math.round(coveragePercent * 10) / 10,
    };
  }

  /**
   * 갭 분석 (FR-GDPR.3)
   */
  gapAnalysis(gdprImplemented: Set<string>, pipaImplemented: Set<string>): {
    gdprOnly: string[];
    pipaOnly: string[];
    both: string[];
  } {
    const gdprOnly: string[] = [];
    const both: string[] = [];
    for (const gdprCode of gdprImplemented) {
      const pipaMapping = GDPR_PIPA_MAPPING[gdprCode];
      if (pipaMapping && pipaImplemented.has(pipaMapping)) {
        both.push(gdprCode);
      } else {
        gdprOnly.push(gdprCode);
      }
    }
    const mappedPipa = new Set(
      Object.values(GDPR_PIPA_MAPPING).filter((p) => pipaImplemented.has(p)),
    );
    const pipaOnly = Array.from(pipaImplemented).filter((p) => !mappedPipa.has(p));
    return { gdprOnly, pipaOnly, both };
  }
}
