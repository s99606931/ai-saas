# MTU-N05: Gitea Actions E2E 통합 -- Design 문서

> **문서 ID**: DESIGN-MTU-N05
> **버전**: 1.0.0
> **작성일**: 2026-04-08
> **Plan 참조**: PLAN-MTU-N05
> **상태**: 승인

---

## 설계 결정

기존 `.gitea/workflows/ci.yml`에 E2E 테스트 job을 추가합니다.

### CI 파이프라인 확장 구조

```
ci.yml:
  job: ci (기존 -- Build & Test)
    + E2E 테스트 단계 추가
  job: e2e (신규)
    needs: ci
    steps: pnpm install -> E2E 테스트 실행
  job: helm-lint (신규)
    steps: helm lint
```

### deploy.yml 확장

```
deploy.yml:
  job: helm-deploy (신규)
    needs: build-and-push
    steps: helm upgrade --install
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 초기 작성 | PM Lead |
