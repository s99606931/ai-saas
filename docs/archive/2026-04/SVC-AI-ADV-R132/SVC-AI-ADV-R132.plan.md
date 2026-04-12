# SVC-AI-ADV-R132 — AI Audit Replay Engine

> 작성일: 2026-04-12 | 버전: 1.0.0 | 작성자: PM Lead
> 세션: #142 (R128~R132, 13차 PM 세션 o)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 감사 이벤트 재현 + 타임라인 시각화 데이터 생성 — 시간 범위 필터 + 이벤트 클러스터링 + causality 체인 |
| 품질 | 결정적 정렬, actor/action/resource 필터링, 타임라인 bucket 그룹화 |
| 보안 | 재현 시 PII 마스킹, C/S 등급 차단, 읽기 전용 (원본 불변), 감사 로그 append-only |
| 비용 | 순수 계산, 외부 API 없음 |

## Context Anchor

- **WHY**: 침해사고·장애 분석 시 AI 관련 감사 이벤트를 시간순으로 재구성해 원인 추적·책임 소재 규명이 필요하며, 감리·포렌식 대응 필수 기능
- **WHO**: 보안 감사자, 포렌식 분석자, 감리인
- **RISK**: 재현 중 원본 오염, PII 노출, causality 오판, 대용량 이벤트 성능 저하
- **SUCCESS**: 감사 이벤트 수집 → 시간 범위 필터 → 타임라인 구성 → causality 체인 생성 → 시각화 데이터 export
- **SCOPE**: In — 이벤트 수집·필터·정렬, 타임라인 bucket, causality 추론, PII 마스킹, 감사. Out — 실시간 스트리밍, 외부 SIEM 연동.

## 요구사항

- **FR-R132.1**: `ingest(event)` — 감사 이벤트 적재 (timestamp/actor/action/resource/traceId)
- **FR-R132.2**: `replay(filter)` — 시간 범위 + actor/action/resource 필터 기반 이벤트 조회
- **FR-R132.3**: `buildTimeline(events, bucketMs)` — 시간 bucket 단위 그룹화 + 이벤트 카운트
- **FR-R132.4**: `traceCausality(traceId)` — 동일 traceId 이벤트 체인 반환 (시간 순)
- **FR-R132.5**: `maskSensitive(event)` — PII 마스킹 (이메일/주민번호/전화번호)
- **FR-R132.6**: `exportVisualization(filter)` — 타임라인 시각화용 JSON 직렬화
- **FR-R132.7**: `getAuditLog()` — 재현 요청 자체의 감사 이력 (CSAP D-06)
- **NFR-R132.1**: TypeScript strict 0 에러, 테스트 12개+
- **NFR-R132.2**: 10000 이벤트 replay 200ms 이내
- **CSAP D-06**: 재현 불변성 + append-only 감사
- **N2SF N-05**: C/S 등급 이벤트 생성자 차단

## 추적성 매트릭스

| FR ID | 구현 파일 | 테스트 | CSAP |
|-------|-----------|--------|------|
| FR-R132.1~6 | ai-audit-replay-engine.ts | .test.ts | - |
| FR-R132.7 | getAuditLog() | test | D-06 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 최초 작성 | PM Lead |
