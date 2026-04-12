# 환경 승격 프로세스 — dev → stg → prod 완전 가이드

> **문서 ID**: ONBOARD-06-CICD-09
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **대상**: 개발자, DevOps 엔지니어, 배포 승인자
> **선행 학습**:
>   - `deployment/01-gitops-deploy.md` — GitOps 배포 흐름 이해
>   - `08-blue-green-deployment.md` — Flagger 카나리/블루그린 배포 방식
>   - `pipelines/02-quality-gate.md` — Q-GATE 7단계 품질 게이트 이해
> **소요 시간**: 약 90분
> **CSAP**: D-03 (물리적 환경 보안), D-05 (공급망 보안), D-12 (시스템 개발 보안), D-13 (변경 관리)
> **Design Ref**: MTU-N244 §3, MTU-N249 §3.1
> **Plan SC**: FR-N244.1~FR-N244.5, FR-HF.1~FR-HF.6

---

## 목차

1. [환경 승격이란 무엇인가](#1-환경-승격이란-무엇인가)
2. [실제 환경 승격 워크플로우 분석](#2-실제-환경-승격-워크플로우-분석)
3. [스테이징(stg) 환경 관리](#3-스테이징stg-환경-관리)
4. [프로덕션(prod) 승격 절차](#4-프로덕션prod-승격-절차)
5. [핫픽스 긴급 승격](#5-핫픽스-긴급-승격)
6. [CSAP 환경 관리 요건](#6-csap-환경-관리-요건-d-03-d-05)
7. [문제 상황별 대응](#7-문제-상황별-대응)
8. [학습 체크리스트](#8-학습-체크리스트)

---

## 1. 환경 승격이란 무엇인가

### 1.1 dev, stg, prod 각 환경의 목적

코드는 단번에 프로덕션에 배포되지 않습니다.
여러 환경을 단계적으로 거치며 품질을 검증합니다. 이 과정을 **환경 승격(Environment Promotion)**이라고 합니다.

```
개발자 로컬 PC (dev)
    ↓ git push
feat/* 브랜치 (CI 자동 검증)
    ↓ PR 머지 (Q-Gate 통과)
stg 브랜치 (스테이징 환경)
    ↓ 수동 승인 (팀 리드)
main 브랜치 / v태그 (프로덕션 환경)
```

| 환경 | 브랜치 | 목적 | 접근 권한 | 데이터 |
|------|--------|------|---------|--------|
| 개발(dev) | `feat/*`, `fix/*` | 기능 개발 및 단위 테스트 | 개발자 전원 | 목업/픽스처 |
| 스테이징(stg) | `stg` | 통합 테스트 및 인수 테스트 | 개발팀 + QA | 마스킹된 실제 데이터 |
| 프로덕션(prod) | `main`, `v*` 태그 | 실제 서비스 운영 | 배포 승인자만 | 실제 운영 데이터 |

**왜 여러 환경이 필요한가?**

프로덕션에서 버그가 발생하면 실제 공공기관 사용자에게 영향을 줍니다.
스테이징에서 충분히 검증한 후 승격하면 이런 위험을 사전에 차단할 수 있습니다.

### 1.2 환경 승격의 기준 (Q-Gate 연동)

각 환경 승격에는 자동화된 품질 게이트가 있습니다. 게이트를 통과하지 못하면 승격이 차단됩니다.

| 승격 단계 | 필수 게이트 | 수동 단계 |
|---------|-----------|---------|
| dev → stg (PR 머지) | Q-Gate G1~G7 전체 통과 | 없음 (자동) |
| stg → prod | DORA 게이트 + prod-gate 체크리스트 | 팀 리드 수동 승인 |
| hotfix → stg → prod | 보안 스캔 통과 | stg 통과 후 자동 prod 진행 |

### 1.3 환경 승격 흐름도

```mermaid
flowchart TD
    DEV[개발자 로컬\nfeat/my-feature]
    PR[Pull Request 생성\nstg 또는 main 대상]

    subgraph CI["자동 CI 검증 (ci.yml)"]
        DETECT[변경 감지\ndetect-changes]
        PARALLEL["병렬 실행\nlint + typecheck + build + helm-lint"]
        TEST[테스트\nVitest 단위/통합]
        QGATE["Q-Gate (quality-gate.yml)\nG1~G7 전체 검사"]
        DEVSEC["DevSecOps (devsecops.yml)\nTrivy + Semgrep + Secret 스캔"]
    end

    subgraph STG["스테이징 환경 배포"]
        STG_DEPLOY["stg 브랜치 머지\n→ Harbor 이미지 빌드\n→ Helm Deploy (values-stg.yaml)"]
        STG_SMOKE[Smoke Test 자동 실행]
        STG_TEST[스테이징 인수 테스트\n(수동 또는 자동)]
        STG_DORA["DORA 게이트 (dora-gate.yml)\nCFR 확인"]
    end

    subgraph PROD_GATE["프로덕션 게이트"]
        PROD_CHECK["prod-gate.yaml\n프로덕션 준비 체크리스트"]
        MANUAL_APPROVE[수동 승인\n팀 리드 / 배포 승인자]
    end

    subgraph PROD["프로덕션 배포"]
        TAG[v태그 생성\ne.g. v1.2.3]
        PROD_DEPLOY["프로덕션 배포\ndeploy.yml\nvalues-prod.yaml"]
        CANARY["Flagger 카나리 배포\n5% → 25% → 100%"]
        PROD_SMOKE[프로덕션 Smoke Test]
    end

    ROLLBACK[자동 롤백\nFlagger 또는 helm rollback]
    SUCCESS[배포 완료\n감사 로그 기록]

    DEV --> PR
    PR --> CI
    DETECT --> PARALLEL --> TEST --> QGATE
    QGATE -->|통과| DEVSEC
    QGATE -->|실패| PR
    DEVSEC -->|통과| STG_DEPLOY
    DEVSEC -->|실패| PR

    STG_DEPLOY --> STG_SMOKE --> STG_TEST --> STG_DORA
    STG_DORA -->|CFR < 15%| PROD_CHECK
    STG_DORA -->|CFR > 30%| ROLLBACK

    PROD_CHECK --> MANUAL_APPROVE
    MANUAL_APPROVE -->|승인| TAG --> PROD_DEPLOY --> CANARY
    MANUAL_APPROVE -->|거부| STG_TEST

    CANARY --> PROD_SMOKE
    PROD_SMOKE -->|성공| SUCCESS
    PROD_SMOKE -->|실패| ROLLBACK

    style CI fill:#e3f2fd
    style STG fill:#e8f5e9
    style PROD_GATE fill:#fff3e0
    style PROD fill:#fce4ec
    style ROLLBACK fill:#ffcdd2
    style SUCCESS fill:#c8e6c9
```

### 1.4 각 환경별 데이터 격리 정책

**CSAP D-03**: 환경 간 데이터 분리는 보안 필수 요건입니다.

```
환경별 데이터 격리 원칙

프로덕션(prod):
  - 실제 공공기관 데이터
  - 개발자 직접 접근 절대 금지
  - 모든 접근은 감사 로그에 기록

스테이징(stg):
  - 실제 데이터의 익명화/마스킹 버전
  - PII(개인정보)는 반드시 마스킹 처리
  - 테스트 전용 테넌트 계정 사용
  - stg DB는 prod DB와 완전 분리

개발(dev):
  - 목업 데이터 또는 생성 픽스처만 사용
  - 실제 데이터 복사 절대 금지
```

```bash
# 잘못된 방법 (절대 금지)
pg_dump prod-db | psql stg-db  # 실제 데이터를 stg로 복사

# 올바른 방법 (익명화 후 이관)
pg_dump prod-db | \
  sed 's/real_email@example.com/test_***@masked.invalid/g' | \
  psql stg-db
# 또는 전용 익명화 도구 사용: Faker, Presidio
```

---

## 2. 실제 환경 승격 워크플로우 분석

### 2.1 CI 파이프라인 — ci.yml 분석

`feat/*` 또는 `fix/*` 브랜치에서 `stg` 또는 `main`으로 PR을 열면 자동 시작됩니다.

```yaml
# .gitea/workflows/ci.yml (핵심 부분 발췌)
on:
  push:
    branches: [main, stg, "feat/*", "fix/*"]
  pull_request:
    branches: [main]

jobs:
  detect-changes:
    # 변경된 파일 기반 빌드 범위 결정
    # services/, packages/, infra/, docs/ 변경 감지
    outputs:
      services_changed: ${{ steps.changes.outputs.services_changed }}
      affected_services: ${{ steps.changes.outputs.affected_services }}
```

변경 감지 단계는 전체 빌드를 방지하여 CI 시간을 단축합니다.
문서만 수정했으면 빌드/테스트를 건너뜁니다.

### 2.2 Q-Gate — quality-gate.yml 분석

PR이 머지되기 전 반드시 통과해야 하는 7단계 게이트입니다.

```yaml
# .gitea/workflows/quality-gate.yml (핵심 부분 발췌)
jobs:
  g1-fr-coverage:   # FR ID 전수 검사
  g3-code-quality:  # TypeScript 타입 체크 + ESLint
  g4-test-coverage: # Vitest 커버리지 80%+
  g5-owasp:         # 하드코딩 시크릿 + SQL 주입 패턴 검사
  g7-audit-log:     # audit.jsonl 존재 및 JSON 유효성 검사

  qgate-summary:    # G3, G5 실패 시 머지 차단
    needs: [g1-fr-coverage, g3-code-quality, g4-test-coverage, g5-owasp, g7-audit-log]
```

**게이트 통과 기준**:
- G3 (코드 품질): 필수 — 실패 시 PR 머지 불가
- G5 (OWASP): 필수 — 실패 시 PR 머지 불가
- G1, G4, G7: 경고만 발생 (머지는 가능하나 팀 리드 확인 필요)

### 2.3 배포 파이프라인 — deploy.yml 분석

Q-Gate 통과 후 `stg` 또는 `main` 브랜치에 머지되면 자동 시작됩니다.

```yaml
# .gitea/workflows/deploy.yml (핵심 부분)
on:
  push:
    branches: [main, stg]   # stg 푸시 → stg 환경 배포
    tags: ["v*"]             # v태그 → prod 환경 배포

jobs:
  build-and-push:
    strategy:
      matrix:
        service:
          - api-gateway
          - auth-service
          - subscription-service
          # ... 총 16개 서비스

  helm-deploy:
    needs: [build-and-push, build-portal]
    steps:
      - name: Determine values file
        # stg 브랜치 → values-stg.yaml
        # v태그    → values-prod.yaml
        run: |
          if [[ "${{ github.ref }}" == refs/tags/v* ]]; then
            echo "file=helm/saas-platform/values-prod.yaml"
            echo "release=saas-prod"
          else
            echo "file=helm/saas-platform/values-stg.yaml"
            echo "release=saas-stg"
          fi
```

### 2.4 DORA 게이트 — dora-gate.yml 분석

배포 전에 팀의 변경 실패율을 확인합니다. 실패율이 높으면 배포를 차단합니다.

```yaml
# .gitea/workflows/dora-gate.yml (핵심 부분)
jobs:
  dora-gate:
    steps:
      - name: DORA 게이트 판정
        run: |
          # CFR 30% 초과 → 배포 차단 (exit 1)
          if [ "${CFR_INT}" -gt 30 ]; then
            echo "result=block"
            exit 1
          # CFR 15~30% → 경고 (배포는 허용)
          elif [ "${CFR_INT}" -gt 15 ]; then
            echo "result=warn"
          # CFR 15% 미만 → 정상 통과
          else
            echo "result=pass"
          fi
```

### 2.5 프로덕션 게이트 — prod-gate.yaml 분석

`main` 브랜치 대상 PR을 열면 자동으로 실행되는 프로덕션 준비 체크리스트입니다.

```yaml
# .gitea/workflows/prod-gate.yaml (핵심 부분)
on:
  pull_request:
    branches: [main]  # main 대상 PR만

jobs:
  prod-readiness:
    steps:
      - name: 프로덕션 준비 체크리스트 실행
        run: bash scripts/prod-readiness-check.sh

      - name: 불변 인프라 정책 검증
        run: python3 -c "import yaml; yaml.safe_load_all(open('infra/security/immutable-infra/policy.yaml'))"

      - name: 감사 로그 기록
        if: always()
        run: |
          echo '{"timestamp":"...","action":"PROD_GATE_CHECK","result":"${{ job.status }}","csap":"D-12"}' >> .claude/audit.jsonl
```

### 2.6 롤백 경로

배포가 실패하거나 이상이 감지되면 즉시 롤백이 가능합니다.

```bash
# 방법 1: Helm 롤백 (가장 빠름)
helm rollback saas-prod --namespace saas-platform

# 방법 2: 이전 태그로 재배포 (안전)
git tag v1.2.2  # 이전 안정 버전 태그
git push origin v1.2.2

# 방법 3: Flagger 자동 롤백 (카나리 배포 중 이상 감지 시)
# Flagger가 에러율/응답시간 임계값 초과 시 자동 원복

# 현재 배포 상태 확인
helm history saas-prod --namespace saas-platform
kubectl rollout history deployment/api-gateway --namespace saas-platform
```

---

## 3. 스테이징(stg) 환경 관리

### 3.1 stg 환경에서 테스트해야 할 것들

스테이징은 "프로덕션과 동일한 조건"에서 최종 검증하는 환경입니다.
아래 항목들을 stg에서 반드시 확인한 후 prod로 승격하십시오.

**기능 테스트**:
- 신규 기능이 설계 문서대로 동작하는가
- 피처 플래그가 올바르게 적용되는가
- 다른 서비스(API Gateway, Auth)와 연동이 정상인가

**성능 테스트**:
- P99 응답시간이 SLO 기준 이내인가 (500ms 이하)
- 부하 테스트 시 장애가 없는가

**보안 테스트**:
- Semgrep 스캔에서 NEW 취약점이 없는가
- Trivy 이미지 스캔에서 CRITICAL 취약점이 없는가
- 인증/인가 흐름이 올바른가

**CSAP 점검**:
- 감사 로그가 올바르게 기록되는가
- 에러 응답에 민감 정보가 포함되지 않는가

### 3.2 테스트 데이터 관리 (PII 마스킹 필수)

```bash
# stg 환경 테스트 데이터 생성 스크립트 예시
# CSAP D-12: PII 없는 테스트 데이터 사용

# 잘못된 방법 (절대 금지)
# 실제 개인정보를 stg에 복사하는 것은 N2SF 위반

# 올바른 방법: Faker로 테스트 데이터 생성
cat << 'EOF' > scripts/generate-test-data.ts
import { faker } from '@faker-js/faker/locale/ko';

// 가상의 테넌트 데이터 생성 (실제 기관 정보 미사용)
const testTenants = Array.from({ length: 10 }, () => ({
  name: `테스트기관_${faker.number.int({ min: 100, max: 999 })}`,
  email: faker.internet.email({ provider: 'test.invalid' }),  // 실제 도메인 아님
  phone: '010-0000-0000',  // 고정 마스킹 값
  contactPerson: '테스트담당자',
}));
EOF
```

### 3.3 stg 환경에서 CSAP 점검

스테이징 배포 후 다음 CSAP 관련 항목을 직접 확인합니다.

```bash
# CSAP D-06: 감사 로그 생성 확인
curl -X POST https://stg-api.saas.internal/api/users \
  -H "Authorization: Bearer $STG_TOKEN" \
  -d '{"email":"audit-test@test.invalid","role":"user"}'

# 감사 로그에 기록되었는지 확인
kubectl logs -n saas-stg deployment/audit-service | \
  grep '"action":"USER_CREATE"' | tail -5

# CSAP D-08: 인증 없는 접근 거부 확인
curl -s -o /dev/null -w "%{http_code}" \
  https://stg-api.saas.internal/api/admin/users
# 예상 결과: 401

# CSAP D-12: 에러 응답에 민감 정보 없음 확인
curl https://stg-api.saas.internal/api/users/invalid-id \
  -H "Authorization: Bearer $STG_TOKEN" | jq .
# 예상 결과: {"error": "Not Found", "errorId": "uuid-..."}
# 금지: stack trace, DB 연결 문자열 등 노출
```

### 3.4 stg 환경 테스트 체크리스트 흐름도

```mermaid
flowchart TD
    START[stg 배포 완료]

    subgraph BASIC["기본 헬스체크"]
        H1[모든 Pod가 Running 상태인가?]
        H2[/healthz 엔드포인트 200 응답?]
        H3[Prometheus 스크래핑 타겟 UP?]
    end

    subgraph FUNC["기능 검증"]
        F1[신규 기능 동작 확인]
        F2[API 엔드포인트 응답 정상?]
        F3[피처 플래그 적용 확인]
        F4[서비스 간 통신 정상?]
    end

    subgraph SECURITY["보안 점검 (CSAP)"]
        S1[인증 없는 접근 거부 확인\nCSAP D-08]
        S2[감사 로그 기록 확인\nCSAP D-06]
        S3[에러 응답 민감정보 미노출\nCSAP D-12]
        S4[TLS 연결 확인\nCSAP D-09]
    end

    subgraph PERF["성능 검증"]
        P1[P99 응답시간 < 500ms?]
        P2[에러율 < 0.1%?]
        P3[메모리 사용량 정상?]
    end

    DECISION{모든 항목\n통과?}

    START --> BASIC
    H1 --> H2 --> H3
    H3 --> FUNC
    F1 --> F2 --> F3 --> F4
    F4 --> SECURITY
    S1 --> S2 --> S3 --> S4
    S4 --> PERF
    P1 --> P2 --> P3
    P3 --> DECISION

    DECISION -->|예 (모두 통과)| READY[프로덕션 승격 요청 가능]
    DECISION -->|아니오 (하나라도 실패)| FIX[문제 수정 후 재배포]
    FIX --> START

    style BASIC fill:#e3f2fd
    style FUNC fill:#e8f5e9
    style SECURITY fill:#fff3e0
    style PERF fill:#fce4ec
    style READY fill:#c8e6c9
    style FIX fill:#ffcdd2
```

---

## 4. 프로덕션(prod) 승격 절차

### 4.1 승격 전 최종 체크리스트 (20개 이상)

프로덕션 배포 전 팀 리드가 확인해야 할 체크리스트입니다.
`scripts/prod-readiness-check.sh`가 이 중 자동화 가능한 항목을 자동 점검합니다.

**코드 품질 (자동 검증)**

- [ ] Q-Gate G1: Plan 문서에 FR ID가 정의되어 있는가
- [ ] Q-Gate G3: TypeScript 타입 오류가 없는가
- [ ] Q-Gate G3: ESLint 오류가 없는가
- [ ] Q-Gate G4: 테스트 커버리지가 80% 이상인가
- [ ] Q-Gate G5: 하드코딩된 시크릿이 없는가
- [ ] Q-Gate G5: SQL 직접 결합 패턴이 없는가
- [ ] Q-Gate G7: audit.jsonl 파일이 존재하고 유효한가

**보안 (자동 검증)**

- [ ] DevSecOps: Trivy IaC 스캔에서 CRITICAL 취약점 없음
- [ ] DevSecOps: Semgrep SAST에서 ERROR 등급 발견 없음
- [ ] DevSecOps: 의존성 감사에서 알려진 취약점 없음
- [ ] DevSecOps: 컨테이너 이미지 Cosign 서명 완료
- [ ] DORA 게이트: 변경 실패율(CFR) 15% 미만

**배포 준비 (수동 확인)**

- [ ] 스테이징에서 Smoke Test 통과 확인
- [ ] 스테이징에서 CSAP 보안 점검 완료
- [ ] DB 마이그레이션 스크립트가 있다면 롤백 방법 확인
- [ ] 배포 시간이 점검 시간과 겹치지 않는지 확인 (업무 시간 외 권장)
- [ ] On-call 담당자 대기 확인 (배포 후 1시간)
- [ ] 배포 완료 공지 채널 준비

**비즈니스 준비 (선택적)**

- [ ] 신규 기능에 대한 사용자 공지 준비 (해당 시)
- [ ] 관련 기관 담당자에게 사전 안내 완료 (해당 시)
- [ ] 피처 플래그로 점진적 활성화 계획 수립

### 4.2 수동 승인 요청 방법 (Gitea UI)

1. `stg` 브랜치의 변경사항을 검토합니다.

2. `main` 브랜치 대상으로 Pull Request를 생성합니다.
   ```bash
   # 현재 stg 브랜치에서 main 대상 PR 생성
   git checkout stg
   git pull origin stg

   # Gitea UI에서 PR 생성
   # 제목: feat: [배포 항목 요약]
   # 설명: 변경 내용, 스테이징 검증 결과, 체크리스트 포함
   ```

3. PR 생성 시 `prod-gate.yaml`이 자동 실행됩니다.
   - 프로덕션 준비 체크리스트 100항목 검증
   - 불변 인프라 정책 검증
   - 감사 로그에 PROD_GATE_CHECK 기록

4. 팀 리드 또는 지정된 승인자가 Gitea UI에서 PR을 리뷰하고 승인합니다.
   - Gitea Settings > Branches > Protected branches에서 최소 승인자 1명 설정

5. 승인 후 PR을 머지합니다. **Squash 머지 금지** — 이력 보존 필요 (CSAP D-13)

6. 머지 완료 후 버전 태그를 생성합니다.
   ```bash
   git checkout main
   git pull origin main
   git tag -a v1.2.3 -m "feat: [릴리즈 내용]"
   git push origin v1.2.3
   ```

7. 태그 생성 시 `deploy.yml`이 자동 실행되어 프로덕션 배포가 시작됩니다.

### 4.3 배포 완료 후 Smoke Test

```bash
# 프로덕션 Smoke Test 스크립트
#!/bin/bash
# scripts/prod-smoke-test.sh

PROD_API="https://api.saas.example.gov.kr"
TOKEN="${PROD_HEALTH_CHECK_TOKEN}"

echo "=== 프로덕션 Smoke Test 시작 ==="

# 1. 헬스체크
for svc in api-gateway auth-service subscription-service; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    "${PROD_API}/healthz" \
    -H "X-Service: $svc" || echo "000")

  if [ "$HTTP_CODE" != "200" ]; then
    echo "[FAIL] $svc 헬스체크 실패: $HTTP_CODE"
    exit 1
  fi
  echo "[OK] $svc 헬스체크 통과"
done

# 2. 인증 엔드포인트 동작 확인
AUTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  "${PROD_API}/api/auth/me" \
  -H "Authorization: Bearer ${TOKEN}")

if [ "$AUTH_RESPONSE" = "200" ]; then
  echo "[OK] 인증 엔드포인트 정상"
else
  echo "[FAIL] 인증 엔드포인트 실패: $AUTH_RESPONSE"
  exit 1
fi

# 3. 감사 로그 기록 확인
echo "=== Smoke Test 완료 ==="
echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","action":"SMOKE_TEST_PASS","env":"production"}' \
  >> .claude/audit.jsonl
```

### 4.4 이상 감지 시 자동 롤백 조건

Flagger는 카나리 배포 중 다음 조건을 감지하면 자동으로 롤백합니다.

```yaml
# helm/saas-platform/templates/canary.yaml (Flagger 설정)
analysis:
  interval: 1m
  threshold: 3        # 3회 연속 실패 시 롤백
  maxWeight: 50       # 최대 50% 트래픽까지 카나리로 전환
  stepWeight: 10      # 10%씩 점진적 증가

metrics:
  # 조건 1: 에러율 1% 초과
  - name: error-rate
    thresholdRange:
      max: 1
    interval: 30s

  # 조건 2: P99 응답시간 500ms 초과
  - name: latency
    thresholdRange:
      max: 500
    interval: 30s
```

롤백 발생 시 즉시 알림이 발송되고 감사 로그에 기록됩니다.

```bash
# 수동 롤백 (긴급 시)
kubectl -n saas-platform annotate canary/api-gateway \
  flagger.app/action=rollback

# 상태 확인
kubectl -n saas-platform describe canary/api-gateway
```

---

## 5. 핫픽스 긴급 승격

### 5.1 일반 승격 vs 핫픽스 승격 차이

| 항목 | 일반 승격 | 핫픽스 승격 |
|------|---------|-----------|
| 브랜치 | `feat/*` → `stg` → `main` | `hotfix/*` → 직접 prod |
| CI 범위 | 전체 스위트 | 영향 범위 테스트만 |
| 스테이징 체류 | 최소 1일 권장 | Smoke Test 통과 즉시 |
| 수동 승인 | 팀 리드 1명 | 팀 리드 + 보안 담당자 2명 |
| Q-Gate | G1~G7 전체 | G3, G5 필수만 |
| 감사 로그 | 표준 기록 | HOTFIX_DEPLOY 특수 태그 |

**핫픽스 대상**:
- 프로덕션 서비스 장애 (Critical)
- 보안 취약점 즉시 패치 (Critical/High)
- 데이터 정합성 오류
- 법적 의무 사항 위반 수정

### 5.2 핫픽스 브랜치 생성 및 워크플로우

```bash
# 1. 핫픽스 브랜치 생성 (main 기반)
git checkout main
git pull origin main
git checkout -b hotfix/CVE-2026-XXXX-auth-bypass

# 2. 수정 작업
# ... 버그 수정 ...

# 3. 푸시 (hotfix-pipeline.yaml 자동 실행)
git push origin hotfix/CVE-2026-XXXX-auth-bypass
```

`hotfix-pipeline.yaml`은 다음 순서로 자동 실행됩니다:

```yaml
# .gitea/workflows/hotfix-pipeline.yaml (핵심 흐름)
#
# Stage 1: 빌드 + 테스트 (영향 범위만)
# Stage 2: 보안 스캔 (Trivy + Cosign 서명)
# Stage 3: 스테이징 배포 + Smoke Test
# Stage 4: 프로덕션 배포 (수동 승인 — environment: production)

jobs:
  staging-deploy:
    environment: staging  # stg 환경 승인 설정
    steps:
      - name: Smoke Test 실행
        run: bash scripts/hotfix-deploy.sh --verify-only --namespace staging

      - name: 실패 시 스테이징 롤백
        if: failure()
        run: helm rollback saas-platform --namespace staging

  production-deploy:
    needs: staging-deploy
    environment: production  # prod 환경 — 수동 승인 게이트
    steps:
      - name: 감사 로그 기록
        run: |
          echo '{"timestamp":"...","action":"HOTFIX_DEPLOY","tag":"...","actor":"..."}' \
            >> .claude/audit.jsonl

      - name: 실패 시 자동 롤백
        if: failure()
        run: bash scripts/hotfix-rollback.sh --namespace production
```

### 5.3 긴급 승격 시 최소 체크리스트

일반 체크리스트(20개 이상)를 모두 확인할 시간이 없을 때 최소한 확인해야 할 항목입니다.

```
핫픽스 최소 체크리스트 (10분 이내 완료)

필수 (SKIP 불가):
  [ ] 수정 내용이 버그 Fix에 집중되어 있는가 (기능 추가 없음)
  [ ] 영향 범위 테스트가 통과했는가
  [ ] Trivy 스캔에서 NEW CRITICAL 취약점 없음
  [ ] stg Smoke Test 통과
  [ ] 팀 리드 + 보안 담당자 2명 승인 완료
  [ ] 롤백 방법을 사전에 확인했는가

권장 (시간 허용 시):
  [ ] 관련 기관에 서비스 영향 사전 공지
  [ ] 배포 후 15분 집중 모니터링 담당자 지정
  [ ] 감사 로그에 핫픽스 사유 기록
```

### 5.4 CSAP 긴급 변경 기록 방법

핫픽스는 CSAP D-13(변경 관리) 기록이 더욱 중요합니다.

```bash
# CSAP D-13: 긴급 변경 기록
cat << EOF >> .claude/audit.jsonl
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "action": "EMERGENCY_CHANGE",
  "actor": "${GITHUB_ACTOR}",
  "branch": "${GITHUB_REF_NAME}",
  "change_reason": "CVE-2026-XXXX auth bypass 패치",
  "impact_scope": "auth-service, api-gateway",
  "approvers": ["팀리드명", "보안담당자명"],
  "rollback_plan": "helm rollback saas-prod --namespace saas-platform",
  "csap_ref": "D-13"
}
EOF
```

---

## 6. CSAP 환경 관리 요건 (D-03, D-05)

### 6.1 환경 분리 증거 수집

CSAP 감리 시 환경 분리 증거를 제출해야 합니다.

**네트워크 분리 증거**:
```bash
# 각 환경이 별도 네임스페이스에 격리되어 있음 확인
kubectl get namespaces | grep saas
# 예상 출력:
# saas-platform   Active   30d   (prod)
# saas-stg        Active   30d   (stg)
# saas-dev        Active   10d   (dev)

# NetworkPolicy로 환경 간 통신 차단 확인
kubectl get networkpolicy -n saas-platform
kubectl get networkpolicy -n saas-stg
```

**데이터 분리 증거**:
```bash
# 각 환경이 별도 DB를 사용하는지 확인
kubectl get configmap -n saas-platform saas-config -o yaml | grep DATABASE_URL
# 예상: postgresql://prod-db.saas-platform.svc:5432/saas_prod

kubectl get configmap -n saas-stg saas-config -o yaml | grep DATABASE_URL
# 예상: postgresql://stg-db.saas-stg.svc:5432/saas_stg
# (prod와 다른 DB 인스턴스)
```

### 6.2 prod 직접 접근 제한 (감사 로그)

CSAP D-08: 프로덕션 환경에 대한 직접 접근은 반드시 기록됩니다.

```bash
# 프로덕션 Pod에 직접 접속하는 경우 (긴급 디버깅 시에만)
kubectl exec -it -n saas-platform deployment/api-gateway -- /bin/sh
# → 이 명령은 감사 로그에 자동 기록됩니다 (Kubernetes Audit Log)

# 프로덕션 DB 직접 쿼리 (절대 금지 — 감리 결함)
# kubectl port-forward svc/prod-db 5432:5432  ← 이 작업은 CSAP D-08 위반

# 올바른 방법: 읽기 전용 API를 통한 데이터 조회
curl https://api.saas.example.gov.kr/api/admin/tenants \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"
```

### 6.3 환경 승격 이력 보존

CSAP D-13: 모든 변경(배포)의 이력이 1년 이상 보존되어야 합니다.

```yaml
# deploy.yml의 감사 로그 기록 부분
- name: Audit log
  run: |
    echo '{"timestamp":"...","action":"DEPLOY","actor":"...","ref":"...","sha":"...","status":"success"}' \
      >> deploy-audit.jsonl

- name: Upload audit log
  uses: actions/upload-artifact@v4
  with:
    name: deploy-audit
    path: deploy-audit.jsonl
    retention-days: 365  # CSAP D-06: 1년 보존
```

**감리 제출 자료 목록**:

| 자료 | 위치 | 보존 기간 |
|------|------|---------|
| 배포 이력 (deploy-audit.jsonl) | Gitea Actions 아티팩트 | 365일 |
| CI/CD 파이프라인 로그 | Gitea Actions Logs | 90일 |
| Q-Gate 결과 | PR 코멘트 + Actions 로그 | PR 이력 보존 |
| DORA 게이트 결과 | audit.jsonl | 365일 |
| 핫픽스 긴급 변경 기록 | audit.jsonl | 365일 |

---

## 7. 문제 상황별 대응

### 7.1 stg에서 통과했는데 prod에서 실패하는 경우

**원인**: 환경 설정 차이 (가장 흔한 원인)

```bash
# 진단: stg와 prod의 환경 변수 차이 확인
kubectl get configmap -n saas-platform saas-config -o yaml > prod-config.yaml
kubectl get configmap -n saas-stg saas-config -o yaml > stg-config.yaml
diff prod-config.yaml stg-config.yaml

# 진단: values 파일 차이 확인
diff helm/saas-platform/values-stg.yaml \
     helm/saas-platform/values-prod.yaml
```

**대응 절차**:
1. 즉시 Flagger 롤백 또는 `helm rollback` 실행
2. 설정 차이 원인 파악
3. stg 환경에서 prod 설정으로 재현 테스트
4. 수정 후 전체 승격 절차 재시작

### 7.2 승인자가 응답하지 않는 경우

**정상 경로 (권장)**:
- 팀 리드의 백업 승인자를 Gitea Protected Branch 설정에 추가
- Slack/Teams로 승인 요청 알림 발송

**긴급 대안**:
- 긴급성이 높은 경우(Critical 보안 취약점): 에스컬레이션 매트릭스 사용
  ```
  1차: 팀 리드 (30분 이내)
  2차: 개발 팀장 (30분 초과 시)
  3차: CTO / 보안 책임자 (2시간 초과 시)
  ```
- 모든 에스컬레이션 시도는 audit.jsonl에 기록

```bash
# 에스컬레이션 기록 예시
echo '{"timestamp":"...","action":"APPROVAL_ESCALATION","reason":"승인자 응답 없음 1시간 초과","escalated_to":"개발팀장","csap_ref":"D-13"}' \
  >> .claude/audit.jsonl
```

### 7.3 승격 중 긴급 인시던트 발생 시

```
배포 진행 중 별도 장애가 발생한 경우

1. 현재 배포 일시 중단
   - Flagger: kubectl annotate canary/서비스명 flagger.app/action=pause
   - 또는 Gitea Actions에서 워크플로우 Cancel

2. 인시던트 대응 우선
   - MTTR 최소화가 최우선

3. 배포 재개 여부 판단
   - 인시던트 해결 후 → 승격 절차 처음부터 재시작
   - 배포가 인시던트 원인인 경우 → 즉시 롤백

4. 감사 기록
   echo '{"action":"DEPLOY_PAUSED","reason":"인시던트 발생","incident_id":"INC-XXXX"}' >> audit.jsonl
```

---

## 8. 환경 승격 자동화 심화 — 실전 스크립트와 패턴

이 섹션에서는 환경 승격 과정에서 반복적으로 사용하는 스크립트와 자동화 패턴을 정리합니다.

### 8.1 승격 상태 대시보드 — 현재 각 환경 버전 확인

```bash
#!/bin/bash
# scripts/env-status.sh — 각 환경에 배포된 버전을 한 눈에 확인

echo "=== 환경별 배포 상태 ==="
echo ""

# Staging 환경
STG_VERSION=$(helm get values saas-stg -n saas-stg -o json 2>/dev/null | \
  jq -r '.global.imageTag // "알 수 없음"')
STG_STATUS=$(kubectl get pods -n saas-stg --field-selector=status.phase=Running \
  --no-headers 2>/dev/null | wc -l)
echo "스테이징 (saas-stg)"
echo "  버전  : ${STG_VERSION}"
echo "  상태  : Running Pod ${STG_STATUS}개"

# Production 환경
PROD_VERSION=$(helm get values saas-prod -n saas-platform -o json 2>/dev/null | \
  jq -r '.global.imageTag // "알 수 없음"')
PROD_STATUS=$(kubectl get pods -n saas-platform --field-selector=status.phase=Running \
  --no-headers 2>/dev/null | wc -l)
echo ""
echo "프로덕션 (saas-platform)"
echo "  버전  : ${PROD_VERSION}"
echo "  상태  : Running Pod ${PROD_STATUS}개"

# Helm 이력 (최근 3회)
echo ""
echo "=== 프로덕션 최근 배포 이력 ==="
helm history saas-prod -n saas-platform --max 3 2>/dev/null || echo "이력 없음"
```

### 8.2 승격 전 사전 점검 자동화 스크립트

```bash
#!/bin/bash
# scripts/pre-promotion-check.sh
# stg → prod 승격 전 자동 사전 점검

set -euo pipefail

NAMESPACE_STG="saas-stg"
PASS=true

echo "=== stg → prod 승격 전 사전 점검 ==="
echo ""

# 점검 1: stg의 모든 Pod가 Running 상태인지 확인
echo "[1/6] stg Pod 상태 확인..."
NOT_RUNNING=$(kubectl get pods -n "$NAMESPACE_STG" \
  --field-selector='status.phase!=Running' \
  --no-headers 2>/dev/null | grep -v "Completed" | wc -l)

if [ "$NOT_RUNNING" -gt 0 ]; then
  echo "  [FAIL] ${NOT_RUNNING}개 Pod가 Running 상태가 아님"
  kubectl get pods -n "$NAMESPACE_STG" \
    --field-selector='status.phase!=Running' | grep -v "Completed"
  PASS=false
else
  echo "  [OK] 모든 Pod Running 상태"
fi

# 점검 2: stg API 헬스체크
echo "[2/6] stg API 헬스체크..."
STG_API="https://stg-api.saas.internal"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  "${STG_API}/healthz" --max-time 10 || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
  echo "  [OK] API 헬스체크 통과 ($HTTP_CODE)"
else
  echo "  [FAIL] API 헬스체크 실패 ($HTTP_CODE)"
  PASS=false
fi

# 점검 3: 감사 로그 완비율 확인 (stg 메트릭에서)
echo "[3/6] stg 감사 로그 완비율 확인..."
AUDIT_RATE=$(curl -s \
  "http://prometheus.monitoring.svc:9090/api/v1/query?query=audit_log_completeness_rate_percent" | \
  jq -r '.data.result[0].value[1] // "0"' 2>/dev/null || echo "0")

if (( $(echo "$AUDIT_RATE >= 99" | bc -l 2>/dev/null || echo "0") )); then
  echo "  [OK] 감사 로그 완비율 ${AUDIT_RATE}%"
else
  echo "  [WARN] 감사 로그 완비율 ${AUDIT_RATE}% (권장: 99% 이상)"
fi

# 점검 4: DORA 변경 실패율 확인
echo "[4/6] DORA 변경 실패율 확인..."
CFR=$(curl -s \
  "http://prometheus.monitoring.svc:9090/api/v1/query?query=dora_change_failure_rate" | \
  jq -r '.data.result[0].value[1] // "0"' 2>/dev/null || echo "0")
CFR_PCT=$(echo "$CFR * 100" | bc -l 2>/dev/null | cut -d. -f1 || echo "0")

if [ "$CFR_PCT" -le 15 ]; then
  echo "  [OK] 변경 실패율 ${CFR_PCT}% (DORA High 이상)"
elif [ "$CFR_PCT" -le 30 ]; then
  echo "  [WARN] 변경 실패율 ${CFR_PCT}% (주의 — 30% 초과 시 차단)"
else
  echo "  [FAIL] 변경 실패율 ${CFR_PCT}% > 30% — DORA 게이트에서 차단 예정"
  PASS=false
fi

# 점검 5: 최근 stg Smoke Test 통과 여부
echo "[5/6] 최근 stg Smoke Test 결과 확인..."
LAST_SMOKE=$(grep '"action":"SMOKE_TEST_PASS","env":"staging"' .claude/audit.jsonl 2>/dev/null | \
  tail -1 | jq -r '.timestamp // ""')

if [ -n "$LAST_SMOKE" ]; then
  echo "  [OK] 마지막 Smoke Test 통과: $LAST_SMOKE"
else
  echo "  [WARN] stg Smoke Test 기록 없음 — 수동 확인 필요"
fi

# 점검 6: 체크리스트 파일 존재 여부 (선택적)
echo "[6/6] 프로덕션 준비 체크리스트..."
if [ -f "docs/pre-promotion-checklist-$(date +%Y-%m-%d).md" ]; then
  echo "  [OK] 오늘자 체크리스트 파일 존재"
else
  echo "  [INFO] 오늘자 체크리스트 파일 없음 (필요 시 생성)"
fi

# 최종 결과
echo ""
echo "=== 사전 점검 결과 ==="
if [ "$PASS" = "true" ]; then
  echo "  [PASS] 모든 필수 점검 통과 — 승격 요청 가능"
  echo ""
  # 감사 로그 기록
  echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","action":"PRE_PROMOTION_CHECK_PASS","csap_ref":"D-13"}' \
    >> .claude/audit.jsonl
  exit 0
else
  echo "  [FAIL] 일부 점검 실패 — 수정 후 재시도"
  echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","action":"PRE_PROMOTION_CHECK_FAIL","csap_ref":"D-13"}' \
    >> .claude/audit.jsonl
  exit 1
fi
```

### 8.3 배포 진행 상황 실시간 모니터링

```bash
#!/bin/bash
# scripts/watch-deployment.sh — 배포 진행 상황 실시간 확인

NAMESPACE="${1:-saas-platform}"
INTERVAL="${2:-10}"

echo "=== 배포 상태 실시간 모니터링 (${NAMESPACE}) ==="
echo "종료: Ctrl+C"
echo ""

while true; do
  clear
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') ==="
  echo ""

  # Pod 상태
  echo "--- Pod 상태 ---"
  kubectl get pods -n "$NAMESPACE" \
    --sort-by='.metadata.creationTimestamp' 2>/dev/null | tail -20

  # Canary 상태 (Flagger)
  echo ""
  echo "--- Canary 배포 상태 ---"
  kubectl get canary -n "$NAMESPACE" 2>/dev/null || echo "Canary 리소스 없음"

  # HelmRelease 상태 (Flux)
  echo ""
  echo "--- HelmRelease 상태 ---"
  kubectl get helmrelease -n "$NAMESPACE" 2>/dev/null || echo "HelmRelease 없음"

  sleep "$INTERVAL"
done
```

### 8.4 긴급 롤백 통합 스크립트

```bash
#!/bin/bash
# scripts/emergency-rollback.sh
# 긴급 상황 시 한 번에 롤백 실행
# CSAP D-13: 변경 이력 자동 기록

set -euo pipefail

NAMESPACE="${1:-saas-platform}"
RELEASE="${2:-saas-prod}"
REASON="${3:-긴급 롤백}"

echo "=== 긴급 롤백 실행 ==="
echo "  대상 네임스페이스: ${NAMESPACE}"
echo "  Helm 릴리즈: ${RELEASE}"
echo "  사유: ${REASON}"
echo ""

# 현재 상태 스냅샷
CURRENT_REVISION=$(helm history "$RELEASE" -n "$NAMESPACE" \
  --max 1 --output json | jq -r '.[0].revision')
echo "  현재 리비전: ${CURRENT_REVISION}"

# Flagger 카나리 중단 (진행 중인 경우)
kubectl get canary -n "$NAMESPACE" --no-headers 2>/dev/null | \
  awk '{print $1}' | while read -r canary; do
  kubectl -n "$NAMESPACE" annotate canary/"$canary" \
    flagger.app/action=rollback --overwrite 2>/dev/null || true
  echo "  Flagger 카나리 롤백: $canary"
done

# Helm 롤백
echo ""
echo "  Helm 롤백 실행 중..."
helm rollback "$RELEASE" -n "$NAMESPACE" --wait --timeout 5m

# 롤백 후 상태 확인
ROLLBACK_REVISION=$(helm history "$RELEASE" -n "$NAMESPACE" \
  --max 1 --output json | jq -r '.[0].revision')
echo "  롤백 완료 → 리비전: ${ROLLBACK_REVISION}"

# 감사 로그 기록 (CSAP D-06, D-13)
ACTOR="${GITHUB_ACTOR:-$(whoami)}"
echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","action":"EMERGENCY_ROLLBACK","actor":"'"$ACTOR"'","namespace":"'"$NAMESPACE"'","release":"'"$RELEASE"'","from_revision":'"$CURRENT_REVISION"',"to_revision":'"$ROLLBACK_REVISION"',"reason":"'"$REASON"'","csap_ref":"D-13"}' \
  >> .claude/audit.jsonl

echo ""
echo "=== 롤백 완료 ==="
echo "  감사 로그에 기록됨: .claude/audit.jsonl"
echo "  다음 조치: 원인 분석 후 팀 리드 보고"
```

### 8.5 환경 설정 차이 비교 도구

stg와 prod 환경 설정이 다를 때 발생하는 문제를 예방하기 위한 비교 스크립트입니다.

```bash
#!/bin/bash
# scripts/compare-env-configs.sh
# stg vs prod 환경 설정 차이 비교

echo "=== 환경 설정 차이 비교 (stg vs prod) ==="
echo ""

# Helm values 비교
echo "--- Helm Values 차이 ---"
helm get values saas-stg -n saas-stg -o yaml 2>/dev/null > /tmp/stg-values.yaml
helm get values saas-prod -n saas-platform -o yaml 2>/dev/null > /tmp/prod-values.yaml

diff /tmp/stg-values.yaml /tmp/prod-values.yaml | \
  grep -v "^---" | head -50 || echo "차이 없음"

# ConfigMap 비교 (민감 정보 제외)
echo ""
echo "--- ConfigMap 차이 (saas-config) ---"
kubectl get configmap saas-config -n saas-stg -o yaml 2>/dev/null | \
  grep -v "^  creationTimestamp\|^  resourceVersion\|^  uid\|^  annotations" \
  > /tmp/stg-configmap.yaml

kubectl get configmap saas-config -n saas-platform -o yaml 2>/dev/null | \
  grep -v "^  creationTimestamp\|^  resourceVersion\|^  uid\|^  annotations" \
  > /tmp/prod-configmap.yaml

diff /tmp/stg-configmap.yaml /tmp/prod-configmap.yaml | head -50 || echo "차이 없음"

# 중요 환경 변수 키 비교 (값은 마스킹)
echo ""
echo "--- Secret 키 목록 비교 (값 미노출) ---"
kubectl get secret saas-secrets -n saas-stg -o json 2>/dev/null | \
  jq -r '.data | keys[]' | sort > /tmp/stg-secrets-keys.txt

kubectl get secret saas-secrets -n saas-platform -o json 2>/dev/null | \
  jq -r '.data | keys[]' | sort > /tmp/prod-secrets-keys.txt

echo "stg에만 있는 키:"
comm -23 /tmp/stg-secrets-keys.txt /tmp/prod-secrets-keys.txt

echo "prod에만 있는 키:"
comm -13 /tmp/stg-secrets-keys.txt /tmp/prod-secrets-keys.txt

echo "공통 키:"
comm -12 /tmp/stg-secrets-keys.txt /tmp/prod-secrets-keys.txt
```

### 8.6 승격 후 SLO 모니터링 (골든 시그널 확인)

```bash
#!/bin/bash
# scripts/post-promotion-monitor.sh
# 승격 직후 15분간 핵심 지표 모니터링

PROMETHEUS="http://prometheus.monitoring.svc:9090"
DURATION=15  # 모니터링 시간 (분)
INTERVAL=60  # 확인 주기 (초)
END_TIME=$(($(date +%s) + DURATION * 60))

echo "=== 승격 후 SLO 모니터링 시작 ==="
echo "  모니터링 시간: ${DURATION}분"
echo "  시작: $(date)"
echo ""

ALERT_COUNT=0

while [ $(date +%s) -lt $END_TIME ]; do
  TIMESTAMP=$(date '+%H:%M:%S')

  # 에러율 (목표: 1% 미만)
  ERROR_RATE=$(curl -s "${PROMETHEUS}/api/v1/query?query=sum(rate(http_requests_total{status_code=~\"5..\"}[1m]))/sum(rate(http_requests_total[1m]))*100" | \
    jq -r '.data.result[0].value[1] // "0"' 2>/dev/null | awk '{printf "%.2f", $1}')

  # P99 응답시간 (목표: 500ms 미만)
  P99=$(curl -s "${PROMETHEUS}/api/v1/query?query=histogram_quantile(0.99,rate(http_request_duration_seconds_bucket[1m]))*1000" | \
    jq -r '.data.result[0].value[1] // "0"' 2>/dev/null | awk '{printf "%.0f", $1}')

  # 활성 Pod 수
  POD_COUNT=$(kubectl get pods -n saas-platform --field-selector=status.phase=Running \
    --no-headers 2>/dev/null | wc -l)

  # 임계값 확인
  ERROR_STATUS="OK"
  P99_STATUS="OK"
  if (( $(echo "$ERROR_RATE > 1" | bc -l 2>/dev/null || echo "0") )); then
    ERROR_STATUS="WARN"
    ALERT_COUNT=$((ALERT_COUNT + 1))
  fi
  if [ "$P99" -gt 500 ] 2>/dev/null; then
    P99_STATUS="WARN"
    ALERT_COUNT=$((ALERT_COUNT + 1))
  fi

  echo "[$TIMESTAMP] 에러율: ${ERROR_RATE}% [${ERROR_STATUS}] | P99: ${P99}ms [${P99_STATUS}] | Pod: ${POD_COUNT}개"

  # 알림 임계값 초과 시 경고
  if [ "$ALERT_COUNT" -ge 3 ]; then
    echo ""
    echo "[경고] 지표 이상 감지 3회 이상 — 롤백 고려"
    echo "  롤백 명령: helm rollback saas-prod -n saas-platform"
    ALERT_COUNT=0
  fi

  sleep "$INTERVAL"
done

echo ""
echo "=== 모니터링 완료: $(date) ==="
echo "  15분 정상 운영 확인"
echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","action":"POST_PROMOTION_MONITOR_COMPLETE","duration_minutes":'"$DURATION"',"csap_ref":"D-06"}' \
  >> .claude/audit.jsonl
```

---

## 9. 학습 체크리스트

- [ ] dev → stg → prod 각 환경의 목적을 동료에게 설명할 수 있다
- [ ] Q-Gate 7단계 중 필수 게이트(G3, G5)가 무엇인지 안다
- [ ] stg 환경에 테스트 목적으로 prod 실제 데이터를 복사하면 안 되는 이유를 안다
- [ ] `deploy.yml`에서 v태그와 stg 브랜치가 각각 어느 환경에 배포되는지 설명할 수 있다
- [ ] DORA 게이트에서 CFR 30% 초과 시 어떤 일이 발생하는지 안다
- [ ] 핫픽스와 일반 배포의 차이를 아티팩트 레이블(`HOTFIX_DEPLOY` vs `DEPLOY`)로 구분할 수 있다
- [ ] 프로덕션 배포 실패 시 즉시 실행할 롤백 명령어를 안다
- [ ] `pre-promotion-check.sh` 스크립트가 점검하는 6가지 항목을 설명할 수 있다
- [ ] stg와 prod의 환경 설정 차이를 비교하는 방법을 안다
- [ ] 승격 후 15분간 모니터링하는 이유를 SLO 에러 버짓 관점에서 설명할 수 있다

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|-------|
| 1.0.0 | 2026-04-12 | 최초 작성 — 환경 승격 전체 가이드 완성 (자동화 스크립트 포함) | 온보딩팀 |
