// 콘텐츠 필터 -- FR-ADV3.2
// Design Ref: SVC-AI-ADV-R3 DESIGN §2
// 공공기관 부적절 카테고리 12종 차단
// CSAP: D-12 시스템 개발 보안

// ── 타입 정의 ──────────────────────────────────────────────────────────────

export type ContentCategory =
  | 'violence'          // 폭력/위협
  | 'sexual'            // 성적 콘텐츠
  | 'hate_speech'       // 혐오/차별
  | 'illegal'           // 불법 활동 조장
  | 'self_harm'         // 자해/자살
  | 'pii_request'       // 개인정보 요청
  | 'misinformation'    // 허위 정보/음모론
  | 'political_bias'    // 정치적 편향
  | 'spam'              // 상업 광고/스팸
  | 'government_attack' // 정부/공공기관 비방
  | 'classified'        // 국가 기밀 관련
  | 'copyright';        // 저작권 침해

export type ContentRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ContentFilterResult {
  /** 차단 여부 */
  blocked: boolean;
  /** 위반 카테고리 목록 */
  violations: ContentViolation[];
  /** 전체 위험 수준 */
  riskLevel: ContentRiskLevel;
  /** 정화된 텍스트 (차단 시 undefined) */
  sanitizedText?: string;
}

export interface ContentViolation {
  category: ContentCategory;
  riskLevel: ContentRiskLevel;
  matchedTerm: string;
  description: string;
}

// ── 카테고리별 키워드 사전 ──────────────────────────────────────────────────
// Plan SC: FR-ADV3.2

interface FilterRule {
  category: ContentCategory;
  riskLevel: ContentRiskLevel;
  patterns: RegExp[];
  description: string;
}

const FILTER_RULES: FilterRule[] = [
  {
    category: 'violence',
    riskLevel: 'critical',
    patterns: [
      /폭탄\s*(제조|만들|설치)/,
      /테러\s*(방법|계획|실행)/,
      /(살인|살해)\s*(방법|도구)/,
      /무기\s*(제조|구매|밀매)/,
      /how\s+to\s+(make|build)\s+(bomb|weapon)/i,
    ],
    description: '폭력/위협 콘텐츠',
  },
  {
    category: 'sexual',
    riskLevel: 'high',
    patterns: [
      /성인\s*콘텐츠\s*(생성|작성|만들)/,
      /음란\s*(소설|글|콘텐츠)\s*(작성|생성)/,
    ],
    description: '성적 콘텐츠',
  },
  {
    category: 'hate_speech',
    riskLevel: 'high',
    patterns: [
      /(인종|성별|장애|종교)\s*(차별|비하|혐오)/,
      /특정\s*(집단|인종|민족)\s*(열등|우월)/,
    ],
    description: '혐오/차별 발언',
  },
  {
    category: 'illegal',
    riskLevel: 'critical',
    patterns: [
      /마약\s*(제조|구매|판매|복용)/,
      /해킹\s*(방법|도구|기법)/,
      /불법\s*(도박|사행|성매매)/,
      /랜섬웨어\s*(제작|배포|코드)/i,
    ],
    description: '불법 활동 조장',
  },
  {
    category: 'self_harm',
    riskLevel: 'critical',
    patterns: [
      /자살\s*(방법|도구|계획)/,
      /자해\s*(방법|도구)/,
      /(목숨|생명)\s*(끊|포기)/,
    ],
    description: '자해/자살 관련',
  },
  {
    category: 'pii_request',
    riskLevel: 'high',
    patterns: [
      /주민등록번호\s*(알려|보여|찾|검색)/,
      /신용카드\s*번호/,
      /비밀번호\s*(알려|보여|찾)/,
      /계좌\s*번호\s*(알려|보여)/,
    ],
    description: '개인정보 요청',
  },
  {
    category: 'misinformation',
    riskLevel: 'medium',
    patterns: [
      /가짜\s*(뉴스|정보)\s*(생성|작성|만들)/,
      /허위\s*(사실|정보)\s*(유포|작성)/,
      /음모론\s*(작성|생성)/,
    ],
    description: '허위 정보/음모론',
  },
  {
    category: 'political_bias',
    riskLevel: 'medium',
    patterns: [
      /특정\s*정당\s*(지지|홍보|옹호)/,
      /선거\s*(개입|조작|홍보)/,
      /정치\s*선전\s*(문구|포스터)/,
    ],
    description: '정치적 편향',
  },
  {
    category: 'spam',
    riskLevel: 'low',
    patterns: [
      /광고\s*(문구|카피)\s*(작성|생성)/,
      /스팸\s*(메일|문자)\s*(작성|생성)/,
    ],
    description: '상업 광고/스팸',
  },
  {
    category: 'government_attack',
    riskLevel: 'medium',
    patterns: [
      /(대통령|국무총리|장관)\s*(비하|모욕|위해)/,
      /정부\s*(전복|붕괴|타도)/,
    ],
    description: '정부/공공기관 비방',
  },
  {
    category: 'classified',
    riskLevel: 'critical',
    patterns: [
      /기밀\s*(문서|정보)\s*(유출|공개)/,
      /군사\s*기밀/,
      /국가\s*안보\s*(위협|위반)/,
    ],
    description: '국가 기밀 관련',
  },
  {
    category: 'copyright',
    riskLevel: 'low',
    patterns: [
      /저작물\s*(복제|복사|배포)/,
      /불법\s*(다운로드|복제|유포)/,
    ],
    description: '저작권 침해',
  },
];

// ── 콘텐츠 필터 ──────────────────────────────────────────────────────────

/**
 * 콘텐츠 필터: 공공기관 부적절 카테고리 12종 차단
 * Plan SC: FR-ADV3.2
 *
 * @param text 검사할 텍스트
 * @returns 필터 결과
 */
export function filterContent(text: string): ContentFilterResult {
  const violations: ContentViolation[] = [];
  let highestRisk: ContentRiskLevel = 'low';

  const riskOrder: Record<ContentRiskLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  };

  for (const rule of FILTER_RULES) {
    for (const pattern of rule.patterns) {
      const match = pattern.exec(text);
      if (match) {
        violations.push({
          category: rule.category,
          riskLevel: rule.riskLevel,
          matchedTerm: match[0],
          description: rule.description,
        });

        if (riskOrder[rule.riskLevel] > riskOrder[highestRisk]) {
          highestRisk = rule.riskLevel;
        }

        break; // 같은 카테고리 중복 감지 방지
      }
    }
  }

  // 차단 기준: critical 또는 high 위반 존재
  const blocked = violations.some(
    (v) => v.riskLevel === 'critical' || v.riskLevel === 'high',
  );

  return {
    blocked,
    violations,
    riskLevel: highestRisk,
    sanitizedText: blocked ? undefined : text,
  };
}

/**
 * 콘텐츠 카테고리별 위반 수 집계
 */
export function summarizeViolations(
  violations: ContentViolation[],
): Record<ContentCategory, number> {
  const summary = {} as Record<ContentCategory, number>;
  for (const v of violations) {
    summary[v.category] = (summary[v.category] ?? 0) + 1;
  }
  return summary;
}
