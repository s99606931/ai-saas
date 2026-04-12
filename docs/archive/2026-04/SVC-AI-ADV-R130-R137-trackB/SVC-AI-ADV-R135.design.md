# SVC-AI-ADV-R135 — 계약 자동화 엔진 (Design)

> 작성일: 2026-04-12 | Plan: SVC-AI-ADV-R135.plan.md

## 1. 아키텍처

```
registerClauseTemplate / addRiskPattern
      ↓
ContractAutomationAi
  ├─ generateContract() — 템플릿 변수 치환 + 조항 조립
  ├─ detectRiskClauses() — 리스크 패턴 매칭
  └─ getAuditLog() — append-only
```

## 2. 타입 정의

```typescript
export interface ClauseTemplate { templateId: string; type: string; title: string; body: string }
export interface ContractDraft { contractId: string; type: string; clauses: string[]; generatedAt: string }
export interface RiskClause { pattern: string; description: string; severity: 'HIGH'|'MEDIUM'|'LOW' }
export interface RiskDetection { matchedText: string; description: string; severity: string; lineNumber: number }
```

## 3. 알고리즘

### §3.1 변수 치환: `{{variable_name}}` 플레이스홀더 → variables 맵 값으로 치환
### §3.2 계약 유형 매핑: type → 해당 템플릿 목록 순서대로 조립
### §3.3 리스크 탐지: 등록된 패턴 정규식으로 줄 단위 스캔

## 4. Design Anchor

- CSAP D-06: 생성/분석 감사 로그
