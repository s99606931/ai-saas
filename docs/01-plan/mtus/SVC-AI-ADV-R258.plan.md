# SVC-AI-ADV-R258 — 디지털 트윈 데이터 동기화 엔진

> 작성일: 2026-04-13 | 버전: 1.0.0 | 작성자: PM Lead (자율 생성)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 물리 엔티티 ↔ 디지털 트윈 동기화 + delta 기반 업데이트 + 이상 감지 + 버전 관리 |
| 품질 | 상태 비교·해시·이상 탐지, 테스트 10개+ |
| 보안 | C/S 차단, 엔티티 ID 마스킹, CSAP D-06 감사 로그 |
| 비용 | 로컬 동기화 엔진, 외부 API 없음 |

## Context Anchor

- **WHY**: 공공 인프라(교통·시설·환경) 디지털 트윈 동기화 지연 → 이상 탐지 지연
- **WHO**: 시설관리팀, 도시계획팀, 스마트시티팀
- **RISK**: IoT 센서 데이터 대량 → 효율적 delta 동기화 필요
- **SUCCESS**: 물리 상태 입력 → 트윈 업데이트 → delta 계산 → 이상 여부 반환
- **SCOPE**: In — 동기화·이상감지. Out — 실제 IoT 통신

## 요구사항

- **FR-R258.1**: 트윈 엔티티 등록 (entityId·type·initialState, O등급 한정)
- **FR-R258.2**: 상태 업데이트 (entityId·newState·timestamp)
- **FR-R258.3**: Delta 계산 (이전↔현재 key별 변경 목록)
- **FR-R258.4**: 이상 감지 규칙 등록 (field·min·max·severity)
- **FR-R258.5**: 이상 평가 (업데이트 시 등록된 규칙 실행 → Anomaly 반환)
- **FR-R258.6**: 버전 이력 조회 (entityId → version 목록)
- **FR-R258.7**: 현재 상태 조회 (getState)
- **FR-R258.8**: C/S 차단, entityId 마스킹, CSAP D-06 감사 로그, getAuditLog()
- **NFR-R258.1**: TypeScript strict, 테스트 10개+

## 추적성 매트릭스

| FR ID | 구현 | 테스트 | CSAP |
|-------|------|--------|------|
| FR-R258.1~8 | digital-twin-sync-engine.ts | .test.ts | D-06, D-12 |
