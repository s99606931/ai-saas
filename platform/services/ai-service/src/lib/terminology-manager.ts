// SVC-AI-ADV-R40: 도메인 용어집 관리
// Design Ref: §모듈, §인터페이스
// Plan SC: FR-R40.2
//
// 행정·법령 도메인 용어집을 관리하고 번역 전/후 치환 처리를 수행한다.

export type Lang = 'ko' | 'en' | 'ja' | 'zh'

export interface TerminologyEntry {
  source: Lang
  target: Lang
  sourceText: string
  targetText: string
  domain: string
  addedAt: Date
}

export interface PreprocessResult {
  text: string
  placeholders: Map<string, string>
}

/**
 * 도메인별 용어집을 관리한다.
 * 치환 처리로 번역 일관성을 보장한다 (예: "행정심판" → "Administrative Appeal").
 */
export class TerminologyManager {
  // domain → (source|target|sourceText) → entry
  private readonly entries: Map<string, Map<string, TerminologyEntry>> = new Map()

  /**
   * 용어를 추가한다.
   */
  addTerm(
    domain: string,
    source: Lang,
    target: Lang,
    sourceText: string,
    targetText: string,
  ): void {
    if (!domain || !sourceText || !targetText) {
      throw new Error('terminology fields required')
    }
    const key = this.makeKey(source, target, sourceText)
    let map = this.entries.get(domain)
    if (!map) {
      map = new Map()
      this.entries.set(domain, map)
    }
    map.set(key, {
      source,
      target,
      sourceText,
      targetText,
      domain,
      addedAt: new Date(),
    })
  }

  /**
   * 번역 전 소스 텍스트에서 용어를 플레이스홀더로 치환한다.
   * 모델이 용어를 번역하지 못하도록 보호한 뒤, postprocess에서 복원한다.
   */
  preprocess(text: string, domain: string, source: Lang, target: Lang): PreprocessResult {
    const map = this.entries.get(domain)
    if (!map) return { text, placeholders: new Map() }

    const placeholders = new Map<string, string>()
    let processed = text
    let idx = 0

    // 긴 용어부터 매칭 (부분 충돌 방지)
    const relevant = Array.from(map.values())
      .filter((e) => e.source === source && e.target === target)
      .sort((a, b) => b.sourceText.length - a.sourceText.length)

    for (const entry of relevant) {
      if (processed.includes(entry.sourceText)) {
        const placeholder = `<<T${idx}>>`
        placeholders.set(placeholder, entry.targetText)
        processed = processed.split(entry.sourceText).join(placeholder)
        idx += 1
      }
    }

    return { text: processed, placeholders }
  }

  /**
   * 번역 후 플레이스홀더를 실제 타겟 용어로 복원한다.
   */
  postprocess(text: string, placeholders: Map<string, string>): string {
    let restored = text
    for (const [ph, target] of placeholders) {
      restored = restored.split(ph).join(target)
    }
    return restored
  }

  /**
   * 도메인 용어 개수 조회 (감사/통계용).
   */
  count(domain: string): number {
    return this.entries.get(domain)?.size ?? 0
  }

  /**
   * 모든 도메인 목록 반환.
   */
  domains(): string[] {
    return Array.from(this.entries.keys())
  }

  /**
   * 용어집을 JSON으로 내보낸다 (백업/이관용).
   */
  exportDomain(domain: string): TerminologyEntry[] {
    const map = this.entries.get(domain)
    if (!map) return []
    return Array.from(map.values())
  }

  /**
   * JSON 일괄 가져오기.
   */
  importDomain(domain: string, entries: TerminologyEntry[]): number {
    let added = 0
    for (const e of entries) {
      this.addTerm(domain, e.source, e.target, e.sourceText, e.targetText)
      added += 1
    }
    return added
  }

  private makeKey(source: Lang, target: Lang, text: string): string {
    return `${source}|${target}|${text}`
  }
}

/**
 * 행정 기본 용어집 시드 (예시).
 */
export function seedAdminTerminology(mgr: TerminologyManager): void {
  const KO_EN: Array<[string, string]> = [
    ['행정심판', 'Administrative Appeal'],
    ['정보공개', 'Information Disclosure'],
    ['주민등록', 'Resident Registration'],
    ['민원', 'Civil Complaint'],
    ['토지대장', 'Land Ledger'],
    ['건축물대장', 'Building Ledger'],
    ['공시지가', 'Officially Assessed Land Price'],
    ['지방세', 'Local Tax'],
    ['국세', 'National Tax'],
    ['전자정부', 'e-Government'],
  ]
  for (const [ko, en] of KO_EN) {
    mgr.addTerm('administration', 'ko', 'en', ko, en)
  }
}

export function createTerminologyManager(): TerminologyManager {
  return new TerminologyManager()
}
