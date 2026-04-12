# SVC-AI-ADV-R274 — 설계

## 구조

```
registerChecklist(items[])
submitEvidence(itemId, content, status)
runAudit() → AuditReport
  - passCount, failCount, pendingCount
  - 리스크 점수 = (HIGH*5 + MED*3 + LOW*1) 미준수 합
  - 미준수 항목 상세 목록
```

경중 가중치: HIGH=5, MED=3, LOW=1
