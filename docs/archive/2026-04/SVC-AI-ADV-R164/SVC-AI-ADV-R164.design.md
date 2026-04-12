# SVC-AI-ADV-R164 — 문서 변경 영향 분석기 (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## 타입

```typescript
export enum DataGrade { C = 'C', S = 'S', O = 'O' }

export interface PolicyDocument {
  id: string
  title: string
  keywords: string[]
  referencedDocIds: string[]
}

export interface ImpactedDocument {
  id: string
  title: string
  distance: number      // 1=직접, 2+=간접
  sharedKeywords: string[]
  severity: 'high' | 'medium' | 'low'
}

export interface ChangeImpactReport {
  changedDocId: string
  directImpact: ImpactedDocument[]
  transitiveImpact: ImpactedDocument[]
  totalImpacted: number
  reviewRequired: string[]    // 즉시 검토 필요 문서 ids
  analysisAt: number
}

class DocumentChangeImpactAnalyzer {
  constructor(grade: DataGrade)
  registerDocument(doc: PolicyDocument): void
  analyzeImpact(docId: string): ChangeImpactReport
  getAuditLog(): readonly AuditEntry[]
}
```

## 알고리즘

- 의존성: referencedDocIds + 키워드 Jaccard ≥ 0.2 자동 추론
- 영향 BFS: 변경 문서 → 참조 문서들 → 전이적 전파
- severity: distance=1 + sharedKeywords ≥ 3 → high, distance=1 → medium, else → low
- reviewRequired: severity=high 문서
