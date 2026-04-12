# SVC-AI-ADV-R257 — 다국어 자연어 처리 파이프라인 Design

> 작성일: 2026-04-13 | 버전: 1.0.0

## 컴포넌트 설계

```
MultilingualNLPPipeline
├── registerIntent(intent)
├── registerStopwords(language, words[])
├── detectLanguage(text): LanguageDetection
├── normalize(text): string
├── extractKeywords(text, topN): string[]
├── classifyIntent(text): IntentResult
├── process(request, grade): PipelineResult
└── getAuditLog(): AuditEntry[]
```

## 핵심 알고리즘

- **언어 감지**: 유니코드 범위 비율 계산
  - 한글: AC00-D7AF, 3130-318F
  - 한자: 4E00-9FFF
  - 키릴: 0400-04FF
  - 아랍: 0600-06FF
  - 라틴: 0041-007A
  - 최대 비율 언어 반환, 동률 시 라틴 우선
- **키워드 추출**: 정규화 → 공백 split → 불용어 제거 → 길이 >= 2 → 빈도 top N
- **의도 분류**: 각 intent 키워드와 텍스트 교집합 수 계산 → 최대 점수 intent 반환

## CSAP 준수

- D-06: process 호출 감사 로그 (민원인 ID 마스킹)
- D-12: 입력 텍스트 길이 제한 (10000자)
- N2SF: C/S 차단
