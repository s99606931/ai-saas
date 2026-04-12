# SVC-AI-ADV-R180 Design — AI 기반 지식 관리 자동화

> 작성일: 2026-04-12 | 버전: 1.0.0

## 클래스 설계

```
KnowledgeManagementAI
  ├── documents: Map<string, KnowledgeDoc>
  ├── auditLog: KMAuditEntry[]
  ├── registerDocument(doc) → void
  ├── findDuplicates(threshold) → DuplicateGroup[]
  ├── search(query) → SearchResult[]
  ├── getCategoryStats() → CategoryStats[]
  └── getAuditLog() → readonly KMAuditEntry[]
```

## 핵심 알고리즘

- 중복 탐지: Jaccard 유사도 (키워드 집합 기준), threshold 기본 0.6
- 검색: 쿼리 토큰화 → 키워드/제목 매칭 → 점수 합산
- PII 마스킹: 이메일/주민번호/전화 패턴 치환

## 보안 설계

- DataGrade C/S 차단 (N2SF N-05)
- 감사 로그 append-only
