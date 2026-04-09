# MTU-N28: Gitea + Harbor k3s 마이그레이션 Plan

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N28 |
| Phase | Phase 3 Infrastructure |
| 버전 | 1.0.0 |
| 상태 | Approved |
| 작성일 | 2026-04-08 |
| 작성자 | PM Lead Agent (Claude Code) |
| 복잡도 | HIGH |
| 선행 MTU | MTU-N10 (Gitea Docker), MTU-N11 (Harbor Docker) |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | Gitea/Harbor를 Docker Compose에서 k3s로 마이그레이션하여 통합 오케스트레이션 환경 구축. 단일 k3s 클러스터에서 CI/CD + 애플리케이션을 통합 관리하여 운영 복잡도 감소 |
| **WHO** | DevOps 엔지니어, 개발팀, 보안 담당자 |
| **RISK** | Gitea DB 데이터 마이그레이션 실패, Harbor 데이터 볼륨 전환 오류, k3s 노드 리소스 부족 (Harbor 메모리 2GB+), NodePort 충돌 |
| **SUCCESS** | Gitea NodePort 30300 접속 + Harbor NodePort 30080 접속 + 기존 Gitea 데이터 보존 + Act Runner 등록 + k3s에서 Harbor pull 성공 |
| **SCOPE** | `k8s/cicd/` 매니페스트, Helm values, registries.yaml 갱신, Docker Compose 종료 |

---

## Executive Summary (4관점)

| 관점 | 목표 | 측정 지표 |
|------|------|---------|
| 기능 | Gitea + Harbor + Act Runner k3s Helm 배포 | 3개 서비스 Running 상태 |
| 보안 | Secret 분리, NetworkPolicy, CSAP D-09/D-10/D-11 | 시크릿 환경변수 관리, 네임스페이스 격리 |
| 품질 | Helm values 검증, PVC 데이터 영속성 | Helm lint 통과, 데이터 보존 확인 |
| 운영 | NodePort 고정, registries.yaml 자동 갱신 | Gitea:30300, Harbor:30080 접속 |

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 |
|-------|---------|---------|
| FR-N28.1 | cicd 네임스페이스 생성 | P0 |
| FR-N28.2 | Gitea Helm 차트 배포 (gitea-charts/gitea) | P0 |
| FR-N28.3 | Gitea 내장 PostgreSQL 또는 별도 StatefulSet | P0 |
| FR-N28.4 | Gitea NodePort 30300 (HTTP), 30222 (SSH) 노출 | P0 |
| FR-N28.5 | Gitea admin 계정 초기화 (saas-admin) | P0 |
| FR-N28.6 | Harbor Helm 차트 배포 (harbor/harbor) | P0 |
| FR-N28.7 | Harbor NodePort 30080 노출 | P0 |
| FR-N28.8 | Harbor Trivy 스캐너 활성화 (CSAP D-11-04) | P1 |
| FR-N28.9 | Act Runner k3s Deployment 배포 | P0 |
| FR-N28.10 | k3s registries.yaml 갱신 (Harbor 30080) | P0 |
| FR-N28.11 | 기존 Gitea Docker 데이터 백업 (pg_dump) | P0 |
| FR-N28.12 | 기존 Docker Compose 서비스 종료 | P1 |
| FR-N28.13 | cicd 네임스페이스 Secret 생성 (Gitea DB, Harbor admin) | P0 |
| FR-N28.14 | PVC 기반 데이터 영속성 (Gitea, Harbor) | P0 |

---

## 비기능 요구사항

| NFR ID | 요구사항 |
|--------|---------|
| NFR-1 | Gitea 응답 시간 3초 이내 |
| NFR-2 | Harbor 이미지 push/pull 정상 동작 |
| NFR-3 | k3s 노드 메모리 사용량 모니터링 (Harbor 2GB+ 필요) |

---

## 산출물 목록

| 산출물 | 경로 | 형식 |
|--------|------|------|
| cicd 네임스페이스 매니페스트 | `k8s/cicd/namespace.yaml` | YAML |
| cicd Secret 매니페스트 | `k8s/cicd/secrets.yaml` | YAML |
| Gitea Helm values | `k8s/cicd/gitea-values.yaml` | YAML |
| Harbor Helm values | `k8s/cicd/harbor-values.yaml` | YAML |
| Act Runner Deployment | `k8s/cicd/act-runner.yaml` | YAML |
| k3s registries.yaml (갱신) | `infra/harbor/registries.yaml` | YAML |
| 마이그레이션 Design | `docs/02-design/mtus/MTU-N28-k3s-cicd-migration.design.md` | Markdown |

---

## 추적성 매트릭스

| FR ID | 산출물 | 검증 방법 | CSAP |
|-------|--------|---------|------|
| FR-N28.1 | namespace.yaml | kubectl get ns cicd | D-10 |
| FR-N28.2 | gitea-values.yaml | helm status gitea -n cicd | - |
| FR-N28.3 | gitea-values.yaml (내장 DB) | kubectl get pods -n cicd | - |
| FR-N28.4 | gitea-values.yaml | curl localhost:30300 | - |
| FR-N28.5 | gitea-values.yaml | Gitea admin 로그인 | D-08 |
| FR-N28.6 | harbor-values.yaml | helm status harbor -n cicd | - |
| FR-N28.7 | harbor-values.yaml | curl localhost:30080 | - |
| FR-N28.8 | harbor-values.yaml | Harbor Trivy 스캔 실행 | D-11-04 |
| FR-N28.9 | act-runner.yaml | kubectl get pods -n cicd (runner) | - |
| FR-N28.10 | registries.yaml | k3s crictl pull 테스트 | D-11 |
| FR-N28.11 | pg_dump 백업 | 백업 파일 존재 확인 | D-07 |
| FR-N28.12 | docker compose down | docker ps 확인 | - |
| FR-N28.13 | secrets.yaml | kubectl get secret -n cicd | D-09 |
| FR-N28.14 | PVC 정의 | kubectl get pvc -n cicd | D-07 |
