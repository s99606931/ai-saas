# SVC-AI-ADV-R308 Design: AI기반 공공 데이터 연계 자동화 v2

## 핵심 알고리즘

### 필드 매핑 실행
- MappingRule: sourceField → targetField
- 레코드 변환: targetRecord[targetField] = sourceRecord[sourceField]
- 미매핑 소스 필드는 무시

### 검증
- targetSchema의 필수 필드가 변환 결과에 존재하는지 확인
- 누락 필드 목록 반환

## 인터페이스 설계

```typescript
class PublicDataLinkageAutomatorV2 {
  registerSource(id, name, fields): void
  registerMappingRule(ruleId, sourceId, targetId, fieldMappings): void
  execute(ruleId, sourceRecord, grade?): LinkageResult
  validate(ruleId, result): ValidationResult
  getAuditLog(): AuditEntry[]
}

interface LinkageResult {
  ruleId: string
  targetRecord: Record<string, unknown>
  mappedFields: number
}
```
