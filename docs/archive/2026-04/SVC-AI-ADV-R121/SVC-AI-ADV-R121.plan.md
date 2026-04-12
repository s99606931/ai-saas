# SVC-AI-ADV-R121 — Feedback Loop Optimizer

> 작성일: 2026-04-12 | 버전: 1.0.0 | 작성자: PM Lead
> 원 요청 번호: R121
> 참고: 기존 `ai-feedback-loop.ts`와 중복 방지를 위해 `feedback-loop-optimizer.ts`로 명명

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 사용자 피드백(좋아요/싫어요/신고) 수집 → 프롬프트·검색 전략 자동 최적화 루프 |
| 품질 | 통계적 유의성 검사 후 반영, A/B 변형 관리 |
| 보안 | 피드백 수집 시 PII 제거, 등급 guard |
| 비용 | 메모리 기반 집계, 외부 저장소는 선택 |

## Context Anchor

- **WHY**: 기존 `ai-feedback-loop.ts`는 단순 이벤트 수집 수준. 이 모듈은 집계된 피드백을 기반으로 변형(variant) 점수화 → 자동 승격·강등 루프를 제공
- **WHO**: 프롬프트 운영자, RAG 튜닝, 챗봇 품질 운영
- **RISK**: 노이즈 피드백이 모델을 오도 → 최소 샘플 수 + 신뢰구간 기반 승격
- **SUCCESS**: variant 성능 순위, 자동 승격/강등 이벤트, 피드백 통계 리포트
- **SCOPE**: In — 피드백 집계·통계·승격 결정. Out — 실제 프롬프트 저장소(외부 연동)

## 요구사항

- **FR-R121.1**: variant 등록 (id, description)
- **FR-R121.2**: 피드백 기록 (variantId, rating: 1~5, signal: thumbs-up/down/report)
- **FR-R121.3**: variant별 통계 계산 (avg rating, CI, totalSamples)
- **FR-R121.4**: 최소 샘플 수(기본 30) 미달 시 평가 보류
- **FR-R121.5**: 상위 variant 승격(promote), 하위 강등(demote) 결정 리턴
- **FR-R121.6**: 피드백 PII 제거 (comment 필드)
- **FR-R121.7**: N2SF 등급 guard
- **FR-R121.8**: `getAuditLog()` 필수
- **NFR-R121.1**: TypeScript strict 0, 테스트 80%+

## 추적성 매트릭스

| FR ID | 구현 | 테스트 | CSAP |
|-------|------|--------|------|
| FR-R121.1~5 | feedback-loop-optimizer.ts | .test.ts | - |
| FR-R121.6 | PII scrub | test | D-09 |
| FR-R121.7 | grade guard | test | N2SF N-05 |
| FR-R121.8 | auditLog | test | D-06 |
