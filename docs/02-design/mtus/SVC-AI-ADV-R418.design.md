# SVC-AI-ADV-R418 Design — AI기반 공공기관 이해관계자 분석

## §R418 설계 결정
- 영향도(influence)×관심도(interest) 사분면:
  - HIGH influence + HIGH interest → MANAGE_CLOSELY
  - HIGH influence + LOW interest → KEEP_SATISFIED
  - LOW influence + HIGH interest → KEEP_INFORMED
  - LOW influence + LOW interest → MONITOR
- HIGH 기준: ≥ 5 (1~10 스케일)
- PII: stakeholderId 감사 로그 마스킹 (앞2+*+뒤2)
- 감사 로그: stakeholder.register, stakeholder.analyze 액션

## 인터페이스
```typescript
interface Stakeholder { stakeholderId, name, organization, influenceLevel: number, interestLevel: number }
interface StakeholderAnalysis { stakeholderId, maskedId, name, quadrant, managementStrategy, communicationFrequency }
interface StakeholderReport { projectId, totalStakeholders, analyses: StakeholderAnalysis[], criticalStakeholders: string[] }
```
