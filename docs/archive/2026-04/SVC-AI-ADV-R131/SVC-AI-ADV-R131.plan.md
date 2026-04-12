# SVC-AI-ADV-R131 — Conversation Topic Tracker

> 작성일: 2026-04-12 | 버전: 1.0.0 | 작성자: PM Lead
> 세션: #142 (R128~R132, 13차 PM 세션 o)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 대화 주제 추적 + 이탈(드리프트) 감지 — 키워드 TF-IDF 기반 주제 추출 + Jaccard 유사도 |
| 품질 | 결정적 한국어·영어 토큰화, 주제 전환 지점 식별, cumulative drift score |
| 보안 | 메시지 PII 마스킹, C/S 차단, 감사 로그 append-only |
| 비용 | 순수 계산, 외부 API 없음 |

## Context Anchor

- **WHY**: 장시간 대화에서 LLM이 원 주제를 이탈해 환각/오답을 생성하는 문제가 있으며, 공공기관 민원 상담은 주제 일관성이 핵심 품질 지표
- **WHO**: 민원 봇 운영자, 품질 관리자
- **RISK**: 주제 이탈 미탐지로 답변 품질 저하, 과민 감지로 정상 대화 중단, PII 키워드 유출
- **SUCCESS**: 대화 시작 → 주제 식별 → 각 메시지마다 유사도 계산 → drift score 누적 → 임계 초과 시 alert
- **SCOPE**: In — 세션별 주제 기록, 키워드 추출, 유사도 계산, drift 누적, 감사. Out — 실제 주제 교정 응답, chatbot-off-topic-guard와 별도(세션 지속 추적 관점).

## 요구사항

- **FR-R131.1**: `startSession(sessionId, initialMessage)` — 세션 시작 + 초기 주제 키워드 추출
- **FR-R131.2**: `addMessage(sessionId, message)` — 메시지 추가 + drift score 업데이트
- **FR-R131.3**: `extractKeywords(text)` — 한국어 2-gram + 영어 단어 TF 기반 상위 키워드
- **FR-R131.4**: `computeSimilarity(a, b)` — 키워드 집합 Jaccard 유사도
- **FR-R131.5**: `getDriftScore(sessionId)` — 누적 drift score + 이탈 지점 목록
- **FR-R131.6**: `onTopicDrift(listener)` — 임계 초과 시 emit
- **FR-R131.7**: `getAuditLog()` — 세션별 감사 이력 (CSAP D-06)
- **NFR-R131.1**: TypeScript strict 0 에러, 테스트 12개+
- **NFR-R131.2**: 100 세션 × 100 메시지 100ms 이내
- **CSAP D-06**: 감사 로그 append-only
- **N2SF N-05**: C/S 등급 메시지 차단

## 추적성 매트릭스

| FR ID | 구현 파일 | 테스트 | CSAP |
|-------|-----------|--------|------|
| FR-R131.1~6 | conversation-topic-tracker.ts | .test.ts | - |
| FR-R131.7 | getAuditLog() | test | D-06 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 최초 작성 | PM Lead |
