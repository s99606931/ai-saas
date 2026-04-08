# MTU-DEP3 Plan: Gitea CI/CD 파이프라인

> **버전**: 1.0.0 | **일자**: 2026-04-06 | **작성자**: PM Agent
> **Phase**: D (배포 검증) | **복잡도**: MED
> **참조**: docs/roadmap/next-roadmap.md, master-roadmap.md MTU-I2

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **비즈니스** | 코드 변경 시 자동으로 빌드/테스트/배포하여 품질 보장 |
| **기술** | Gitea Actions (GitHub Actions 호환) — 3종 파이프라인 |
| **보안** | CSAP D-12 시스템 개발 보안 — CI에서 자동 보안 검사 |
| **감리** | INFR-2: CI/CD 자동화, NFR-2: 배포 재현성 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | 수동 빌드/테스트/배포의 인적 오류 방지, 감리 자동 증적 수집 |
| **WHO** | 개발팀, DevOps, 감리관 |
| **RISK** | Gitea Actions 호환성, Self-hosted runner 설정, WSL2 환경 제약 |
| **SUCCESS** | 3종 파이프라인 (빌드/테스트/배포) 전수 통과 |
| **SCOPE** | .gitea/workflows/ YAML 3종 + CI 스크립트 |

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 | 검증 방법 |
|----|---------|---------|---------|
| FR-DEP3.1 | 빌드 파이프라인 (CI) | MUST | PR/push 시 자동 빌드 성공 |
| FR-DEP3.2 | 테스트 파이프라인 | MUST | 단위 테스트 + 타입 체크 통과 |
| FR-DEP3.3 | 배포 파이프라인 (CD) | MUST | main 머지 시 Docker 이미지 빌드 + 태깅 |
| FR-DEP3.4 | 보안 검사 단계 | SHOULD | OWASP 의존성 검사, 시크릿 스캔 |
| FR-DEP3.5 | 감사 로그 생성 | SHOULD | CI 결과를 audit.jsonl에 자동 기록 |
| FR-DEP3.6 | 캐시 최적화 | SHOULD | pnpm store 캐시로 빌드 속도 향상 |
| FR-DEP3.7 | 매트릭스 빌드 | COULD | Node 22 + 향후 Node 24 지원 |

---

## 파이프라인 구성

| 파이프라인 | 트리거 | 단계 | 산출물 |
|-----------|--------|------|--------|
| ci.yml | push, PR | install -> lint -> typecheck -> build -> test | 빌드 성공/실패 |
| security.yml | push (main), 주간 | dependency-audit -> secret-scan | 보안 리포트 |
| deploy.yml | push (main) | build -> docker-build -> tag -> push | Docker 이미지 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 최초 작성 | PM Agent |
