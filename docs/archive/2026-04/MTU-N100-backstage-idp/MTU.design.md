# MTU-N100: Backstage IDP -- Design

> **MTU ID**: MTU-N100
> **Plan 참조**: docs/01-plan/mtus/MTU-N100-backstage-idp.plan.md
> **작성일**: 2026-04-10

---

## Design Anchor

| 항목 | 내용 |
|------|------|
| 목표 | IDP 서비스 카탈로그 + 셀프서비스 템플릿 + TechDocs |
| 제약 | Gitea 연동 (GitHub 아님), 로컬 k3s 배포 |
| 검증 | 카탈로그 등록, 템플릿 실행, TechDocs 빌드 |

## 아키텍처

```
[개발자] --> [Backstage Portal]
                |
         +------+------+------+
         |      |      |      |
    [Catalog] [Templates] [TechDocs] [K8s Plugin]
         |      |      |      |
    [Gitea] [Gitea Actions] [MinIO] [k3s API]
```

### Software Catalog 엔티티

| 종류 | 항목수 | 예시 |
|------|--------|------|
| Component | 15 | auth-service, api-gateway, ai-service |
| API | 5 | REST API, gRPC, GraphQL |
| System | 3 | core-platform, ai-platform, compliance |
| Resource | 5 | PostgreSQL, Redis, MinIO, Harbor |
| Template | 5 | microservice, library, frontend, infra, docs |

### Software Templates

| 템플릿 | 설명 | 생성물 |
|--------|------|--------|
| microservice-template | NestJS 마이크로서비스 | Gitea repo + Dockerfile + Helm + CI |
| library-template | 공용 라이브러리 | Gitea repo + npm publish CI |
| frontend-template | React SPA | Gitea repo + nginx Dockerfile |
| infra-component | Crossplane Claim | XRD Claim + GitOps 설정 |
| compliance-doc | 감리 문서 | 표준 문서 구조 + 추적성 매트릭스 |

## 산출물

| # | 파일 | 설명 |
|---|------|------|
| 1 | infra/backstage/install.yaml | Helm values |
| 2 | infra/backstage/app-config.yaml | Backstage 설정 |
| 3 | infra/backstage/catalog/ | 카탈로그 엔티티 |
| 4 | infra/backstage/templates/ | Software Templates |
| 5 | infra/backstage/techdocs-config.yaml | TechDocs 설정 |
| 6 | tests/e2e/test-backstage-idp.sh | E2E 테스트 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 설계 | PM Agent |
