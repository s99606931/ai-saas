# MTU-N45: Falco 런타임 보안 — Plan

> **버전**: 1.0.0 | **작성일**: 2026-04-09 | **작성자**: PM Lead (Opus)

---

## Executive Summary (4관점)

| 관점 | 내용 |
|------|------|
| 비즈니스 | 컨테이너 런타임 위협 탐지로 CSAP D-12 시스템 개발 보안 완전 충족 |
| 기술 | Falco eBPF 기반 syscall 모니터링 + Falcosidekick 알림 통합 |
| 보안 | 런타임 이상 행위 실시간 감지 (파일 접근, 네트워크, 프로세스) |
| 운영 | Prometheus 메트릭 + Grafana 대시보드로 보안 이벤트 가시화 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 빌드/배포 단계 보안만으로는 런타임 위협 대응 불가. CSAP D-12 요건 충족 필요 |
| WHO | DevSecOps 엔지니어, 보안 관제팀, SRE |
| RISK | 커널 호환성(WSL2 eBPF), 성능 오버헤드, 오탐 노이즈 |
| SUCCESS | Falco 설치 완료, 커스텀 규칙 10개+, Grafana 대시보드 연동 |
| SCOPE | Falco DaemonSet + Falcosidekick + 커스텀 규칙 + 모니터링 통합 |

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP 매핑 |
|----|---------|---------|----------|
| FR-N45.1 | Falco Helm 설치 (eBPF 드라이버, k3s 호환) | 필수 | D-12 |
| FR-N45.2 | Falcosidekick 설치 (Webhook + Prometheus 출력) | 필수 | D-06 |
| FR-N45.3 | 공공 SaaS 커스텀 규칙 10개 (민감 파일, 권한 상승 등) | 필수 | D-08, D-12 |
| FR-N45.4 | Prometheus ServiceMonitor 연동 | 필수 | D-06 |
| FR-N45.5 | Grafana 런타임 보안 대시보드 | 필수 | D-06 |
| FR-N45.6 | 알림 규칙 (Critical/Warning 분류) | 필수 | D-06 |
| FR-N45.7 | 네임스페이스별 규칙 필터링 | 권장 | D-08 |
| FR-N45.8 | 테스트 스크립트 (위협 시뮬레이션 + 탐지 확인) | 필수 | D-12 |

---

## 산출물

| 산출물 | 경로 |
|--------|------|
| Falco Helm values | `infra/falco/values.yaml` |
| Falcosidekick values | `infra/falco/falcosidekick-values.yaml` |
| 커스텀 규칙 | `infra/falco/custom-rules.yaml` |
| Grafana 대시보드 | `infra/monitoring/dashboards/falco-runtime-security.json` |
| 알림 규칙 | `infra/falco/alerting-rules.yaml` |
| 설치 스크립트 | `scripts/setup-falco.sh` |
| 테스트 스크립트 | `scripts/test-falco-runtime.sh` |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
