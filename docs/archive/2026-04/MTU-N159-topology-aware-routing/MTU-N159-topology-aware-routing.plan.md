# MTU-N159: 토폴로지 인식 라우팅 — Plan

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead  
> **상태**: Draft → Review

---

## 1. Executive Summary (4관점 테이블)

| 관점 | 현황 | 목표 | 성공지표 |
|------|------|------|----------|
| 성능 | 서비스 간 라우팅이 토폴로지 무관하게 랜덤 분배 | 동일 존/노드 우선 라우팅으로 지연시간 감소 | P99 레이턴시 20% 이상 감소 |
| 비용 | 크로스존 트래픽 비용 비가시적 | 존 내부 트래픽 우선으로 네트워크 비용 절감 | 크로스존 트래픽 50% 이상 감소 |
| 운영 | 트래픽 라우팅 수동 관리 | Kubernetes 네이티브 TAR + Linkerd 연동 자동화 | 운영자 개입 없이 자동 라우팅 |
| 보안 | 기본 라우팅으로 보안 경계 미구분 | N2SF 네트워크 격리 영역 내 트래픽 우선 | CSAP D-08 네트워크 격리 준수 |

---

## 2. Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 멀티존/멀티노드 환경에서 크로스존 트래픽은 지연시간 증가와 비용 상승의 원인. 토폴로지 인식 라우팅으로 동일 존 내 트래픽을 우선 라우팅하여 성능 및 비용 최적화 |
| WHO | 플랫폼 운영자, SRE 팀, 네트워크 관리자 |
| RISK | 존 내 엔드포인트 부족 시 서비스 장애 가능, Linkerd와 TAR 동시 사용 시 충돌 가능 |
| SUCCESS | TAR 정책 적용, Linkerd 존 인식 라우팅, 모니터링 대시보드, 페일오버 자동화 |
| SCOPE | Kubernetes TopologyAwareHints, Linkerd 토폴로지 라우팅, 모니터링, 페일오버 정책 |

---

## 3. 기능 요구사항

| FR ID | 요구사항 | 우선순위 | 검증 방법 |
|-------|---------|---------|----------|
| FR-N159.1 | Kubernetes Service에 topology-mode: Auto 어노테이션 적용 | HIGH | 매니페스트 검증 |
| FR-N159.2 | 노드별 topology.kubernetes.io/zone 레이블 설정 스크립트 | HIGH | 스크립트 실행 검증 |
| FR-N159.3 | Linkerd ServiceProfile에 존 인식 라우팅 정책 추가 | HIGH | 설정 검증 |
| FR-N159.4 | 크로스존 트래픽 모니터링 Prometheus 규칙 | MED | 메트릭 쿼리 검증 |
| FR-N159.5 | 존 내 엔드포인트 부족 시 자동 페일오버 정책 | MED | 시뮬레이션 검증 |
| FR-N159.6 | Grafana 토폴로지 라우팅 대시보드 | MED | 대시보드 JSON 검증 |
| FR-N159.7 | 운영 런북 (토폴로지 라우팅 장애 대응) | LOW | 문서 검증 |

---

## 4. 비기능 요구사항

| NFR ID | 요구사항 | 기준 |
|--------|---------|------|
| NFR-N159.1 | 동일 존 라우팅 비율 90% 이상 | Prometheus 메트릭 |
| NFR-N159.2 | 페일오버 전환 시간 30초 이내 | SLO 검증 |
| NFR-N159.3 | TAR 활성화로 인한 CPU 오버헤드 5% 미만 | 벤치마크 |
| NFR-N159.4 | CSAP D-08 네트워크 접근 통제 준수 | 감리 체크리스트 |

---

## 5. 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | 토폴로지 존 레이블 설정 스크립트 | `scripts/setup-topology-labels.sh` |
| 2 | TAR 서비스 패치 매니페스트 | `infra/topology-routing/tar-service-patch.yaml` |
| 3 | Linkerd 존 인식 라우팅 설정 | `infra/topology-routing/linkerd-zone-routing.yaml` |
| 4 | 페일오버 정책 ConfigMap | `infra/topology-routing/failover-policy.yaml` |
| 5 | Prometheus 크로스존 트래픽 규칙 | `infra/topology-routing/prometheus-rules.yaml` |
| 6 | Grafana 토폴로지 대시보드 | `infra/topology-routing/grafana-dashboard.json` |
| 7 | 운영 런북 | `infra/topology-routing/RUNBOOK.md` |
| 8 | 검증 스크립트 | `scripts/verify-topology-routing.sh` |

---

## 6. 추적성 매트릭스

| FR ID | 산출물 | 테스트 | CSAP |
|-------|--------|--------|------|
| FR-N159.1 | tar-service-patch.yaml | verify-topology-routing.sh | D-08 |
| FR-N159.2 | setup-topology-labels.sh | 스크립트 실행 | D-08 |
| FR-N159.3 | linkerd-zone-routing.yaml | verify-topology-routing.sh | D-09 |
| FR-N159.4 | prometheus-rules.yaml | 규칙 문법 검증 | D-06 |
| FR-N159.5 | failover-policy.yaml | 시뮬레이션 | D-08 |
| FR-N159.6 | grafana-dashboard.json | 대시보드 로드 | D-06 |
| FR-N159.7 | RUNBOOK.md | 문서 검증 | - |

---

## 7. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 작성 | PM Lead |
