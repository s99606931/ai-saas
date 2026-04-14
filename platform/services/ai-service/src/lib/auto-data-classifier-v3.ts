// Design Ref: §분류 규칙 — AutoDataClassifierV3
// Plan SC: SVC-AI-ADV-R495

type DataGradeClass = 'C' | 'S' | 'O'

interface DataItem {
  itemId: string
  name: string
  keywords: string[]
  classification?: DataGradeClass
}

interface AuditEntry {
  timestamp: string
  action: string
  itemId: string
  details?: Record<string, unknown>
}

const C_KEYWORDS = ['secret', 'password', '주민번호', '개인정보']
const S_KEYWORDS = ['internal', 'confidential', '기밀']

export class AutoDataClassifierV3 {
  private items = new Map<string, DataItem>()
  private auditLog: AuditEntry[] = []

  registerItem(itemId: string, name: string, keywords: string[]): DataItem {
    const item: DataItem = { itemId, name, keywords }
    this.items.set(itemId, item)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_ITEM',
      itemId,
      details: { name, keywordCount: keywords.length },
    })
    return item
  }

  classifyItem(itemId: string, dataGrade?: string): DataGradeClass {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    const item = this.items.get(itemId)
    if (!item) throw new Error(`항목을 찾을 수 없습니다: ${itemId}`)

    const lower = item.keywords.map((k) => k.toLowerCase())
    let grade: DataGradeClass = 'O'
    if (lower.some((k) => S_KEYWORDS.includes(k))) grade = 'S'
    if (lower.some((k) => C_KEYWORDS.includes(k))) grade = 'C'

    item.classification = grade
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'CLASSIFY_ITEM',
      itemId,
      details: { grade },
    })
    return grade
  }

  getClassification(itemId: string): DataGradeClass {
    const item = this.items.get(itemId)
    if (!item) throw new Error(`항목을 찾을 수 없습니다: ${itemId}`)
    return item.classification ?? 'O'
  }

  getItemsByGrade(grade: DataGradeClass): DataItem[] {
    return Array.from(this.items.values()).filter((item) => item.classification === grade)
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
