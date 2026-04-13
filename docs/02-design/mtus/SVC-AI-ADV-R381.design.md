# SVC-AI-ADV-R381 Design: AI기반 코드 생성 품질 검증

## 핵심 알고리즘

### 품질 점수 계산
- DEFECT_DEDUCTION: { critical: 30, high: 15, medium: 7, low: 2 }
- `qualityScore = max(0, 100 - sum(deductions))`
- 결함 유형별 집계: defectType → count

## 클래스 설계

```typescript
class CodeGenerationQualityVerifier {
  registerSnippet(id, language, linesOfCode): void
  recordDefect(snippetId, defectType, severity, grade): void
  getQualityScore(snippetId): number
  getDefectSummary(snippetId): Record<string, number>
  getAuditLog(): AuditEntry[]
}
```

## N2SF / CSAP 적용
- C/S 등급: recordDefect 차단
- 감사 로그: snippet.register, defect.record
