# MTU-N12: Deploy 파이프라인 완성 Plan

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N12 |
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
| **WHY** | 현재 deploy.yml의 레지스트리 push가 주석 처리됨. Harbor 연동 + self-hosted runner로 전환하여 WSL2에서 완전한 CI/CD 파이프라인 실현 |
| **WHO** | DevOps 엔지니어, 개발팀 |
| **RISK** | Harbor 인증 secrets 설정 누락, kubeconfig 경로 오류, self-hosted runner 권한 부족 |
| **SUCCESS** | git push -> CI -> 이미지 빌드 -> Harbor push -> k3s helm deploy 전체 자동화 완료 |
| **SCOPE** | `.gitea/workflows/deploy.yml` 수정, `.gitea/workflows/ci.yml` 수정 |

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 |
|-------|---------|---------|
| FR-N12.1 | deploy.yml 레지스트리 push 활성화 | P0 |
| FR-N12.2 | Harbor 인증 (secrets.HARBOR_USERNAME, HARBOR_PASSWORD) | P0 |
| FR-N12.3 | self-hosted runner (runs-on: self-hosted) 전환 | P0 |
| FR-N12.4 | helm deploy에 Harbor 레지스트리 URL 연동 | P0 |
| FR-N12.5 | ci.yml self-hosted runner 옵션 추가 | P1 |
| FR-N12.6 | 배포 환경별 분기 (stg/prod) | P1 |

---

## 산출물 목록

| 산출물 | 경로 | 형식 |
|--------|------|------|
| Deploy 워크플로우 | `.gitea/workflows/deploy.yml` | YAML (수정) |
| CI 워크플로우 | `.gitea/workflows/ci.yml` | YAML (수정) |
