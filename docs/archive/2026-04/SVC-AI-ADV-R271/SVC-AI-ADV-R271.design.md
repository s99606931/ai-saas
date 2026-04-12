# SVC-AI-ADV-R271 — 설계

## 구조

```
defineSchema(name, fields[])
  field: { name, type: 'string'|'number'|'date'|'boolean', required, pattern? }
validateRecord(schemaName, record) → RecordResult
runQualityCheck(schemaName, records[]) → DatasetQuality
  → completeness, validity, consistency 각 0~100
  → overallScore 가중평균
```
