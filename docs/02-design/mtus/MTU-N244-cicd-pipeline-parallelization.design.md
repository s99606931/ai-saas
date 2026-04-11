# Design: MTU-N244 CI/CD 파이프라인 병렬화 및 모노레포 최적화

> **버전**: 1.0.0 | **작성일**: 2026-04-11 | **작성자**: PM Lead (infra-architect)

---

## Design Anchor

| 항목 | 값 |
|------|---|
| 패턴 | Fan-out/Fan-in Pipeline + Affected Build Detection |
| 변경 감지 | git diff --name-only 기반 경로 매칭 |
| 캐시 전략 | pnpm store (lockfile 해시) + Docker BuildKit GHA |
| 병렬화 | lint/typecheck 분리 → build → test (의존 순서) |

---

## S3. 상세 설계

### S3.1 CI 워크플로우 Job 병렬화 (FR-N244.1)

현재 ci.yml은 단일 `ci` job에서 순차적으로 typecheck → lint → build → test를 실행합니다.
이를 다음과 같이 분리합니다:

```
                  ┌─ lint (병렬) ─────────┐
checkout+install ─┤                       ├─ test (build 의존)
                  └─ typecheck (병렬) ────┘
                       └─ build (병렬) ───┘
```

**Job 구조**:
- `setup`: checkout + pnpm install (캐시 활용)
- `lint`: lint 검사 (setup 완료 후 즉시)
- `typecheck`: 타입 검사 (setup 완료 후 즉시, lint과 병렬)
- `build`: 빌드 (setup 완료 후 즉시, lint/typecheck와 병렬)
- `test`: 테스트 (build 완료 후)
- `e2e`: E2E 테스트 (build 완료 후, PR만)
- `helm-lint`: Helm 검증 (의존 없음, 즉시 병렬)

### S3.2 모노레포 변경 감지 (FR-N244.2, FR-N244.5)

```yaml
# 변경 감지 로직
# 1. git diff로 변경된 파일 경로 추출
# 2. 경로에서 서비스/패키지 이름 추출
# 3. 의존성 그래프 기반 영향 범위 확대
# 4. 공통 패키지(packages/) 변경 → 전체 빌드 폴백

경로 매핑:
  platform/services/{name}/ → 해당 서비스만 빌드
  platform/packages/{name}/ → 전체 서비스 빌드 (공유 의존)
  platform/apps/{name}/     → 해당 앱만 빌드
  infra/**                  → 인프라 검증만
  .gitea/workflows/**       → CI 자체 검증
```

### S3.3 pnpm 캐시 최적화 (FR-N244.3)

```yaml
# 캐시 키 체인 (가장 구체적 → 일반적)
key: ${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}
restore-keys: |
  ${{ runner.os }}-pnpm-
```

**아티팩트 공유**: setup job에서 install 완료 후 node_modules를 아티팩트로 업로드하지 않고,
각 job에서 pnpm store cache를 활용하여 독립적으로 install합니다 (캐시 히트 시 수 초 내 완료).

### S3.4 Docker BuildKit 병렬 빌드 (FR-N244.4)

ci-cd-pipeline.yml의 build-images job이 이미 matrix 전략을 사용합니다.
추가 최적화:
- `max-parallel` 제한 해제 (현재 없음 → 그대로 유지)
- 변경 감지 결과를 matrix에 동적으로 주입
- 미변경 서비스는 이전 이미지 태그 재사용

### S3.5 벤치마크 스크립트 (FR-N244.6)

파이프라인 실행 시간을 측정하고 비교하는 스크립트:
- Gitea API로 최근 N회 실행 시간 조회
- 평균/중간값/최대값 계산
- 이전 대비 개선율 계산

### S3.6 CI/CD 통합 워크플로우 참조 (FR-N244.7)

ci-cd-pipeline.yml에서 CI 단계를 ci.yml의 workflow_call로 참조하여 중복 제거.

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 최초 설계 | PM Lead (infra-architect) |
