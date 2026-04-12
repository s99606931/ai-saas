# SVC-AI-ADV-R185 Design — AI 기반 공공 문서 분류 자동화

> 작성일: 2026-04-12 | 버전: 1.0.0

## 클래스 설계

```
PublicDocumentClassifierAI
  ├── rules: Map<string, ClassificationRule>
  ├── auditLog: PDCAuditEntry[]
  ├── registerRule(rule) → void
  ├── classify(doc) → ClassificationResult
  ├── getManualReviewList(threshold) → ClassificationResult[]
  └── getAuditLog() → readonly PDCAuditEntry[]
```

## 핵심 알고리즘

- 규칙 매칭: 문서 내용 토큰화 → 규칙 키워드 매칭 → 매칭 수 / 규칙 키워드 수
- 신뢰도: 가장 높은 규칙 매칭 점수
- 수동 검토: 신뢰도 < threshold (기본 0.5)
- PII 마스킹: 분류 전 이메일/주민번호/전화 치환

## 보안 설계

- DataGrade C/S 차단 (N2SF N-05)
- CSAP D-06 침해사고 관리
- 감사 로그 append-only
