// SVC-AI-ADV-R43: 규정 준수 체크리스트 기반 검증
// Design Ref: §모듈
// Plan SC: FR-R43.2

export type Standard = 'CSAP' | 'N2SF' | 'ISMS-P'

export interface ComplianceCheckItem {
  standard: Standard
  code: string
  requirement: string
  keywords: string[]
  severity: 'low' | 'med' | 'high' | 'critical'
}

export interface ComplianceFinding {
  item: ComplianceCheckItem
  status: 'satisfied' | 'missing' | 'ambiguous'
  evidence?: string
}

export interface ComplianceReport {
  total: number
  satisfied: number
  missing: number
  ambiguous: number
  satisfiedRate: number
  findings: ComplianceFinding[]
  criticalMissing: ComplianceFinding[]
}

/**
 * 공공 조달 계약서에 대한 규정 준수 체크.
 * 키워드 매칭 기반 간이 검증 + 심각도 분류.
 */
export class RegulationComplianceChecker {
  private readonly checklist: ComplianceCheckItem[]

  constructor(customChecklist?: ComplianceCheckItem[]) {
    this.checklist = customChecklist ?? this.defaultChecklist()
  }

  /**
   * 계약서 텍스트 + 적용 표준으로 준수 리포트 생성.
   */
  check(contract: string, standards: Standard[]): ComplianceReport {
    if (!contract || contract.trim().length === 0) {
      throw new Error('contract text required')
    }

    const relevant = this.checklist.filter((c) => standards.includes(c.standard))
    const findings: ComplianceFinding[] = relevant.map((item) => this.evaluate(contract, item))

    const satisfied = findings.filter((f) => f.status === 'satisfied').length
    const missing = findings.filter((f) => f.status === 'missing').length
    const ambiguous = findings.filter((f) => f.status === 'ambiguous').length
    const criticalMissing = findings.filter(
      (f) => f.status === 'missing' && (f.item.severity === 'critical' || f.item.severity === 'high'),
    )

    return {
      total: findings.length,
      satisfied,
      missing,
      ambiguous,
      satisfiedRate: findings.length === 0 ? 0 : satisfied / findings.length,
      findings,
      criticalMissing,
    }
  }

  private evaluate(contract: string, item: ComplianceCheckItem): ComplianceFinding {
    const lower = contract.toLowerCase()
    const matched = item.keywords.filter((k) => lower.includes(k.toLowerCase()))

    if (matched.length === 0) {
      return { item, status: 'missing' }
    }
    if (matched.length >= Math.ceil(item.keywords.length / 2)) {
      const idx = lower.indexOf(matched[0]?.toLowerCase() ?? '')
      const evidence = contract.substring(Math.max(0, idx - 40), idx + 120)
      return { item, status: 'satisfied', evidence }
    }
    return { item, status: 'ambiguous', evidence: matched.join(', ') }
  }

  private defaultChecklist(): ComplianceCheckItem[] {
    return [
      // CSAP
      {
        standard: 'CSAP',
        code: 'CSAP-D08',
        requirement: '접근 통제 요건 명시',
        keywords: ['접근 통제', 'RBAC', '권한 관리', '인증'],
        severity: 'high',
      },
      {
        standard: 'CSAP',
        code: 'CSAP-D09',
        requirement: '암호화 요건 (AES-256, TLS 1.3+)',
        keywords: ['AES-256', 'TLS', '암호화', 'encryption'],
        severity: 'high',
      },
      {
        standard: 'CSAP',
        code: 'CSAP-D06',
        requirement: '감사 로그 보존 (1년 이상)',
        keywords: ['감사 로그', 'audit log', '로그 보존', '침해사고'],
        severity: 'high',
      },
      {
        standard: 'CSAP',
        code: 'CSAP-D12',
        requirement: '개발 보안 (입력 검증, SQL 주입 방지)',
        keywords: ['입력 검증', 'SQL 주입', 'XSS', '보안 코딩'],
        severity: 'med',
      },
      // N2SF
      {
        standard: 'N2SF',
        code: 'N2SF-N01',
        requirement: '네트워크 분리/격리',
        keywords: ['네트워크 분리', '격리', 'DMZ', '방화벽'],
        severity: 'critical',
      },
      {
        standard: 'N2SF',
        code: 'N2SF-N05',
        requirement: 'AI 연동 시 데이터 등급 분류',
        keywords: ['데이터 등급', '분류', 'C등급', 'S등급', 'O등급'],
        severity: 'critical',
      },
      // ISMS-P
      {
        standard: 'ISMS-P',
        code: 'ISMS-P-01',
        requirement: '개인정보 처리 위탁 계약 조항',
        keywords: ['개인정보', '처리 위탁', '위탁 계약', 'PII'],
        severity: 'critical',
      },
      {
        standard: 'ISMS-P',
        code: 'ISMS-P-02',
        requirement: '개인정보 파기 절차',
        keywords: ['파기', '삭제 절차', 'retention', '보유 기간'],
        severity: 'high',
      },
    ]
  }
}

export function createRegulationComplianceChecker(): RegulationComplianceChecker {
  return new RegulationComplianceChecker()
}
