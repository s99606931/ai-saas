# MTU-N89: VictoriaMetrics 고성능 메트릭 저장소 — Plan

> **Phase**: 모니터링 Round 7 — 심화 최적화
> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead

---

## Executive Summary (4-Perspective)

| 관점 | 내용 |
|------|------|
| 비즈니스 | 메트릭 장기 보존(1년+) 및 쿼리 성능 10배 향상으로 CSAP D-06 감사 요건 완전 충족 |
| 기술 | VictoriaMetrics Single을 Prometheus 원격 저장소로 구성, 7배 압축률 달성 |
| 운영 | Prometheus 30일 로컬 + VictoriaMetrics 365일 장기 보존 이중화 |
| 보안 | N2SF O등급 메트릭 데이터만 저장, 접근통제 NetworkPolicy 적용 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | Prometheus 단독 사용 시 30일 보존 한계, CSAP D-06 1년 보존 요건 미충족. 대시보드 쿼리 지연 발생 |
| WHO | SRE 팀, 보안 담당자, 감리 수검자 |
| RISK | VictoriaMetrics 장애 시 장기 메트릭 손실 → remote_write 재시도 + 로컬 WAL 백업으로 완화 |
| SUCCESS | matchRate >= 90%, 365일 보존 구성, 쿼리 응답 < 2초 |
| SCOPE | VictoriaMetrics Single 배포, Prometheus remote_write 연동, Grafana 데이터소스 추가 |

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 | 검증 방법 |
|----|---------|---------|----------|
| FR-N89.1 | VictoriaMetrics Single Helm 차트 구성 (k3s/WSL2 최적화) | HIGH | 배포 스크립트 실행 확인 |
| FR-N89.2 | Prometheus remote_write 연동 구성 | HIGH | 메트릭 수신 확인 |
| FR-N89.3 | VictoriaMetrics 365일 데이터 보존 정책 | HIGH | retention 파라미터 검증 |
| FR-N89.4 | Grafana VictoriaMetrics 데이터소스 추가 | MED | 대시보드 쿼리 정상 확인 |
| FR-N89.5 | NetworkPolicy 접근통제 (monitoring NS 내부만 허용) | HIGH | 네트워크 정책 검증 |
| FR-N89.6 | 리소스 제한 (WSL2 환경: CPU 500m, RAM 1Gi) | MED | values.yaml 리소스 설정 |
| FR-N89.7 | 모니터링 셋업 스크립트 통합 | MED | setup-monitoring.sh 연동 |

---

## 비기능 요구사항

| ID | 요구사항 | 기준 |
|----|---------|------|
| NFR-N89.1 | 쿼리 응답 시간 | p99 < 2초 (30일 범위 쿼리) |
| NFR-N89.2 | 데이터 압축률 | Prometheus 대비 5배 이상 |
| NFR-N89.3 | 가용성 | 99.9% (Prometheus WAL 백업) |
| NFR-N89.4 | CSAP D-06 준수 | 1년 메트릭 보존 |

---

## 산출물 목록

| 산출물 | 경로 | 형식 |
|--------|------|------|
| VictoriaMetrics Helm values | `infra/monitoring/victoriametrics/values.yaml` | YAML |
| Prometheus remote_write 패치 | `infra/monitoring/kube-prometheus-stack/values.yaml` (수정) | YAML |
| Grafana 데이터소스 | `infra/monitoring/victoriametrics/grafana-datasource.yaml` | YAML |
| NetworkPolicy | `infra/monitoring/victoriametrics/network-policy.yaml` | YAML |
| 검증 스크립트 | `scripts/test-victoriametrics.sh` | Bash |
| 설계 문서 | `docs/02-design/mtus/MTU-N89.design.md` | Markdown |

---

## 추적성 매트릭스

| FR ID | Design 섹션 | 구현 파일 | 테스트 | CSAP |
|-------|-----------|----------|--------|------|
| FR-N89.1 | Design §2.1 | victoriametrics/values.yaml | test-victoriametrics.sh #1 | D-06 |
| FR-N89.2 | Design §2.2 | kube-prometheus-stack/values.yaml | test-victoriametrics.sh #2 | D-06 |
| FR-N89.3 | Design §2.3 | victoriametrics/values.yaml | test-victoriametrics.sh #3 | D-06 |
| FR-N89.4 | Design §2.4 | grafana-datasource.yaml | test-victoriametrics.sh #4 | - |
| FR-N89.5 | Design §2.5 | network-policy.yaml | test-victoriametrics.sh #5 | D-08 |
| FR-N89.6 | Design §2.6 | victoriametrics/values.yaml | test-victoriametrics.sh #6 | - |
| FR-N89.7 | Design §2.7 | setup-monitoring.sh | test-victoriametrics.sh #7 | - |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
