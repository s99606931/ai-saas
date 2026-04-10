# MTU-N180: 컨테이너 런타임 모니터링 Plan

> **문서 ID**: PLAN-N180 | **버전**: 1.0 | **작성일**: 2026-04-10
> **작성자**: PM Lead | **상태**: 승인

---

## Executive Summary (4관점 테이블)

| 관점 | 내용 |
|------|------|
| 비즈니스 | 컨테이너 런타임 장애 사전 감지로 배포 안정성 확보, SLA 준수 |
| 기술 | containerd 메트릭 수집, 이미지 풀 지연 모니터링, OOM Kill 추적 |
| 보안 | CSAP D-12 시스템 개발 보안, 런타임 이상 행위 탐지 |
| 운영 | 컨테이너 재시작/CrashLoop 자동 알림, 이미지 풀 실패 조기 경보 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 컨테이너 런타임 문제(이미지 풀 지연, OOM, CrashLoop)가 서비스 가용성 직접 영향 |
| WHO | SRE팀, DevOps 엔지니어, 플랫폼 운영팀 |
| RISK | 런타임 장애 미감지 시 서비스 중단, 배포 실패 장기화 |
| SUCCESS | 이미지 풀 지연 30초 이상 알림, OOM Kill 즉시 감지, CrashLoop 5분 내 알림 |
| SCOPE | containerd 런타임 메트릭, 이미지 레이어 풀 성능, 컨테이너 라이프사이클 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP 매핑 |
|----|---------|---------|----------|
| FR-N180.1 | containerd 런타임 상태 모니터링 (grpc, 작업 큐) | 필수 | D-12 |
| FR-N180.2 | 이미지 풀 지연 시간 모니터링 및 알림 | 필수 | D-12 |
| FR-N180.3 | 컨테이너 OOM Kill 모니터링 | 필수 | D-06 |
| FR-N180.4 | CrashLoopBackOff 탐지 및 알림 | 필수 | D-12 |
| FR-N180.5 | 컨테이너 런타임 종합 대시보드 (Grafana) | 필수 | D-06 |
| FR-N180.6 | 이미지 레지스트리 접근성 모니터링 | 권장 | D-12 |

## 산출물 목록

| 산출물 | 경로 | 형식 |
|--------|------|------|
| PrometheusRule | `infra/monitoring/container-runtime-rules.yaml` | YAML |
| Grafana 대시보드 | `infra/monitoring/dashboards/container-runtime.json` | JSON |
| 검증 스크립트 | `tests/monitoring/test-container-runtime.sh` | Shell |

## 추적성 매트릭스

| FR ID | Design | 구현 파일 | 테스트 | CSAP |
|-------|--------|----------|--------|------|
| FR-N180.1 | DS-N180.1 | container-runtime-rules.yaml | TC-N180.1 | D-12 |
| FR-N180.2 | DS-N180.2 | container-runtime-rules.yaml | TC-N180.2 | D-12 |
| FR-N180.3 | DS-N180.3 | container-runtime-rules.yaml | TC-N180.3 | D-06 |
| FR-N180.4 | DS-N180.4 | container-runtime-rules.yaml | TC-N180.4 | D-12 |
| FR-N180.5 | DS-N180.5 | container-runtime.json | TC-N180.5 | D-06 |
| FR-N180.6 | DS-N180.6 | container-runtime-rules.yaml | TC-N180.6 | D-12 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 초안 작성 | PM Lead |
