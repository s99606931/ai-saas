// Design Ref: §R436 — AI기반 서비스 카탈로그 자동 태깅
// Plan SC: SVC-AI-ADV-R436-SC01

export type TagCategory = 'DOMAIN' | 'TECH_STACK' | 'COMPLIANCE' | 'LIFECYCLE' | 'AUDIENCE' | 'CRITICALITY'

export interface CatalogEntry {
  entryId: string
  name: string
  description: string
  owner: string
  existingTags: string[]
}

export interface GeneratedTag {
  tag: string
  category: TagCategory
  confidence: number   // 0..1
  reason: string
}

export interface TaggingResult {
  entryId: string
  newTags: GeneratedTag[]
  allTags: string[]    // 기존 + 신규 (중복 제거)
  tagsAdded: number
}

interface AuditEntry {
  timestamp: string
  action: string
  entryId: string
  detail: Record<string, unknown>
}

// 키워드 → 태그 매핑 규칙
const DOMAIN_KEYWORDS: Array<[RegExp, string]> = [
  [/인증|로그인|세션|권한/i, 'auth'],
  [/결제|청구|과금|요금/i, 'billing'],
  [/알림|공지|메시지|이메일/i, 'notification'],
  [/데이터|저장|DB|데이터베이스/i, 'data-storage'],
  [/API|게이트웨이|라우팅/i, 'api-gateway'],
  [/보안|취약점|암호화|방화벽/i, 'security'],
  [/모니터링|로그|추적|감사/i, 'observability'],
  [/민원|신청|처리|행정/i, 'e-government'],
]

const COMPLIANCE_KEYWORDS: Array<[RegExp, string]> = [
  [/개인정보|PII|마스킹/i, 'csap-d09'],
  [/CSAP|감리|인증/i, 'csap'],
  [/N2SF|등급|차단/i, 'n2sf'],
  [/감사|로그|기록/i, 'csap-d06'],
]

const CRITICALITY_KEYWORDS: Array<[RegExp, string]> = [
  [/critical|크리티컬|핵심|필수/i, 'critical'],
  [/내부|관리|운영/i, 'internal'],
  [/공개|외부|시민/i, 'public-facing'],
]

export class ServiceCatalogAutoTaggerAI {
  private auditLog: AuditEntry[] = []

  tag(entry: CatalogEntry): TaggingResult {
    this.appendAudit('catalog.tag', entry.entryId, { name: entry.name })

    const text = `${entry.name} ${entry.description}`
    const newTags: GeneratedTag[] = []
    const existingTagSet = new Set(entry.existingTags)

    // 도메인 태그 생성
    for (const [pattern, tag] of DOMAIN_KEYWORDS) {
      if (pattern.test(text) && !existingTagSet.has(tag)) {
        newTags.push({ tag, category: 'DOMAIN', confidence: 0.85, reason: `키워드 패턴 '${pattern.source}' 매칭` })
      }
    }

    // 컴플라이언스 태그 생성
    for (const [pattern, tag] of COMPLIANCE_KEYWORDS) {
      if (pattern.test(text) && !existingTagSet.has(tag)) {
        newTags.push({ tag, category: 'COMPLIANCE', confidence: 0.9, reason: `규정 준수 키워드 매칭` })
      }
    }

    // 크리티컬리티 태그 생성
    for (const [pattern, tag] of CRITICALITY_KEYWORDS) {
      if (pattern.test(text) && !existingTagSet.has(tag)) {
        newTags.push({ tag, category: 'CRITICALITY', confidence: 0.8, reason: `중요도 키워드 매칭` })
      }
    }

    // 소유자 기반 조직 태그
    if (entry.owner && !existingTagSet.has(`owner:${entry.owner}`)) {
      newTags.push({ tag: `owner:${entry.owner}`, category: 'LIFECYCLE', confidence: 1.0, reason: '소유자 직접 지정' })
    }

    const allTags = [
      ...entry.existingTags,
      ...newTags.map((t) => t.tag).filter((t) => !existingTagSet.has(t)),
    ]

    this.appendAudit('catalog.tagged', entry.entryId, { newTagCount: newTags.length, totalTags: allTags.length })

    return {
      entryId: entry.entryId,
      newTags,
      allTags,
      tagsAdded: newTags.length,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, entryId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, entryId, detail })
  }
}
