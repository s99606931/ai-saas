# MTU-DEP2 Plan: Docker Compose 전체 서비스 기동

> **버전**: 1.0.0 | **일자**: 2026-04-06 | **작성자**: PM Agent
> **Phase**: D (배포 검증) | **복잡도**: MED
> **참조**: docs/roadmap/next-roadmap.md, docker-compose.yml

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **비즈니스** | 전체 마이크로서비스를 단일 명령으로 기동하여 통합 검증 환경 제공 |
| **기술** | Docker Compose 확장 — 인프라 3종 + 마이크로서비스 15종 + 포털 1종 |
| **보안** | CSAP D-11 가상화 보안 준수 (non-root, 읽기 전용 FS, 네트워크 격리) |
| **감리** | INFR-1: 컨테이너 환경 표준화, NFR-1: 단일 명령 기동 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | 15개 마이크로서비스의 통합 동작을 한 번에 검증하기 위한 로컬 배포 환경 필요 |
| **WHO** | 개발자, QA, 감리관 |
| **RISK** | 포트 충돌, 메모리 부족 (WSL2 제한), 서비스 간 의존성 순서 |
| **SUCCESS** | `docker compose up -d` 후 15개 서비스 전수 헬스체크 Green |
| **SCOPE** | docker-compose.yml 확장 + 공통 Dockerfile 템플릿 + 헬스체크 |

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 | 검증 방법 |
|----|---------|---------|---------|
| FR-DEP2.1 | 15개 서비스 Docker 이미지 빌드 | MUST | `docker compose build` 성공 |
| FR-DEP2.2 | 전체 서비스 기동 (단일 명령) | MUST | `docker compose up -d` 성공 |
| FR-DEP2.3 | 헬스체크 엔드포인트 전수 등록 | MUST | `docker compose ps` 전수 healthy |
| FR-DEP2.4 | 서비스 간 네트워크 연결 (내부 DNS) | MUST | 서비스명으로 상호 통신 가능 |
| FR-DEP2.5 | 환경변수 통합 관리 (.env.example) | MUST | .env.example 제공 |
| FR-DEP2.6 | 인프라 의존 서비스 순서 보장 | MUST | depends_on + healthcheck 조건 |
| FR-DEP2.7 | 공통 Dockerfile 패턴 (CSAP D-11) | MUST | non-root, 멀티스테이지 빌드 |
| FR-DEP2.8 | 포털 (Next.js) 컨테이너 포함 | SHOULD | localhost:4000 접근 가능 |
| FR-DEP2.9 | 리소스 제한 설정 | SHOULD | 서비스별 메모리/CPU 제한 |

---

## 서비스 목록 (15 + 인프라 3 + 포털 1 = 19 컨테이너)

| 서비스 | 패키지명 | 포트 | 의존 |
|--------|---------|------|------|
| postgres | - | 5432 | - |
| redis | - | 6379 | - |
| minio | - | 9000/9001 | - |
| api-gateway | @public-saas/api-gateway | 3000 | postgres, redis |
| auth-service | @public-saas/auth-service | 3001 | postgres, redis |
| user-service | @public-saas/user-service | 3002 | postgres |
| tenant-service | @public-saas/tenant-service | 3003 | postgres |
| menu-service | @public-saas/menu-service | 3004 | postgres |
| saas-catalog-service | @public-saas/saas-catalog-service | 3005 | postgres |
| subscription-service | @public-saas/subscription-service | 3006 | postgres |
| billing-service | @public-saas/billing-service | 3007 | postgres |
| crm-service | @public-saas/crm-service | 3008 | postgres |
| ai-service | @public-saas/ai-service | 3009 | redis |
| notification-service | @public-saas/notification-service | 3010 | postgres, redis |
| file-service | @public-saas/file-service | 3011 | postgres, minio |
| audit-service | @public-saas/audit-service | 3012 | postgres |
| compliance-service | @public-saas/compliance-service | 3013 | postgres |
| security-monitor-service | @public-saas/security-monitor-service | 3014 | postgres, redis |
| portal | @public-saas/portal | 4000 | api-gateway |

---

## 비기능 요구사항

| ID | 요구사항 | 기준 |
|----|---------|------|
| NFR-1 | 단일 명령 기동 | `docker compose up -d` |
| NFR-2 | 기동 시간 | 5분 이내 (초기 빌드 제외) |
| NFR-3 | 메모리 사용량 | 전체 8GB 이하 (WSL2 기본 제한) |
| NFR-4 | CSAP D-11 | non-root, 읽기 전용 파일시스템 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 최초 작성 | PM Agent |
