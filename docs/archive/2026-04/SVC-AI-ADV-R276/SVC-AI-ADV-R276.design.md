# SVC-AI-ADV-R276 — 설계

## 구조

```
registerLaw({lawId, title, domain})
linkSystem(lawId, systemId, relevance: 'CORE'|'PARTIAL'|'REFERENCE')
registerChange(lawId, changeType: 'AMENDMENT'|'REPEAL'|'ENACTMENT', effectiveDate)
analyzeImpact(changeId) → {impactedSystems[], overallImpact}
  - CORE 매핑 + REPEAL = CRITICAL
  - CORE 매핑 + AMENDMENT = HIGH
  - PARTIAL 매핑 = MED
  - REFERENCE 매핑 = LOW
```
