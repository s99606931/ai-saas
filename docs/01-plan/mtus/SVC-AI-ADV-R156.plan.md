# MTU Plan — SVC-AI-ADV-R156 Response Consistency Checker

> **원 요청 번호**: R156
> **모듈**: `platform/services/ai-service/src/lib/response-consistency-checker.ts`

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 동일 질의에 대한 AI 응답 일관성 검증 → 신뢰도 지표 확보 |
| 기술 | 동일 질문 해시 키별 응답 샘플 적재 후 pairwise Jaccard 평균 |
| 보안 | C/S 차단 + 감사 |
| 규제 | CSAP D-12 품질관리, 행안부 AI 투명성 |

## Context Anchor

- WHY: LLM은 동일 질문에 다른 답을 줄 수 있어 품질 보증 필요
- WHO: QA팀, 배포 전 검증 파이프라인
- RISK: 불일치 심각 시 사용자 혼란
- SUCCESS: 질문별 일관성 스코어 + 임계값 판정 제공
- SCOPE: record(q,a) → check(q, threshold) → { score, passed }

## FR

| ID | 설명 |
|----|------|
| FR-R156.1 | record(question, answer) — 질문 정규화(lowercase trim) 후 키로 수집 |
| FR-R156.2 | check(question, threshold=0.6) — 응답 ≥2개 존재 시 pairwise Jaccard 평균 |
| FR-R156.3 | 응답 1개면 score=1 (단일 샘플) |
| FR-R156.4 | 미기록 질문 → `not_found` |
| FR-R156.5 | 전체 리포트 generateReport(threshold) — 모든 질문 집계 |
| FR-R156.6 | reset(), getAuditLog |
| FR-R156.7 | C/S 차단, 빈 입력 거부 |
| FR-R156.8 | 샘플 제한 (기본 10개), 초과 시 FIFO |

## 테스트 케이스

- 완전 동일 응답 → score 1
- 완전 다른 응답 → score ~0
- 부분 일치
- 단일 샘플 → score 1
- 미기록 질문 → 오류
- 샘플 초과 → FIFO
- generateReport 전체
- C/S 차단, 빈 입력 거부, 감사 로그
