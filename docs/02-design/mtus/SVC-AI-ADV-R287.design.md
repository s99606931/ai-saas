# SVC-AI-ADV-R287 Design: AI기반 공공 행정 언어 교정

## 핵심 알고리즘

### 비표준 용어 탐지
- 사전: Map<비표준, 표준>
- 입력 텍스트에서 비표준 키 전체 검색 (indexOf)
- 발견된 비표준 용어마다 교정 제안 생성

### 교정 적용
- String.replaceAll(비표준, 표준) 순차 적용
- 교정 전/후 텍스트 및 교정 횟수 반환

## 인터페이스 설계

```typescript
class PublicAdminLanguageCorrector {
  registerTerm(nonStandard, standard): void
  inspect(text, grade?): InspectionResult
  correct(text): CorrectionResult
  getAuditLog(): AuditEntry[]
}

interface InspectionResult {
  totalIssues: number
  suggestions: Array<{ nonStandard: string; standard: string; count: number }>
}

interface CorrectionResult {
  original: string
  corrected: string
  correctionCount: number
}
```
