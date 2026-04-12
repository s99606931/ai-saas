# SVC-AI-ADV-R12: AI-powered Search — Design

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead

---

## Design Anchor

**선택: LLM 기반 의도 분류 + 다중 소스 통합 검색**

## §1 의도 분류기
- 검색 유형: statute(법령), civil(민원), procedure(절차), general(일반)
- LLM 또는 키워드 규칙 기반

## §2 쿼리 재작성
- 자연어 → 키워드 추출 + 필터 조건
- 동의어 확장, 약어 해석

## §3 다중 소스 통합
- 법령 DB, 공문서, FAQ, 행정 DB 동시 검색
- RRF(Reciprocal Rank Fusion)로 결과 병합

## §4 결과 요약
- 상위 N개 결과를 LLM으로 자동 요약
- 직접 답변 가능 시 바로 제공
