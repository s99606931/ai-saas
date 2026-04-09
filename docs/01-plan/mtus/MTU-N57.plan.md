# MTU-N57: Prometheus Recording Rules + AlertManager 라우팅 최적화

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead (Opus)

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 모니터링 쿼리 성능 50% 향상, 알림 채널 세분화로 운영 효율 극대화 |
| 기술 | Prometheus Recording Rules 15개, AlertManager 라우팅 5채널, 억제 규칙 |
| 보안 | CSAP D-06 알림 체계 완비, 보안 이벤트 전용 채널, 감사 추적 |
| 운영 | 알림 피로도 감소, 에러 버짓 알림 자동화, 운영 Runbook 연동 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | Recording rules 부재로 대시보드 성능 저하, AlertManager 라우팅 미완 |
| WHO | DevOps, SRE, 보안 담당자 |
| RISK | Recording rules 과다 시 메모리 증가, 알림 폭주 위험 |
| SUCCESS | Recording rules 15개+, 라우팅 5채널, 대시보드 성능 50% 향상 |
| SCOPE | Recording rules, AlertManager 라우팅, 억제 규칙, 테스트 |

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP 매핑 |
|----|---------|---------|----------|
| FR-N57.1 | 서비스 RED 메트릭 Recording Rules (rate, error_ratio, duration_p99) | P0 | D-06 |
| FR-N57.2 | 노드 리소스 Recording Rules (cpu, memory, disk 사용률) | P0 | D-06 |
| FR-N57.3 | SLO 집계 Recording Rules (error_budget_remaining, burn_rate) | P0 | D-06 |
| FR-N57.4 | k3s 클러스터 상태 Recording Rules | P1 | D-06 |
| FR-N57.5 | AlertManager 라우팅 5채널 세분화 (devops, dba, security, sre, management) | P0 | D-06 |
| FR-N57.6 | AlertManager 억제 규칙 (inhibition rules) | P1 | D-06 |
| FR-N57.7 | AlertManager 침묵 규칙 템플릿 (유지보수 시간대) | P2 | D-06 |
| FR-N57.8 | 알림 파이프라인 E2E 테스트 스크립트 | P0 | D-06 |
| FR-N57.9 | 알림 에스컬레이션 정책 (warning→critical 자동 승격) | P1 | D-06 |

---

## 비기능 요구사항

| ID | 요구사항 |
|----|---------|
| NFR-N57.1 | Recording rules 평가 주기 15초 이하 |
| NFR-N57.2 | 알림 전달 지연 30초 이내 |
| NFR-N57.3 | Prometheus 추가 메모리 사용량 200MB 이내 |

---

## 산출물

| 산출물 | 경로 |
|--------|------|
| Recording Rules CRD | `infra/monitoring/recording-rules.yaml` |
| AlertManager 라우팅 설정 | `infra/monitoring/alertmanager-config.yaml` |
| 테스트 스크립트 | `scripts/test-monitoring-recording-rules.sh` |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
