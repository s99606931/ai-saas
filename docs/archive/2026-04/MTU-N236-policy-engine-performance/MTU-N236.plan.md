# MTU-N236: Kyverno/Gatekeeper 정책 엔진 성능 모니터링 — Plan

> **문서 ID**: MTU-N236-PLAN
> **버전**: 1.0.0 | **작성일**: 2026-04-10
> **Phase**: Round 25 — 정책 엔진 관측성

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 정책 엔진(Kyverno/Gatekeeper) 성능 가시성으로 Admission 병목 사전 감지 |
| 기술 | Webhook 응답시간, 정책 평가 지연, 오류율, 리소스 사용량 메트릭 수집 |
| 보안 | CSAP D-08 접근통제 정책 엔진의 가용성·성능 보장 (N2SF 보안 영역 모니터링) |
| 운영 | SRE 팀이 정책 엔진 장애를 p50/p99 지표 기반으로 5분 내 감지 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | Kyverno/Gatekeeper의 Admission Webhook 지연은 모든 k8s 리소스 생성/수정에 영향. 성능 저하 시 클러스터 전체 배포 지연 발생 |
| WHO | SRE 팀, 보안 관리자, 플랫폼 운영자 |
| RISK | 정책 엔진 과부하 → Admission Webhook 타임아웃 → 리소스 배포 실패 연쇄 |
| SUCCESS | 정책 엔진 메트릭 4종 + 알림 규칙 5개 + Grafana 대시보드 1개 + 검증 스크립트 |
| SCOPE | Kyverno 정책 평가 성능, Gatekeeper Audit/Webhook 성능, Policy Reporter 연동 |

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N236.1 | Kyverno Admission Webhook 응답시간 (p50/p95/p99) 수집 | HIGH |
| FR-N236.2 | Kyverno 정책 평가 결과 (pass/fail/warn/error) 카운터 수집 | HIGH |
| FR-N236.3 | Gatekeeper Audit 소요 시간 및 위반 건수 수집 | HIGH |
| FR-N236.4 | Gatekeeper Webhook 응답시간 및 오류율 수집 | HIGH |
| FR-N236.5 | 정책 엔진 리소스 사용량 (CPU/메모리) 추적 | MED |
| FR-N236.6 | Policy Reporter 보고 지연 및 큐 크기 수집 | MED |
| FR-N236.7 | 정책 엔진 성능 알림 규칙 5개 구성 | HIGH |
| FR-N236.8 | 통합 Grafana 대시보드 구성 | HIGH |
| FR-N236.9 | 검증 스크립트 작성 (메트릭·알림·대시보드 자동 검증) | HIGH |

---

## 비기능 요구사항

| ID | 요구사항 |
|----|---------|
| NFR-N236.1 | 메트릭 수집 주기 30초 이하 |
| NFR-N236.2 | 알림 발생 지연 2분 이내 |
| NFR-N236.3 | 대시보드 로딩 3초 이내 |

---

## 추적성 매트릭스

| FR ID | Design 섹션 | 구현 산출물 | 검증 방법 |
|-------|-----------|-----------|----------|
| FR-N236.1 | §3.1 | kyverno-performance-rules.yaml | 검증 스크립트 |
| FR-N236.2 | §3.1 | kyverno-performance-rules.yaml | 검증 스크립트 |
| FR-N236.3 | §3.2 | gatekeeper-performance-rules.yaml | 검증 스크립트 |
| FR-N236.4 | §3.2 | gatekeeper-performance-rules.yaml | 검증 스크립트 |
| FR-N236.5 | §3.3 | kyverno/gatekeeper-performance-rules.yaml | 검증 스크립트 |
| FR-N236.6 | §3.4 | policy-reporter-performance-rules.yaml | 검증 스크립트 |
| FR-N236.7 | §3.5 | policy-engine-performance-alerts.yaml | 검증 스크립트 |
| FR-N236.8 | §3.6 | dashboards/policy-engine-performance.json | 검증 스크립트 |
| FR-N236.9 | §3.7 | verify-policy-engine-monitoring.sh | 실행 결과 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
