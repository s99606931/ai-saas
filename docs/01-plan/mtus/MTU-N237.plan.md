# MTU-N237: Velero 백업/복원 상태 모니터링 — Plan

> **문서 ID**: MTU-N237-PLAN
> **버전**: 1.0.0 | **작성일**: 2026-04-10
> **Phase**: Round 25 — 백업 관측성

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 백업 성공률·복원 소요시간 가시성으로 DR 역량 사전 보장 |
| 기술 | Velero 메트릭 기반 백업 스케줄 이행률, 크기, 소요시간, 복원 성능 수집 |
| 보안 | CSAP D-10 재해복구 요건 충족 증거 자동 생성 (N2SF 가용성 영역) |
| 운영 | 백업 실패 즉시 알림, 복원 테스트 결과 추적, RTO/RPO SLI 대시보드 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 백업 실패를 사후 발견하면 데이터 손실 위험. 예방적 모니터링으로 DR 신뢰성 보장 |
| WHO | SRE 팀, 보안 관리자, 감리원 |
| RISK | 백업 무음 실패 → RPO 미달 → CSAP 감리 결함 |
| SUCCESS | 백업 메트릭 4종 + 알림 5개 + 대시보드 1개 + 검증 스크립트 |
| SCOPE | Velero 백업/복원/스케줄 성능 모니터링 |

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N237.1 | 백업 성공/실패/부분실패 상태 카운터 수집 | HIGH |
| FR-N237.2 | 백업 소요시간 (p50/p95/p99) 수집 | HIGH |
| FR-N237.3 | 백업 크기 (바이트) 추이 수집 | MED |
| FR-N237.4 | 복원 성공/실패 상태 및 소요시간 수집 | HIGH |
| FR-N237.5 | 스케줄 이행률 (마지막 성공 시각 대비 경과) 수집 | HIGH |
| FR-N237.6 | Velero 서버 리소스 사용량 추적 | MED |
| FR-N237.7 | 백업/복원 성능 알림 규칙 5개 | HIGH |
| FR-N237.8 | Grafana 대시보드 구성 | HIGH |
| FR-N237.9 | 검증 스크립트 작성 | HIGH |

---

## 추적성 매트릭스

| FR ID | Design 섹션 | 구현 산출물 | 검증 방법 |
|-------|-----------|-----------|----------|
| FR-N237.1 | §3.1 | velero-performance-rules.yaml | 검증 스크립트 |
| FR-N237.2 | §3.1 | velero-performance-rules.yaml | 검증 스크립트 |
| FR-N237.3 | §3.1 | velero-performance-rules.yaml | 검증 스크립트 |
| FR-N237.4 | §3.2 | velero-performance-rules.yaml | 검증 스크립트 |
| FR-N237.5 | §3.3 | velero-performance-rules.yaml | 검증 스크립트 |
| FR-N237.6 | §3.4 | velero-performance-rules.yaml | 검증 스크립트 |
| FR-N237.7 | §3.5 | velero-performance-alerts.yaml | 검증 스크립트 |
| FR-N237.8 | §3.6 | dashboards/velero-backup-performance.json | 검증 스크립트 |
| FR-N237.9 | §3.7 | verify-velero-monitoring.sh | 실행 결과 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
