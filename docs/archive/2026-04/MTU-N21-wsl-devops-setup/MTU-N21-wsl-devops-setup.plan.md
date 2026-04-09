# MTU-N21: WSL DevOps 환경 완전 구축 — Plan

> **버전**: 1.0.0 | **작성일**: 2026-04-08 | **작성자**: PM Lead
> **복잡도**: HIGH | **의존**: MTU-I1(k3s), MTU-I2(Gitea), MTU-I3(Harbor/Flux)

---

## Executive Summary (4관점)

| 관점 | 내용 |
|------|------|
| 비즈니스 | WSL2 환경에서 완전한 DevOps 파이프라인을 실제 구축하여 온프레미스 개발 환경의 실용성 검증 |
| 기술 | k3s + Gitea + Harbor + Flux + Prometheus/Grafana 통합 환경 구성 |
| 보안 | CSAP D-09(시크릿 관리), D-10(네트워크 격리), D-11(가상화 보안) 준수 |
| 운영 | 원클릭 설치/중지/상태확인 스크립트로 운영 자동화 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 기존 설계 문서와 스크립트는 작성되었으나 실제 WSL2 환경에서 검증되지 않음. 실환경 구축으로 실용성 확인 필수 |
| WHO | 개발팀, DevOps 엔지니어, 신규 합류 개발자 |
| RISK | 포트 충돌, 메모리 부족(30GB 가용), Docker/k3s 네트워크 충돌, WSL2 특유 제한(systemd 등) |
| SUCCESS | 5개 서비스(k3s, Gitea, Harbor, Flux, Prometheus) 모두 Running 상태 달성 |
| SCOPE | WSL2 환경 한정. 운영 환경(물리서버/VM)은 범위 밖 |

---

## 기능 요구사항

| FR ID | 요구사항 | 검증 기준 | CSAP |
|-------|---------|----------|------|
| FR-N21.1 | k3s 클러스터 정상 동작 확인 | kubectl get nodes → Ready | D-11 |
| FR-N21.2 | Gitea + PostgreSQL Docker Compose 기동 | curl http://localhost:3000 → 200 | D-10 |
| FR-N21.3 | Gitea Act Runner 등록 및 실행 | Runner 상태 Online 확인 | D-12 |
| FR-N21.4 | Harbor 레지스트리 설치 및 기동 | curl http://localhost:8080 → 200 | D-11-04 |
| FR-N21.5 | k3s-Harbor 레지스트리 미러 연동 | k3s에서 Harbor 이미지 Pull 가능 | D-11 |
| FR-N21.6 | Flux v2 설치 및 GitOps 부트스트랩 | flux check → 정상 | D-12 |
| FR-N21.7 | Prometheus + Grafana 모니터링 스택 배포 | kubectl get pods -n monitoring → Running | D-06 |
| FR-N21.8 | 전체 서비스 Health Check 통합 확인 | healthcheck.sh → 모든 서비스 PASS | - |

---

## 비기능 요구사항

| NFR ID | 요구사항 | 기준 |
|--------|---------|------|
| NFR-N21.1 | 전체 설치 소요 시간 | 30분 이내 (네트워크 상태에 따라 변동) |
| NFR-N21.2 | 시스템 자원 사용량 | RAM 8GB 이내, Disk 20GB 이내 |
| NFR-N21.3 | 시크릿 관리 | .env 파일 기반, 자동 생성 비밀번호, 커밋 금지 |
| NFR-N21.4 | 재현 가능성 | 클린 WSL2에서 스크립트만으로 완전 재현 가능 |

---

## 산출물 목록

| 산출물 | 경로 | 설명 |
|--------|------|------|
| Gitea 실행 환경 | infra/gitea/ | docker-compose.yml + .env 검증 완료 |
| Harbor 실행 환경 | infra/harbor/ | Harbor 설치 스크립트 검증 완료 |
| Flux 부트스트랩 | infra/flux/ | Flux 설정 파일 |
| 모니터링 스택 | k8s/monitoring/ | Prometheus + Grafana 배포 매니페스트 |
| 통합 설치 스크립트 | scripts/setup-wsl2-all.sh | 검증 및 수정 완료 |
| 검증 결과 보고 | docs/04-report/MTU-N21.report.md | 설치 검증 결과 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 최초 작성 | PM Lead |
