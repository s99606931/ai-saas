# SVC-AI-ADV-R115 — AI Governance Dashboard Backend

> 작성일: 2026-04-12 | 버전: 1.0.0 | 작성자: PM Lead
> 원 요청 번호: R110 (충돌로 재배정)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | AI 거버넌스 KPI 집계 + 대시보드용 시계열/스냅샷 API 제공 |
| 품질 | 지표 정확도 100%, 5초 이내 집계 |
| 보안 | 역할 기반 지표 필터링, 민감 지표는 관리자 전용 |
| 비용 | 메모리 내 집계, 외부 의존 없음 |

## Context Anchor

- **WHY**: AI 거버넌스 지표가 여러 모듈에 산재 → 감사·경영 대시보드 통합 필요
- **WHO**: Compliance Dashboard, CISO, 감리인
- **RISK**: 집계 지연 시 실시간성 손실 → 증분 집계 + 롤업
- **SUCCESS**: KPI 카테고리 4종(안전성/정확도/활용률/비용) × 시계열 + 스냅샷 제공
- **SCOPE**: In — 지표 수집 API, 집계, 조회 API. Out — 시각화 UI, 외부 CSV 내보내기

## 요구사항

- **FR-R115.1**: 지표 등록 API (recordMetric)
- **FR-R115.2**: 카테고리별 집계 — safety/accuracy/utilization/cost
- **FR-R115.3**: 시계열 조회 — 시간 범위 + 해상도(min/hour/day)
- **FR-R115.4**: 스냅샷 조회 — 현재 상태 요약
- **FR-R115.5**: 경고 임계값 초과 이벤트 발행
- **FR-R115.6**: RBAC — admin/auditor/viewer 역할별 접근 제어
- **FR-R115.7**: N2SF 등급 guard — 민감 메트릭은 O등급 마스킹
- **FR-R115.8**: `getAuditLog()` 필수
- **NFR-R115.1**: TypeScript strict 0, 테스트 80%+
- **NFR-R115.2**: 10K 데이터포인트 집계 5초 이내

## 추적성 매트릭스

| FR ID | 구현 | 테스트 | CSAP |
|-------|------|--------|------|
| FR-R115.1~5 | ai-governance-dashboard-backend.ts | .test.ts | - |
| FR-R115.6 | RBAC | test | D-08 |
| FR-R115.7 | guard | test | N2SF |
| FR-R115.8 | auditLog | test | D-06 |
