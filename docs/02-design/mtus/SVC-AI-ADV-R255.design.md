# SVC-AI-ADV-R255 — 스마트 계약 유효성 검사 엔진 Design

> 작성일: 2026-04-13 | 버전: 1.0.0

## 컴포넌트 설계

```
SmartContractValidator
├── registerRequiredClause(clause)
├── registerRiskKeyword(keyword)
├── registerContract(contract, grade)   // O등급만
├── parseContract(contractId): ClauseMatch[]
├── detectRisks(contractId): RiskFinding[]
├── validate(contractId): ValidationResult
└── getAuditLog(): AuditEntry[]
```

## 핵심 알고리즘

- **필수 조항 매칭**: clause.keywords ⊂ contract.text (대소문자 무시)
- **위험 점수**: 위험 키워드 건수 × 가중치. 독점=40, 면책=30, 무제한=20
- **판정 규칙**:
  - VALID: 필수 100% AND 위험점수 = 0
  - WARN: 필수 100% AND 위험점수 > 0 AND 점수 < 50
  - INVALID: 필수 누락 OR 위험점수 >= 50

## CSAP 준수

- D-06: 등록·검증 요청 감사 로그
- D-12: 입력 검증 (금액 >= 0, 당사자 배열 유효)
- N2SF: C/S 차단, 당사자 ID 마스킹 필수
