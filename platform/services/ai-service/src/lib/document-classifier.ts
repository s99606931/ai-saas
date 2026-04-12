// SVC-AI-ADV-R46: AI 문서 자동 분류기
// Design Ref: §분류 라벨, §흐름
// Plan SC: FR-R46.1, FR-R46.2

export type SecurityGrade = 'O' | 'C' | 'S'
export type Department =
  | '민원'
  | '기획'
  | '감사'
  | '재무'
  | '정보화'
  | '총무'
  | '법무'
  | '홍보'
  | '기타'
export type DocType =
  | '공문'
  | '회의록'
  | '보고서'
  | '계약서'
  | '법령'
  | '매뉴얼'
  | '통계'
  | '기타'
export type Urgency = '긴급' | '일반' | '장기'

export interface ClassificationLabel<T> {
  label: T
  confidence: number  // 0~1
  reasons: string[]
}

export interface ClassificationResult {
  securityGrade: ClassificationLabel<SecurityGrade>
  department: ClassificationLabel<Department>
  docType: ClassificationLabel<DocType>
  urgency: ClassificationLabel<Urgency>
  needsHumanReview: boolean
  overallConfidence: number
  classifiedAt: Date
}

type KeywordMap<T extends string> = Record<T, string[]>

/**
 * 문서 멀티레이블 분류기.
 * 규칙 + 키워드 점수로 4개 라벨 그룹 병렬 분류.
 */
export class DocumentClassifier {
  private readonly confidenceThreshold = 0.7

  private readonly securityKeywords: KeywordMap<SecurityGrade> = {
    S: ['대외비', '극비', '비밀', '보안 등급 S', 'TOP SECRET', '국가안보', '기밀'],
    C: [
      '주민등록번호', '개인정보', '민감정보', '내부용',
      '한정 배포', '제한 공개', '의료 정보', '신용 정보',
    ],
    O: ['공개', '일반', '공지', '안내', '공시', 'FAQ'],
  }

  private readonly departmentKeywords: KeywordMap<Department> = {
    민원: ['민원', '고충', '신고', '진정', '제안'],
    기획: ['기획', '정책', '계획', '전략', '로드맵'],
    감사: ['감사', '점검', '시정', '지적 사항', '감찰'],
    재무: ['예산', '결산', '회계', '세입', '세출', '수납', '지출'],
    정보화: ['정보화', '시스템', '서버', '네트워크', 'IT', '소프트웨어'],
    총무: ['총무', '인사', '복무', '물품', '자산', '차량'],
    법무: ['법무', '소송', '법률', '자문', '계약 검토'],
    홍보: ['홍보', '보도자료', '언론', 'SNS', '캠페인'],
    기타: [],
  }

  private readonly docTypeKeywords: KeywordMap<DocType> = {
    공문: ['수신', '발신', '참조', '결재', '협조 요청', '통보'],
    회의록: ['회의', '참석자', '안건', '결정 사항', '논의'],
    보고서: ['보고', '결과', '분석', '평가', '검토 의견'],
    계약서: ['계약', '갑', '을', '계약 금액', '이행 기간', '위약'],
    법령: ['법률', '시행령', '시행규칙', '조문', '부칙', '제정', '개정'],
    매뉴얼: ['절차', '방법', '사용법', '가이드', '매뉴얼', '지침'],
    통계: ['통계', '집계', '추이', '증감', '지표', 'KPI'],
    기타: [],
  }

  private readonly urgencyKeywords: KeywordMap<Urgency> = {
    긴급: ['긴급', '즉시', '24시간', '당일', '금일 내', '오늘까지', 'ASAP'],
    일반: ['일반', '일주일', '7일', '평상', '정기'],
    장기: ['장기', '분기', '월간', '연간', '30일', '1개월'],
  }

  /**
   * 문서 분류 실행.
   */
  classify(document: string, title?: string): ClassificationResult {
    if (!document || document.trim().length === 0) {
      throw new Error('document required')
    }
    const text = `${title ?? ''}\n${document}`.toLowerCase()

    const securityGrade = this.classifyGroup(text, this.securityKeywords, 'O')
    const department = this.classifyGroup(text, this.departmentKeywords, '기타')
    const docType = this.classifyGroup(text, this.docTypeKeywords, '기타')
    const urgency = this.classifyGroup(text, this.urgencyKeywords, '일반')

    const overallConfidence =
      (securityGrade.confidence + department.confidence + docType.confidence + urgency.confidence) / 4

    // 보안 분류는 특히 엄격하게: C/S 의심 시 신뢰도 낮으면 에스컬레이션
    const sgLabel: string = securityGrade.label
    const securityNeedsReview =
      (sgLabel === 'C' || sgLabel === 'S') &&
      securityGrade.confidence < 0.85
    const needsHumanReview =
      overallConfidence < this.confidenceThreshold || securityNeedsReview

    return {
      securityGrade,
      department,
      docType,
      urgency,
      needsHumanReview,
      overallConfidence,
      classifiedAt: new Date(),
    }
  }

  private classifyGroup<T extends string>(
    text: string,
    keywords: KeywordMap<T>,
    defaultLabel: T,
  ): ClassificationLabel<T> {
    const scores: Array<{ label: T; score: number; matches: string[] }> = []

    for (const label of Object.keys(keywords) as T[]) {
      const kws = keywords[label]
      const matches: string[] = []
      let score = 0
      for (const kw of kws) {
        if (text.includes(kw.toLowerCase())) {
          matches.push(kw)
          score += 1 + kw.length / 10
        }
      }
      scores.push({ label, score, matches })
    }

    const sorted = scores.sort((a, b) => b.score - a.score)
    const top = sorted[0]
    if (!top || top.score === 0) {
      return { label: defaultLabel, confidence: 0.3, reasons: ['키워드 미매칭, 기본값 적용'] }
    }

    // softmax 유사 신뢰도
    const exps = sorted.map((s) => Math.exp(s.score))
    const sum = exps.reduce((a, b) => a + b, 0)
    const confidence = exps[0] ? exps[0] / sum : 0

    return {
      label: top.label,
      confidence,
      reasons: top.matches.map((m) => `매칭: "${m}"`),
    }
  }
}

export function createDocumentClassifier(): DocumentClassifier {
  return new DocumentClassifier()
}
