# SVC-AI-ADV-R104 — AI Incident Response Playbook

> 작성일: 2026-04-12 | 버전: 2.0.0 (재작성)
> 세션: #139 (11차 PM 세션 k)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | AI 시스템 장애 유형별 자동 대응 플레이북 실행 엔진 |
| 품질 | 장애 유형 매칭 → 단계별 실행 → 결과 수집 전과정 표준화 |
| 보안 | CSAP D-06 침해사고 관리 대응, 모든 액션 감사 로그 |
| 비용 | 정적 워크플로우 (LLM 없음) |

## Context Anchor

- **WHY**: AI 환각/다운/편향 등 장애 발생 시 수작업 대응으로 인한 지연 방지
- **WHO**: SRE, 보안 운영팀
- **RISK**: 잘못된 자동 조치로 서비스 정지. 미등록 장애 유형 누락.
- **SUCCESS**: 장애 유형 등록 → triage → 단계 실행 → 결과 보고 API
- **SCOPE**: 플레이북 정의·실행·상태 추적. 외부 시스템 호출은 executor 주입형.

## 요구사항

- **FR-R104.1**: `registerPlaybook(incidentType, steps)` — 장애 유형별 단계 등록
- **FR-R104.2**: `triage(incidentSignal)` — 신호 → 플레이북 매칭 (severity 판정)
- **FR-R104.3**: `executePlaybook(incidentId, incidentType, executor)` — 단계 순차 실행 (executor 주입)
- **FR-R104.4**: `getIncidentStatus(incidentId)` — 진행/완료/실패 상태
- **FR-R104.5**: `listActiveIncidents()` — 진행 중 인시던트 목록
- **NFR-R104.1**: 테스트 6개+
- **CSAP D-06**: `getAuditLog()` 필수 + 모든 실행 감사

## 추적성

| FR | Design 섹션 | 구현 | 테스트 |
|----|-----------|-----|-------|
| FR-R104.1~5 | §2 | ai-incident-response-playbook.ts | 각 FR |
