# SVC-AI-ADV-R290 Design: AI기반 자동 운영 매뉴얼 생성

## 핵심 알고리즘

### 매뉴얼 구조
- Procedure: id, title, category, priority, steps[]
- Step: number, description, caution?
- 카테고리별 절차를 priority 오름차순으로 정렬하여 출력

### 목차 생성
- 전체 절차의 title과 category를 category별로 그룹화
- 형식: "# {category}\n  {순번}. {title}"

## 인터페이스 설계

```typescript
class OperationsManualGeneratorAI {
  registerProcedure(id, title, category, priority?): void
  addStep(procedureId, stepNumber, description, caution?): void
  generateManual(category?): ManualSection[]
  generateTOC(): TocEntry[]
  getAuditLog(): AuditEntry[]
}

interface ManualSection {
  procedureId: string
  title: string
  category: string
  steps: Step[]
}
```
