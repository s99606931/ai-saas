# MTU-N11: Harbor 로컬 레지스트리 구성 Plan

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N11 |
| Phase | Phase 3 Infrastructure |
| 버전 | 1.0.0 |
| 상태 | Approved |
| 작성일 | 2026-04-08 |
| 작성자 | PM Lead Agent (Claude Code) |
| 복잡도 | HIGH |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | Docker 이미지 레지스트리(Harbor)를 WSL2에 설치하여 k3s 클러스터가 로컬 이미지를 pull할 수 있도록 구성. CSAP D-11 이미지 무결성 검증 기반 |
| **WHO** | DevOps 엔지니어, 보안 담당자 |
| **RISK** | Harbor 리소스 사용량(메모리 2GB+), HTTP 모드 보안 위험(개발 환경 한정), k3s registries.yaml 설정 오류 |
| **SUCCESS** | Harbor localhost:8080 접속 + public-saas 프로젝트 생성 + k3s에서 이미지 pull 성공 |
| **SCOPE** | `scripts/setup-harbor-wsl2.sh`, Harbor 설치 가이드, k3s registries.yaml |

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 |
|-------|---------|---------|
| FR-N11.1 | Harbor offline installer 다운로드 및 설치 자동화 | P0 |
| FR-N11.2 | HTTP 모드 설정 (개발 환경, TLS 없음) | P0 |
| FR-N11.3 | public-saas 프로젝트 자동 생성 | P0 |
| FR-N11.4 | k3s registries.yaml 자동 설정 | P0 |
| FR-N11.5 | Docker insecure-registry 설정 | P1 |
| FR-N11.6 | Harbor 헬스체크 및 상태 확인 | P1 |

---

## 산출물 목록

| 산출물 | 경로 | 형식 |
|--------|------|------|
| Harbor 설치 스크립트 | `scripts/setup-harbor-wsl2.sh` | Bash |
| k3s 레지스트리 설정 | `infra/harbor/registries.yaml` | YAML |
| Harbor 환경변수 템플릿 | `infra/harbor/.env.example` | ENV |
