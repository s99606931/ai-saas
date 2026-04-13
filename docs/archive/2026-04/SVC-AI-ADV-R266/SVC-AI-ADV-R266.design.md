# SVC-AI-ADV-R266 — 서비스 카탈로그 지능형 검색 Design

> 작성일: 2026-04-13 | 버전: 1.0.0

## 컴포넌트 설계

```
ServiceCatalogSearchAI
├── registerItem(id, title, description, tags[])
├── registerSynonym(word, synonyms[])
├── search(query, topN): SearchResult[]
│   ├── 쿼리 토큰화
│   ├── 동의어 확장
│   └── 제목/설명/태그 점수 합산 → topN 반환
└── getAuditLog(): AuditEntry[]
```

## 핵심 알고리즘

- **토큰화**: 공백/특수문자 분리, 2글자 이상 토큰
- **동의어 확장**: 쿼리 토큰 → 동의어 포함 확장 집합
- **점수**: 제목 매칭=3점, 태그 매칭=2점, 설명 매칭=1점

## CSAP D-12 준수

- 검색 쿼리 감사 로그
- N2SF C/S 등급 차단
