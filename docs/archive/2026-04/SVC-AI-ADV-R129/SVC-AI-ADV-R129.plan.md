# SVC-AI-ADV-R129 — Multi-Model Consensus Voter

> 작성일: 2026-04-12 | 버전: 1.0.0 | 작성자: PM Lead
> 세션: #142 (R128~R132, 13차 PM 세션 o)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 복수 LLM 응답 다수결/가중 투표 앙상블 — majority/weighted/ranked-choice 3전략 |
| 품질 | 정규화 기반 답변 동등성 판정, 동률 tiebreaker, confidence 합산 |
| 보안 | 응답 PII 마스킹, C/S 등급 차단, 감사 로그 append-only |
| 비용 | 순수 계산, 외부 API 없음 |

## Context Anchor

- **WHY**: 단일 LLM은 환각·편향·오답 위험이 있고, 공공기관 민원 답변은 정확성이 가장 중요하므로 복수 모델 합의를 통한 신뢰도 확보가 필요
- **WHO**: AI 게이트웨이 운영자, 민원 응답 시스템
- **RISK**: 다수결로 오답 확정(집단 환각), 가중치 부여 편향, 동률 처리 오류
- **SUCCESS**: 복수 모델 응답 수집 → 정규화 → 투표 전략 선택 → 합의 답변 + confidence 반환
- **SCOPE**: In — 응답 정규화, 다수결/가중/RCV 투표, 동률 tiebreaker, confidence 산출. Out — 실제 LLM 호출, 의미적 유사성 기반 clustering(ai-output-ensemble과 별도).

## 요구사항

- **FR-R129.1**: `registerModel(id, weight)` — 모델 등록 + 가중치 설정
- **FR-R129.2**: `collectResponses(request, responses)` — 모델별 응답 수집
- **FR-R129.3**: `voteMajority(responses)` — 단순 다수결 (최다 득표)
- **FR-R129.4**: `voteWeighted(responses)` — 가중 투표 (합산 weight 최대)
- **FR-R129.5**: `voteRanked(responses, rankings)` — Ranked Choice Voting (IRV 방식)
- **FR-R129.6**: `decide(strategy, responses)` — 전략 분기 + ConsensusResult 반환
- **FR-R129.7**: `getAuditLog()` — 투표 이력 (CSAP D-06)
- **NFR-R129.1**: TypeScript strict 0 에러, 테스트 12개+
- **NFR-R129.2**: 10개 모델 100개 요청 50ms 이내
- **CSAP D-06**: 감사 로그 append-only
- **N2SF N-05**: C/S 등급 응답 차단

## 추적성 매트릭스

| FR ID | 구현 파일 | 테스트 | CSAP |
|-------|-----------|--------|------|
| FR-R129.1~6 | multi-model-consensus-voter.ts | .test.ts | - |
| FR-R129.7 | getAuditLog() | test | D-06 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 최초 작성 | PM Lead |
