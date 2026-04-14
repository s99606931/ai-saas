# SVC-AI-ADV-R608 (v3) Design — AI기반 문서 생명주기 관리 v3

## 인터페이스
```typescript
type DocClassification = 'PERMANENT' | 'STANDARD';
type DocStage = 'ACTIVE' | 'REVIEW' | 'DISPOSAL' | 'ARCHIVE';

interface DocItem {
  id: string;
  createdAt: string;
  retentionYears: number;
  accessCount: number;
  classification: DocClassification;
}

interface DocStageResult { id: string; stage: DocStage; }

interface LifecycleResult {
  totalDocs: number;
  disposalCandidates: string[];
  items: DocStageResult[];
}

class DocumentLifecycleManagerV3 {
  classify(docs: DocItem[], now?: Date): LifecycleResult;
  getAuditLog(): AuditEntry[];
}
```

## 알고리즘
- ageYears = (now.getTime() - createdAt.getTime()) / (365 * 86400000).
- PERMANENT → ARCHIVE.
- ageYears ≥ retentionYears → DISPOSAL.
- ageYears ≥ retentionYears * 0.8 → REVIEW.
- 그 외 → ACTIVE.
