# Design: MTU-N245 GitOps 환경 승격 자동화 및 Canary 롤백

> **버전**: 1.0.0 | **작성일**: 2026-04-11 | **작성자**: PM Lead (infra-architect)

---

## Design Anchor

| 항목 | 값 |
|------|---|
| 패턴 | Progressive Delivery + Image Automation |
| 승격 | Flux ImagePolicy (자동) + 수동 스크립트 (폴백) |
| 롤백 | Flagger Canary (자동 메트릭 기반) |
| 보안 | Kyverno verify-image 정책 연동 |

---

## S3. 상세 설계

### S3.1 Base 매니페스트 (FR-N245.1)

deploy/base에 공통 Deployment와 Service 템플릿을 추가합니다.
실제 서비스별 설정은 env overlay에서 패치합니다.

### S3.2 Flux Image Automation (FR-N245.2)

```
ImageRepository → ImagePolicy → ImageUpdateAutomation
→ deploy/envs/{env}/kustomization.yaml의 이미지 태그 자동 갱신
→ Git 커밋 생성 → Flux 동기화
```

정책:
- dev: latest 태그 자동 반영 (주기: 1분)
- stg: dev에서 검증된 이미지만 (semver, 주기: 5분)
- prod: 릴리스 태그만 (v*.*.*, suspend 가능)

### S3.3 Flagger Canary 확장 (FR-N245.3)

api-gateway 외에 핵심 서비스(auth, tenant, audit)에 Canary 적용:
- 진행: 10% → 30% → 60% → 100%
- 분석 간격: 30초
- 롤백 기준: 성공률 <99% 또는 p99 >500ms
- 메트릭: Prometheus

### S3.4 환경 승격 스크립트 (FR-N245.4)

```bash
scripts/promote-env.sh --from dev --to stg --service api-gateway --version v1.2.3
# 1. dev 환경에서 해당 버전 헬스체크 확인
# 2. stg overlay의 이미지 태그 업데이트
# 3. Git 커밋 + 푸시 (Flux 자동 동기화 트리거)
```

### S3.5 프로덕션 승인 게이트 (FR-N245.5)

Flux Kustomization suspend/resume을 Gitea Actions에서 제어:
```
stg 검증 완료 → PR 생성 (prod overlay 업데이트)
→ 수동 승인 → merge → Flux 동기화
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 최초 설계 | PM Lead (infra-architect) |
