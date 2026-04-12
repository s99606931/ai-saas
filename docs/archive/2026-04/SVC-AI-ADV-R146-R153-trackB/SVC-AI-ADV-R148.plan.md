# SVC-AI-ADV-R148 — 공공 서비스 챗봇 v2

> 작성일: 2026-04-12 | 버전: 1.0.0 | 작성자: Implementer (트랙 B 3차)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 멀티턴 대화 + 맥락 유지 + 페르소나 관리 공공 서비스 챗봇 |
| 품질 | 세션별 대화 히스토리 관리, 맥락 요약, 페르소나 전환 |
| 보안 | PII 마스킹, C/S 등급 입력 차단 (N2SF N-05) |
| 비용 | 규칙 기반 맥락 관리, LLM 없음 |

## Context Anchor

- **WHY**: 기존 챗봇은 단턴 응답. 공공 민원 상담은 멀티턴 맥락 유지가 필수.
- **WHO**: 민원인, 상담 담당자
- **RISK**: 맥락 누출로 다른 사용자 정보 혼용
- **SUCCESS**: 세션 시작 → 멀티턴 대화 → 맥락 유지 → 요약 반환
- **SCOPE**: In — 세션 관리, 히스토리, 맥락 요약, 페르소나. Out — 실제 LLM 호출.

## 요구사항

- **FR-R148.1**: `startSession(sessionId, persona, dataGrade)` — 세션 시작 (C/S 차단)
- **FR-R148.2**: `addTurn(sessionId, role, content)` — 대화 턴 추가
- **FR-R148.3**: `getContext(sessionId, maxTurns)` — 최근 N턴 맥락 반환
- **FR-R148.4**: `summarizeSession(sessionId)` — 세션 요약 생성
- **FR-R148.5**: `endSession(sessionId)` — 세션 종료 + 최종 기록
- **FR-R148.6**: `getAuditLog()` — 세션 이력 (CSAP D-06)
- **NFR-R148.1**: TypeScript strict 0 에러, 테스트 5개+
- **N2SF N-05**: C/S 등급 차단

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 최초 작성 | Implementer |
