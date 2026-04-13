# 플랫폼 엔지니어링 FAQ — 골든 패스, 개발자 경험, 플랫폼 팀 운영 25가지

---

| 항목 | 내용 |
|------|------|
| 문서 ID | GUIDE-FAQ-11-11 |
| 버전 | 1.0.0 |
| 작성일 | 2026-04-13 |
| 목적 | 플랫폼 엔지니어링 관련 자주 묻는 질문 25가지 완전 해설 |
| 선행 학습 | 없음 (입문 문서) |
| CSAP 참조 | D-12 시스템 개발 보안 |

---

## 목차 — 25가지 질문

### 빠른 답변 TOP 5

| 순위 | 질문 | 바로가기 |
|------|------|---------|
| 1 | 신규 서비스 시작할 때 공통 패키지는 무엇을 써야 하나요? | [Q2](#q2-신규-서비스를-만들-때-반드시-써야-하는-공통-패키지는) |
| 2 | 로컬 환경 구성이 너무 복잡합니다. 간소화 방법이 있나요? | [Q9](#q9-로컬-환경-구성이-복잡합니다-간소화-방법이-있나요) |
| 3 | DORA 지표가 나쁘게 나왔습니다. 무엇을 해야 하나요? | [Q22](#q22-dora-지표가-나쁘게-나왔습니다-어떤-조치를-취해야-하나요) |
| 4 | Claude Code로 개발 시 N2SF 위반을 방지하는 방법은? | [Q15](#q15-claude-code로-개발-시-n2sf-규정-위반을-방지하는-방법은) |
| 5 | 플랫폼 장애 vs 서비스 장애 구분 방법은? | [Q23](#q23-플랫폼-장애-vs-서비스-장애-구분-방법은) |

### 골든 패스 FAQ (Q1~Q8)

- [Q1: 골든 패스란 무엇이고 왜 중요한가요?](#q1-골든-패스란-무엇이고-왜-중요한가요)
- [Q2: 신규 서비스를 만들 때 반드시 써야 하는 공통 패키지는?](#q2-신규-서비스를-만들-때-반드시-써야-하는-공통-패키지는)
- [Q3: 프론트엔드 + 백엔드 모두 개발할 때 빠른 시작법은?](#q3-프론트엔드--백엔드-모두-개발할-때-빠른-시작법은)
- [Q4: 팀이 골든 패스를 우회하고 싶다고 합니다. 어떻게 설득하나요?](#q4-팀이-골든-패스를-우회하고-싶다고-합니다-어떻게-설득하나요)
- [Q5: 공유 패키지에 버그가 있어서 모든 서비스가 영향받습니다. 어떻게 하나요?](#q5-공유-패키지에-버그가-있어서-모든-서비스가-영향받습니다-어떻게-하나요)
- [Q6: 내부 개발자 포털(IDP)이 있나요? 어떻게 사용하나요?](#q6-내부-개발자-포털idp이-있나요-어떻게-사용하나요)
- [Q7: Self-Service 기능으로 어디까지 가능한가요?](#q7-self-service-기능으로-어디까지-가능한가요)
- [Q8: 표준에서 벗어난 기술 스택을 도입하려면 어떤 절차가 필요한가요?](#q8-표준에서-벗어난-기술-스택을-도입하려면-어떤-절차가-필요한가요)

### 개발자 경험(DX) FAQ (Q9~Q17)

- [Q9: 로컬 환경 구성이 복잡합니다. 간소화 방법이 있나요?](#q9-로컬-환경-구성이-복잡합니다-간소화-방법이-있나요)
- [Q10: 테스트가 너무 느립니다. 병렬 실행 방법은?](#q10-테스트가-너무-느립니다-병렬-실행-방법은)
- [Q11: Turbo 빌드가 갑자기 캐시를 안 씁니다. 원인은?](#q11-turbo-빌드가-갑자기-캐시를-안-씁니다-원인은)
- [Q12: 타입 에러가 갑자기 수백 개 발생했습니다. 어떻게 추적하나요?](#q12-타입-에러가-갑자기-수백-개-발생했습니다-어떻게-추적하나요)
- [Q13: pnpm patch로 외부 패키지를 임시 수정하려면?](#q13-pnpm-patch로-외부-패키지를-임시-수정하려면)
- [Q14: 모노레포에서 특정 패키지만 빌드하는 방법은?](#q14-모노레포에서-특정-패키지만-빌드하는-방법은)
- [Q15: Claude Code로 개발 시 N2SF 규정 위반을 방지하는 방법은?](#q15-claude-code로-개발-시-n2sf-규정-위반을-방지하는-방법은)
- [Q16: 새 Prisma 마이그레이션을 스테이징에서 먼저 검증하는 방법은?](#q16-새-prisma-마이그레이션을-스테이징에서-먼저-검증하는-방법은)
- [Q17: 커밋 메시지를 잘못 작성했을 때 수정 방법은?](#q17-커밋-메시지를-잘못-작성했을-때-수정-방법은)

### 플랫폼 팀 운영 FAQ (Q18~Q25)

- [Q18: 플랫폼 팀과 개발팀의 경계는 어디인가요?](#q18-플랫폼-팀과-개발팀의-경계는-어디인가요)
- [Q19: 플랫폼 팀에 피처 요청하는 방법은?](#q19-플랫폼-팀에-피처-요청하는-방법은)
- [Q20: 인프라 비용이 급증했을 때 조사 방법은?](#q20-인프라-비용이-급증했을-때-조사-방법은)
- [Q21: 새로운 오픈소스 라이브러리 도입 검토 프로세스는?](#q21-새로운-오픈소스-라이브러리-도입-검토-프로세스는)
- [Q22: DORA 지표가 나쁘게 나왔습니다. 어떤 조치를 취해야 하나요?](#q22-dora-지표가-나쁘게-나왔습니다-어떤-조치를-취해야-하나요)
- [Q23: 플랫폼 장애 vs 서비스 장애 구분 방법은?](#q23-플랫폼-장애-vs-서비스-장애-구분-방법은)
- [Q24: 공공기관 환경 특성 때문에 어려운 부분은 무엇인가요?](#q24-공공기관-환경-특성-때문에-어려운-부분은-무엇인가요)
- [Q25: 프레임워크 버전 업그레이드는 어떻게 관리하나요?](#q25-프레임워크-버전-업그레이드는-어떻게-관리하나요)

---

## 골든 패스 FAQ (Q1~Q8)

### Q1: 골든 패스란 무엇이고 왜 중요한가요?

**골든 패스(Golden Path)**는 플랫폼 팀이 사전 검증하고 권장하는 개발 방법론, 도구, 패턴의 모음입니다. 개발자가 "어떻게 만들어야 하나"를 고민하지 않고 바로 "무엇을 만들어야 하나"에 집중할 수 있게 해줍니다.

이 프로젝트의 골든 패스:

- **언어**: TypeScript (백엔드, 프론트엔드 모두)
- **패키지 매니저**: pnpm 9.15.0
- **런타임**: Node.js 22
- **모노레포**: Turborepo + pnpm Workspaces
- **웹 프레임워크**: Fastify (백엔드), Next.js (프론트엔드)
- **인증**: `@public-saas/auth-sdk` (JWT RS256)
- **감사 로그**: `@public-saas/audit-sdk`
- **컨테이너**: Docker + k3s
- **패키징**: Helm + Flux GitOps
- **CI/CD**: Gitea Actions

**왜 중요한가**: 공공기관 환경에서는 CSAP 인증을 위해 모든 기술 선택에 보안 근거가 필요합니다. 골든 패스는 이미 CSAP/N2SF 검토가 완료된 경로입니다. 골든 패스를 따르면:

1. CSAP 심사 시 "왜 이 기술을 선택했나요?"에 표준 답변 가능
2. 플랫폼 팀의 지원을 받을 수 있음 (골든 패스 벗어나면 지원 제한)
3. 공통 패키지(`@public-saas/*`)의 보안 업데이트를 자동으로 적용받음

골든 패스 의사결정 흐름도는 아래 다이어그램을 참조하십시오.

---

### Q2: 신규 서비스를 만들 때 반드시 써야 하는 공통 패키지는?

다음 패키지는 CSAP D-06(감사 로그), D-08(접근 통제), D-09(암호화), D-12(개발 보안)를 충족하기 위해 **모든 서비스에 필수**입니다.

| 패키지 | 용도 | CSAP 요건 |
|-------|------|---------|
| `@public-saas/auth-sdk` | JWT 검증, RBAC 권한 검사 | D-08 |
| `@public-saas/audit-sdk` | 감사 로그 기록 | D-06 |
| `@public-saas/types` | 공통 타입 정의 (TokenPayload 등) | D-12 |
| `zod` | 입력 검증 스키마 | D-12 |

**auth-service의 실제 사용 예**:

```typescript
// platform/services/auth-service/src/middleware/rbac.middleware.ts
import { hasPermission, requirePermissions } from '@public-saas/auth-sdk';

export function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      await reply.status(401).send({
        success: false,
        error: { code: 'AUTH_REQUIRED', message: '인증이 필요합니다' },
      });
      return;
    }
    if (!hasPermission(request.user, permission)) {
      await reply.status(403).send({
        success: false,
        error: { code: 'AUTH_FORBIDDEN', message: `권한이 부족합니다: ${permission}` },
      });
      return;
    }
  };
}
```

**보안 서비스의 감사 로그 사용 예**:

```typescript
// platform/services/security-service/src/lib/audit.ts
import { createAuditLogger, createStandardTransport } from '@public-saas/audit-sdk';

const auditLogger = createAuditLogger({
  serviceName: 'security-service',
  transport: createStandardTransport('security-service'),
});

export async function logSecurityEvent(
  action: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await auditLogger.log({
    actor: 'system:security-service',
    action,
    target: 'security',
    tenantId: 'system',
    ip: process.env.SERVICE_IP || '127.0.0.1',
    metadata,
  });
}
```

신규 서비스 생성 체크리스트:

```bash
# 1. 패키지 의존성 추가
pnpm add @public-saas/auth-sdk @public-saas/audit-sdk @public-saas/types zod

# 2. 모든 API 엔드포인트에 인증 미들웨어 적용 확인
# 3. 민감 작업마다 auditLog() 호출 확인
# 4. 모든 입력에 Zod 스키마 검증 확인
# 5. 환경 변수에 시크릿 하드코딩 없음 확인
```

---

### Q3: 프론트엔드 + 백엔드 모두 개발할 때 빠른 시작법은?

이 프로젝트는 pnpm Workspaces 모노레포입니다. 전체를 한 번에 시작하는 방법:

```bash
# 전체 의존성 설치
pnpm install

# 개발 서버 전체 시작 (Turborepo 병렬 실행)
pnpm dev

# 특정 서비스만 시작
pnpm --filter @public-saas/portal dev          # 프론트엔드 포털
pnpm --filter auth-service dev                 # auth-service만
pnpm --filter security-service dev            # security-service만

# 여러 서비스 동시 시작
pnpm --filter "auth-service" --filter "api-gateway" dev
```

프론트엔드(Portal)와 백엔드(API Gateway)를 함께 개발할 때 권장 설정:

```bash
# 터미널 1: 백엔드 서비스 (Docker Compose 사용)
docker compose -f docker-compose.dev.yml up postgres redis

# 터미널 2: API Gateway + auth-service
pnpm --filter "api-gateway" --filter "auth-service" dev

# 터미널 3: 프론트엔드 포털
pnpm --filter "@public-saas/portal" dev
# → http://localhost:3000 에서 접근
```

---

### Q4: 팀이 골든 패스를 우회하고 싶다고 합니다. 어떻게 설득하나요?

우회 요청의 대표 유형과 설득 논리:

**"우리는 Python이 더 익숙합니다"**
- CSAP 심사 시 TypeScript/Node.js 기반은 이미 보안 검토 완료. Python 추가 시 별도 CSAP 항목 검토 필요.
- 공통 패키지(`@public-saas/auth-sdk`, `@public-saas/audit-sdk`)를 Python에서 사용 불가. 동일 기능을 직접 구현해야 하므로 보안 결함 가능성 증가.
- 결론: AI/ML 파이프라인처럼 Python이 필수인 영역은 예외 허용. 단, AI Gateway를 반드시 경유해야 함.

**"우리 서비스는 특수해서 Helm을 쓰면 안 됩니다"**
- Helm 없이 Raw YAML로 배포하면 환경별 설정 관리가 수동. CSAP 심사 시 배포 프로세스 일관성 입증 어려움.
- Q-Gate CI/CD에서 `helm lint` 검사가 있어 Helm 없는 서비스는 파이프라인 통과 어려움.
- 결론: Helm의 어떤 부분이 불편한지 플랫폼 팀에 구체적으로 피드백. 공통 base-chart 개선으로 해결 가능한 경우가 많음.

**"오픈소스 인증 라이브러리 XXX가 더 기능이 많습니다"**
- 외부 인증 라이브러리는 N2SF 보안 검토 통과 전까지 사용 불가.
- `@public-saas/auth-sdk`는 CSAP D-08(접근 통제) 79개 항목 기준으로 설계됨.
- 결론: 필요한 기능이 있으면 플랫폼 팀에 요청. SDK에 추가 가능한 기능이면 모든 팀이 혜택받음.

---

### Q5: 공유 패키지에 버그가 있어서 모든 서비스가 영향받습니다. 어떻게 하나요?

```bash
# 1. 영향 범위 파악 — 어떤 서비스가 해당 패키지를 사용하는가
pnpm why @public-saas/auth-sdk --recursive
# 출력: auth-service, api-gateway, user-service, ...

# 2. 임시 해결 (pnpm patch): 버그 있는 패키지 로컬 수정
pnpm patch @public-saas/auth-sdk
# 에디터에서 수정 후
pnpm patch-commit /tmp/pnpm-patch/...

# 3. 정식 수정 — 공유 패키지 PR 제출
cd packages/auth-sdk
# 버그 수정 후
pnpm test
git checkout -b fix/auth-sdk-token-validation-bug
git commit -m "fix(auth-sdk): FR-AUTH.5 토큰 검증 로직 오류 수정"

# 4. 긴급 배포 — 핫픽스 파이프라인 실행
# .gitea/workflows/hotfix-pipeline.yaml 활용
git tag auth-sdk-hotfix-v1.0.1
git push origin auth-sdk-hotfix-v1.0.1
```

플랫폼 팀 에스컬레이션 기준: 버그로 인해 CSAP 보안 요건(D-08, D-09)이 위반되는 경우 즉시 플랫폼 팀 리드에게 보고합니다.

---

### Q6: 내부 개발자 포털(IDP)이 있나요? 어떻게 사용하나요?

이 프로젝트의 IDP는 `platform/apps/portal/`에 구현된 Next.js 포털입니다. 현재 제공 기능:

- **테넌트 관리**: 신규 테넌트 생성, 사용자 초대, 권한 설정
- **서비스 카탈로그**: 사용 가능한 서비스 목록 및 구독 현황
- **관리자 대시보드**: 시스템 상태, 감사 로그 조회
- **DORA 지표 대시보드**: 팀별 배포 빈도, 리드타임, 복구 시간

접근 방법:

```bash
# 포털 로컬 실행
pnpm --filter "@public-saas/portal" dev
# http://localhost:3000 접근

# 스테이징 포털
https://portal.stg.example.go.kr

# 운영 포털 (접근 제한 — 관리자만)
https://portal.example.go.kr
```

---

### Q7: Self-Service 기능으로 어디까지 가능한가요?

현재 Self-Service 가능 범위:

| 기능 | 권한 | 방법 |
|------|------|------|
| 신규 테넌트 생성 | admin | 포털 UI |
| 서비스 구독/해지 | admin, manager | 포털 UI |
| 사용자 초대 | admin | 포털 UI |
| DORA 지표 조회 | 모든 인증 사용자 | 포털 대시보드 |
| 감사 로그 조회 | auditor | 포털 UI |
| 신규 네임스페이스 생성 | platform-admin | Gitea PR |
| 새 마이크로서비스 추가 | developer | Gitea PR + 플랫폼 팀 승인 |

개발자가 직접 할 수 없는 영역 (플랫폼 팀 승인 필요):
- Helm 차트 구조 변경
- RBAC 역할 추가/변경
- 네트워크 정책 변경
- 외부 도구 추가

---

### Q8: 표준에서 벗어난 기술 스택을 도입하려면 어떤 절차가 필요한가요?

비표준 기술 도입 절차 (RFC 프로세스):

```
1. RFC 문서 작성 (docs/01-plan/rfcs/RFC-NNNN-기술명.md)
   - 도입 이유 (왜 표준 기술로는 불가능한가)
   - 보안 위험 분석 (OWASP, CSAP 관련)
   - 대안 비교 (최소 2개)
   - 마이그레이션 계획

2. 플랫폼 팀 검토 (5 영업일)

3. 보안팀 CSAP/N2SF 검토 (10 영업일)

4. 승인 시: Gitea PR + 가이드 문서 작성 의무

5. 거부 시: 이유 문서화 후 표준 기술로 대체
```

실제 예시: `packages/ml-pipeline/src/model-ci.ts`의 Python 모델 CI는 AI/ML 특수성을 인정받아 예외 승인된 사례입니다.

---

## 개발자 경험(DX) FAQ (Q9~Q17)

### Q9: 로컬 환경 구성이 복잡합니다. 간소화 방법이 있나요?

**가장 빠른 시작 (5분)**:

```bash
# 1. 저장소 클론
git clone https://gitea.local/public-saas/ai-saas.git
cd ai-saas

# 2. Node.js 22 + pnpm 9.15.0 설치 확인
node --version   # v22.x.x
pnpm --version   # 9.15.0

# 3. 의존성 설치
pnpm install

# 4. 환경 변수 복사
cp .env.example .env.local

# 5. 개발용 JWT 키 생성 (스크립트 제공)
./scripts/init-dev-keys.sh

# 6. 인프라 서비스 시작 (PostgreSQL, Redis)
docker compose -f docker-compose.dev.yml up -d

# 7. DB 마이그레이션
pnpm --filter "auth-service" db:migrate

# 8. 개발 서버 시작
pnpm dev
```

**WSL2 환경 (이 프로젝트 운영 환경)**:

이 프로젝트는 `Linux 6.6.87.2-microsoft-standard-WSL2` 환경에서 개발됩니다. Docker Desktop 대신 WSL2 native Docker를 사용하면 파일 I/O 성능이 크게 향상됩니다.

```bash
# WSL2에서 Docker 직접 설치 (Docker Desktop 불필요)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# k3s 설치 (로컬 쿠버네티스)
curl -sfL https://get.k3s.io | sh -
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
```

---

### Q10: 테스트가 너무 느립니다. 병렬 실행 방법은?

```bash
# 전체 테스트 병렬 실행 (Turborepo 활용)
pnpm test

# CI에서 사용하는 방식과 동일 (ci-cd-pipeline.yml 발췌)
pnpm run test -- --coverage

# 특정 패키지만 테스트
pnpm --filter "auth-service" test

# watch 모드로 변경된 파일만 실행
pnpm --filter "auth-service" test -- --watch

# 단일 테스트 파일 실행
pnpm --filter "auth-service" test -- \
  --testPathPattern="login.handler"

# 병렬 실행 수 조정 (CPU 코어 수 기준)
pnpm test -- --maxWorkers=4
```

**테스트 속도 개선 팁**:

1. **모킹 철저**: 외부 서비스(PostgreSQL, Redis) 호출은 mock으로 대체
2. **테스트 격리**: 각 테스트가 독립적으로 실행되도록 `beforeEach`에서 상태 초기화
3. **Turbo 캐시**: `.turbo/` 디렉토리가 있으면 이전 결과 재사용. `pnpm test --force`로 강제 실행

---

### Q11: Turbo 빌드가 갑자기 캐시를 안 씁니다. 원인은?

Turbo는 입력 파일의 해시값을 기반으로 캐시를 사용합니다. 다음 경우에 캐시가 무효화됩니다:

**원인 1: turbo.json inputs 외 파일 변경**
```json
// turbo.json
{
  "pipeline": {
    "build": {
      "inputs": ["src/**/*.ts", "package.json", "tsconfig.json"]
      // inputs에 없는 파일 변경은 캐시에 영향 없음
      // 단, inputs 미지정 시 모든 파일 변경이 캐시 무효화
    }
  }
}
```

**원인 2: 환경 변수 변경**
```json
// turbo.json에 env 명시 필요
{
  "pipeline": {
    "build": {
      "env": ["NODE_ENV", "API_URL"]
      // 이 환경 변수가 변경되면 캐시 무효화
    }
  }
}
```

**디버그 방법**:
```bash
# 캐시 히트/미스 상세 로그
pnpm build --verbosity=2

# 캐시 완전 삭제 후 재실행
pnpm turbo build --force

# Turbo 캐시 상태 확인
cat .turbo/config.json
```

---

### Q12: 타입 에러가 갑자기 수백 개 발생했습니다. 어떻게 추적하나요?

```bash
# 1. 타입 체크 오류 전체 목록 (파일별)
pnpm typecheck 2>&1 | grep "error TS"

# 2. 특정 패키지 타입 체크
pnpm --filter "@public-saas/auth-sdk" typecheck

# 3. 의존성 변경이 원인인지 확인
git log --oneline pnpm-lock.yaml | head -5
git diff HEAD~1 pnpm-lock.yaml | grep "^[+-]" | grep -v "^---\|^+++"

# 4. 타입 버전 충돌 확인
pnpm why @types/node
# 여러 버전이 있으면 pnpm-lock.yaml에서 resolutions로 고정

# 5. 공유 패키지 타입 변경 확인
git log --oneline packages/types/src/index.ts | head -5
```

**대부분의 원인**: `@public-saas/types` 패키지의 `TokenPayload` 등 공유 타입이 변경된 경우입니다. 변경된 타입을 사용하는 모든 서비스를 업데이트해야 합니다.

---

### Q13: pnpm patch로 외부 패키지를 임시 수정하려면?

```bash
# 1. 패치 시작 (임시 폴더 생성)
pnpm patch zod@3.22.4
# 출력: 임시 폴더 경로 /tmp/pnpm-patch-zod-xxxxx

# 2. 임시 폴더에서 파일 수정
nano /tmp/pnpm-patch-zod-xxxxx/src/types.ts

# 3. 패치 커밋 (patches/ 디렉토리에 .patch 파일 생성)
pnpm patch-commit /tmp/pnpm-patch-zod-xxxxx
# 결과: patches/zod@3.22.4.patch 파일 생성
# package.json의 pnpm.patchedDependencies에 자동 추가

# 4. 확인
cat patches/zod@3.22.4.patch

# 5. Git에 커밋 (patches/ 디렉토리는 커밋 대상)
git add patches/ package.json pnpm-lock.yaml
git commit -m "fix(deps): zod 타입 추론 임시 패치 (upstream PR #NNNN 반영 전)"
```

**주의**: 패치는 임시방편입니다. 반드시 upstream에 PR을 제출하고, 공식 수정 버전 출시 후 패치를 제거하십시오. `// NOTE: 임시 패치. upstream PR #NNNN 반영 후 제거 예정. 2026-06-01 재검토` 주석을 패치 파일 상단에 추가하십시오.

---

### Q14: 모노레포에서 특정 패키지만 빌드하는 방법은?

```bash
# 특정 패키지만 빌드
pnpm --filter "auth-service" build

# 특정 패키지와 그 의존성까지 빌드
pnpm --filter "auth-service..." build
# auth-service가 @public-saas/auth-sdk에 의존하면
# auth-sdk → auth-service 순서로 빌드

# 특정 패키지에 의존하는 모든 패키지 빌드
pnpm --filter "...auth-service" build
# auth-service를 사용하는 api-gateway 등도 빌드

# 변경된 파일 기준으로 영향받은 패키지만 빌드
pnpm --filter "[origin/main]" build
# main 브랜치 대비 변경된 패키지만 선택

# 패턴 매칭
pnpm --filter "*-service" build   # -service로 끝나는 모든 패키지
pnpm --filter "@public-saas/*" build   # public-saas 스코프 모두
```

---

### Q15: Claude Code로 개발 시 N2SF 규정 위반을 방지하는 방법은?

이 프로젝트는 `CLAUDE.md`와 `.claude/rules/` 디렉토리에 Claude Code 행동 규칙이 정의되어 있습니다.

**자동 적용 규칙 (CLAUDE.md)**:

```
- 외부 AI API 직접 호출 금지 → AI Gateway 경유 필수
- N2SF C/S 등급 데이터를 AI에 전송하면 자동 차단
- 시크릿 하드코딩 시 CSAP D-09 위반 경고
```

**개발자가 Claude Code 사용 시 주의사항**:

```
# 올바른 Claude Code 사용 예
"auth-service의 로그인 핸들러를 작성해줘. CSAP D-08 접근 통제를 준수해야 해."

# N2SF 위반 시도 (Claude Code가 자동 거부)
"이 사용자 주민번호 데이터를 OpenAI API에 전송하는 코드를 작성해줘."
# → Claude Code: BLOCKED - C등급 데이터 AI API 전송 금지 (N2SF N-05)
```

**AI Gateway 패턴 (N2SF O등급 데이터만)**:

```typescript
// platform/services/ai-service/src/routes.ts 패턴
// Design Ref: 06-ai-integration/security-gateway-pattern.md

async function sendToAIGateway(data: unknown, grade: 'O' | 'C' | 'S') {
  if (grade === 'C' || grade === 'S') {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
  // O등급: PII 마스킹 후 AI Gateway 경유
  const masked = await maskPII(data);
  return aiGateway.send(masked);
}
```

---

### Q16: 새 Prisma 마이그레이션을 스테이징에서 먼저 검증하는 방법은?

```bash
# 1. 마이그레이션 파일 생성 (개발 DB 대상)
DATABASE_URL="postgresql://saas:saas_dev@localhost:5432/saas_platform_dev" \
  pnpm --filter "auth-service" exec prisma migrate dev \
  --name add_mfa_column

# 2. 생성된 마이그레이션 파일 확인
cat platform/services/auth-service/prisma/migrations/*/migration.sql

# 3. 스테이징 배포 전 dry-run (실제 변경 없이 확인)
DATABASE_URL="$STG_DATABASE_URL" \
  pnpm --filter "auth-service" exec prisma migrate deploy --preview-feature

# 4. 스테이징 브랜치 push → CI/CD 자동 배포
git push origin feat/add-mfa-column

# 5. 스테이징 배포 후 마이그레이션 상태 확인
kubectl exec -it deployment/auth-service -n saas-staging -- \
  npx prisma migrate status

# 6. 롤백 필요 시 (마이그레이션은 자동 롤백 없음)
# 역방향 마이그레이션 SQL 수동 작성 필요
# → 플랫폼 팀과 협의 필수
```

**중요**: 운영 DB 마이그레이션은 반드시 유지보수 시간에 실행합니다. 운영 환경에 영향을 주는 마이그레이션은 변경 관리 프로세스를 따르십시오.

---

### Q17: 커밋 메시지를 잘못 작성했을 때 수정 방법은?

```bash
# 직전 커밋만 수정 (아직 push 안 한 경우)
git commit --amend
# 에디터에서 메시지 수정 후 저장

# 주의: --no-verify 사용 금지 (CLAUDE.md 절대 제약)
# git commit --amend --no-verify  <- 이것은 금지됨

# 여러 커밋 메시지 수정 (아직 push 안 한 경우)
# 최근 3개 커밋 수정
git rebase -i HEAD~3
# 수정할 커밋 앞의 pick을 reword로 변경
# reword abc1234 fix: typo  <- 이걸 선택하면 에디터에서 메시지 수정 가능

# 이미 push한 경우 (stg 브랜치)
# force push는 금지. 대신 새 커밋으로 수정 사항 기록:
git commit -m "docs: 이전 커밋 메시지 오류 정정 (feat → fix)"
```

**올바른 커밋 메시지 형식** (`harness-constraints.md` 기준):

```
feat(csap): FR-2.1 표준등급 79항목 체크리스트 추가
fix(n2sf): N-03 격리 영역 C등급 요건 오류 수정
docs(audit): T01 사업계획서 템플릿 감리기준 조항 추가
refactor(infra): k3s 레시피 중복 명령 제거
test(auth): FR-AUTH.5 JWT 키 회전 테스트 추가
```

---

## 플랫폼 팀 운영 FAQ (Q18~Q25)

### Q18: 플랫폼 팀과 개발팀의 경계는 어디인가요?

아래 다이어그램이 책임 경계를 명확히 보여줍니다.

```mermaid
graph LR
    subgraph "플랫폼 팀 책임 영역 (You Build It, You Run It)"
        P1[k3s 클러스터 운영]
        P2[Helm 차트 기반 관리]
        P3[Flux GitOps 파이프라인]
        P4[공통 패키지 @public-saas/*]
        P5[CI/CD 워크플로우\nci-cd-pipeline.yml\nquality-gate.yml]
        P6[Vault + ESO 시크릿 관리]
        P7[Prometheus + Grafana 모니터링]
        P8[DORA 지표 수집\ndora-exporter]
        P9[CSAP/N2SF 컴플라이언스 도구]
        P10[Harbor 이미지 레지스트리]
    end

    subgraph "개발팀 책임 영역 (You Build It, You Own It)"
        D1[서비스 비즈니스 로직]
        D2[API 설계 및 구현]
        D3[서비스별 테스트]
        D4[서비스별 Helm values 설정]
        D5[데이터베이스 스키마/마이그레이션]
        D6[서비스별 감사 로그 호출]
        D7[FR/NFR 요구사항 충족]
    end

    subgraph "공동 책임"
        C1[보안 취약점 대응]
        C2[CSAP 심사 대비 문서]
        C3[신규 서비스 아키텍처 검토]
    end

    P4 -->|사용| D1
    P5 -->|자동 검증| D3
    D4 -->|반영| P2
    C1 --- P1
    C1 --- D1
```

**핵심 원칙**: "You Build It, You Own It" — 개발팀은 자신이 만든 서비스의 운영 책임을 집니다. 플랫폼 팀은 개발팀이 안정적으로 운영할 수 있는 도구와 환경을 제공합니다.

---

### Q19: 플랫폼 팀에 피처 요청하는 방법은?

Gitea 이슈 트래커를 사용합니다:

```markdown
# 이슈 제목 형식: [Platform Request] 요청 내용 요약

## 요청 내용
공통 패키지에 rate limiting 미들웨어 추가 요청

## 사용 사례
auth-service와 api-gateway 모두 rate limiting이 필요하나
각자 구현 시 일관성 없음

## 현재 상황
각 서비스에서 express-rate-limit을 직접 사용 중

## 기대 효과
- 코드 중복 제거
- CSAP D-08 Rate limiting 요건 표준화
- 설정 일관성

## 관련 FR
FR-SEC.3 (API Rate Limiting)
```

우선순위 기준:
- **즉시 처리**: CSAP 위반 또는 보안 취약점
- **이번 스프린트**: 2개 이상 팀이 요청, 골든 패스 일관성 강화
- **백로그**: 편의 기능, 단일 팀 요청

---

### Q20: 인프라 비용이 급증했을 때 조사 방법은?

```bash
# 1. 리소스 사용량 상위 Pod 확인
kubectl top pods -n saas-production --sort-by=memory | head -10
kubectl top pods -n saas-production --sort-by=cpu | head -10

# 2. 비정상적으로 증가한 Pod 리소스 확인
kubectl describe pod <pod-name> -n saas-production | grep -A 5 "Limits\|Requests"

# 3. HPA (Horizontal Pod Autoscaler) 상태 확인
kubectl get hpa -n saas-production

# 4. 이미지 크기 확인 (Harbor UI 또는)
docker images --format "{{.Repository}}:{{.Tag}}\t{{.Size}}" | sort -k2 -h

# 5. 불필요한 리소스 정리
# 완료된 Job 정리
kubectl delete jobs --field-selector=status.conditions[0].type=Complete -n saas-production

# 오래된 ReplicaSet 정리
kubectl get replicaset -n saas-production | awk '$2==0 && $3==0 {print $1}' | xargs kubectl delete replicaset -n saas-production

# 6. values.yaml 리소스 설정 점검
# values-prod.yaml의 limits/requests 값이 실제 사용량과 괴리 없는지 확인
```

---

### Q21: 새로운 오픈소스 라이브러리 도입 검토 프로세스는?

```bash
# 1. 라이센스 확인 (GPL 계열은 공공기관 납품 불가)
npx license-checker --onlyAllow "MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC"

# 2. 취약점 확인
pnpm audit --audit-level=moderate

# 3. 의존성 크기 확인
npx bundlephobia <package-name>

# 4. 마지막 업데이트 시기 확인 (1년 이상 미업데이트 = 주의)
npm view <package-name> time.modified

# 5. SBOM에 포함되어 Grype 스캔 통과 확인
# (ci-cd-pipeline.yml Stage 4b: sbom-scan)
```

라이브러리 도입 금지 기준:
- GPL/AGPL 라이센스 (공공기관 소스 공개 의무)
- CVSS 7.0 이상 알려진 취약점 미패치 상태
- 메인테이너가 없거나 1년 이상 미업데이트
- N2SF 보안 검토 미통과

---

### Q22: DORA 지표가 나쁘게 나왔습니다. 어떤 조치를 취해야 하나요?

이 프로젝트는 `packages/dora-exporter/src/index.ts`로 4대 DORA 지표를 자동 수집합니다.

```typescript
// dora-exporter에서 수집하는 지표
// FR-DORA.1: 배포 빈도 (dora_deployment_total)
// FR-DORA.2: 변경 리드타임 (dora_lead_time_seconds)
// FR-DORA.3: 변경 실패율 (dora_change_failure_rate)
// FR-DORA.4: 서비스 복구 시간 (dora_mttr_seconds)
```

**지표별 개선 방향**:

| 지표 | 나쁜 상태 | 개선 방향 |
|------|---------|---------|
| 배포 빈도 낮음 | 월 1회 미만 | 기능 단위 분리, 피처 플래그 도입 |
| 리드타임 길음 | 1개월 초과 | PR 크기 축소, 리뷰 프로세스 개선 |
| 변경 실패율 높음 | 45% 초과 | 테스트 커버리지 향상, 스테이징 검증 강화 |
| MTTR 길음 | 1주일 초과 | 알림 설정 개선, 롤백 자동화 강화 |

```bash
# DORA 현황 확인
curl http://dora-exporter:9170/metrics | grep "dora_"

# 주간 보고서 생성
curl "http://dora-exporter:9170/report/weekly?format=json"

# 팀별 DORA 등급 확인
curl -X POST http://dora-exporter:9170/classify
# {"results": {"platform-team": 2, "dev-team-a": 1}}
# 0=Low, 1=Medium, 2=High, 3=Elite
```

---

### Q23: 플랫폼 장애 vs 서비스 장애 구분 방법은?

```
장애 발생 시 첫 번째 질문: "다른 서비스도 동시에 영향받나요?"

YES → 플랫폼 장애 가능성
  - k3s 노드 이상
  - Harbor 레지스트리 접근 불가
  - PostgreSQL 클러스터 이상
  - Vault 접근 불가 (모든 서비스 시크릿 조회 실패)

NO → 서비스 장애
  - 해당 서비스 코드 버그
  - 해당 서비스 설정 오류
  - 해당 서비스 DB 마이그레이션 오류
```

진단 명령:

```bash
# 1. 클러스터 전체 상태
kubectl get nodes
kubectl get pods -A | grep -v Running | grep -v Completed

# 2. 플랫폼 서비스 상태
kubectl get pods -n vault-system
kubectl get pods -n flux-system
kubectl get pods -n monitoring

# 3. 특정 서비스 로그
kubectl logs deployment/auth-service -n saas-production --tail=50

# 4. 최근 배포 이벤트 확인
kubectl get events -n saas-production --sort-by='.lastTimestamp' | tail -20

# 5. Helm 릴리스 상태
helm list -n saas-production
```

---

### Q24: 공공기관 환경 특성 때문에 어려운 부분은 무엇인가요?

공공기관 SaaS 개발 시 일반 SaaS와 다른 제약:

**1. 외부 클라우드 서비스 사용 금지**
AWS, GCP, Azure 대신 on-premise k3s + Harbor + MinIO를 사용합니다. DevOps 편의 도구(GitHub Actions, npm 공개 레지스트리)를 직접 사용할 수 없어 자체 구축이 필요합니다.

**2. N2SF 데이터 등급 제한**
AI API를 사용하려면 데이터가 O등급이어야 하고 PII 마스킹이 필수입니다. 개발 중 실수로 C/S등급 데이터가 포함될 수 있어 주의가 필요합니다. `CLAUDE.md`의 AI API 호출 규칙을 항상 확인하십시오.

**3. CSAP 감사 준비**
모든 코드 변경이 `docs/` 문서와 1:1 추적이 되어야 합니다. 구현 전에 Plan + Design 문서가 반드시 있어야 합니다. 감리 결함으로 지적될 수 있습니다.

**4. 이중 승인 프로세스**
보안 관련 변경사항은 플랫폼 팀 + 보안팀 이중 승인이 필요합니다. 긴급 배포도 변경 관리 프로세스를 따라야 합니다.

**5. 감사 로그 완전성**
모든 민감 작업에 감사 로그가 있어야 합니다. Q-Gate G7에서 `audit.jsonl` 누락 시 배포가 차단됩니다.

---

### Q25: 프레임워크 버전 업그레이드는 어떻게 관리하나요?

```bash
# 1. 현재 버전 확인
cat package.json | grep '"node"'
pnpm --version

# 2. 업그레이드 계획 수립 (분기별)
# 영향도 분석: 주요 의존성 변경사항 확인
pnpm outdated

# 3. 단계적 업그레이드
# MINOR 버전: 일반 PR + Q-Gate 통과 → 자동 배포
# MAJOR 버전: RFC 문서 작성 → 플랫폼 팀 승인 → 스테이징 검증 → 운영 배포

# 4. Node.js 버전 업그레이드 예시
# .node-version 파일과 package.json engines 필드 동시 변경
echo "22" > .node-version
# package.json: "engines": {"node": ">=22"}
# 모든 Dockerfile의 FROM node:XX 버전도 동시 변경

# 5. pnpm 버전 관리
# CLAUDE.md 기준: pnpm 9.15.0 고정
# 변경 시 ci-cd-pipeline.yml의 PNPM_VERSION도 동시 변경 필수
```

**자동 업데이트 정책**: Renovate Bot이 패치 버전(x.y.Z)은 자동 PR을 생성합니다. 마이너(x.Y.0)와 메이저(X.0.0) 버전은 수동 검토가 필요합니다.

---

## Mermaid 다이어그램

### 골든 패스 의사결정 흐름도

```mermaid
flowchart TD
    START([새 기능/서비스 개발 시작]) --> Q_GOLDEN{골든 패스 기술로\n구현 가능한가?}

    Q_GOLDEN -->|YES| USE_GOLDEN[골든 패스 사용\nTypeScript + Fastify\n@public-saas/* 패키지]
    Q_GOLDEN -->|NO| CHECK_REASON{예외가 필요한\n이유는?}

    CHECK_REASON -->|AI/ML 특수 요구| RFC_AIML[RFC 문서 작성\n+ N2SF 검토 필수]
    CHECK_REASON -->|성능 요구사항| RFC_PERF[벤치마크 증거 첨부\nRFC 문서 작성]
    CHECK_REASON -->|레거시 시스템 연동| RFC_LEGACY[연동 인터페이스만\n예외 허용 검토]
    CHECK_REASON -->|단순 선호도| REJECT[거부\n표준 기술 사용 필수]

    RFC_AIML --> REVIEW{플랫폼팀 + 보안팀\n검토}
    RFC_PERF --> REVIEW
    RFC_LEGACY --> REVIEW

    REVIEW -->|승인| DOCUMENT[가이드 문서 작성\n의무]
    REVIEW -->|거부| REJECT

    USE_GOLDEN --> PLAN[Plan 문서 작성\nFR ID 할당]
    DOCUMENT --> PLAN

    PLAN --> DESIGN[Design 문서 작성\n섹션 완비]
    DESIGN --> IMPL[구현\nCSAP D-12 준수]
    IMPL --> QGATE{Q-Gate 7단계\n통과?}

    QGATE -->|통과| DEPLOY[배포\n감사 로그 기록]
    QGATE -->|실패| FIX[수정 후\n재검토]
    FIX --> QGATE

    REJECT --> ALT[표준 기술로\n대안 방법 모색]
    ALT --> Q_GOLDEN
```

### 플랫폼 팀 vs 개발팀 책임 경계 다이어그램

```mermaid
graph TB
    subgraph "인프라 레이어 — 플랫폼 팀 전담"
        K3S[k3s 노드 관리\n업그레이드, 장애 대응]
        NETWORK[네트워크 정책\nCalico + NetworkPolicy]
        STORAGE[스토리지\nPV, StorageClass]
        VAULT_OPS[Vault 운영\n키 관리, 정책 설정]
    end

    subgraph "플랫폼 서비스 레이어 — 플랫폼 팀 전담"
        HARBOR[Harbor\n이미지 레지스트리]
        FLUX[Flux GitOps\nHelmRelease 관리]
        PROM[Prometheus + Grafana\n모니터링 플랫폼]
        DORA_EXP[DORA Exporter\n지표 수집]
        AUDIT_SVC[Audit Service\n감사 로그 저장]
    end

    subgraph "공통 패키지 — 플랫폼 팀 개발 + 전체 사용"
        AUTH_SDK[@public-saas/auth-sdk\nJWT + RBAC]
        AUDIT_SDK[@public-saas/audit-sdk\n감사 로그 SDK]
        TYPES[@public-saas/types\n공통 타입]
    end

    subgraph "비즈니스 서비스 레이어 — 개발팀 전담"
        AUTH_SVC[auth-service\n로그인, 세션 관리]
        USER_SVC[user-service\n사용자 관리]
        SEC_SVC[security-service\n보안 이벤트 모니터링]
        AI_SVC[ai-service\nRAG + AI Agent]
    end

    subgraph "공동 책임 영역"
        CSAP_DOC[CSAP 감사 문서]
        INCIDENT[보안 침해 대응]
        ARCH_REVIEW[아키텍처 검토]
    end

    K3S --> FLUX
    VAULT_OPS --> AUTH_SDK
    HARBOR --> FLUX
    AUTH_SDK --> AUTH_SVC
    AUDIT_SDK --> AUTH_SVC
    AUDIT_SDK --> SEC_SVC
    TYPES --> AUTH_SVC
    TYPES --> USER_SVC
    AUTH_SVC --> AUDIT_SVC
    SEC_SVC --> AUDIT_SVC
    DORA_EXP --> PROM
    CSAP_DOC --- AUDIT_SVC
    INCIDENT --- K3S
    INCIDENT --- AUTH_SVC
```

---

## 부록: 자주 사용하는 명령어 치트시트

### 개발 일상 명령어

```bash
# 전체 빌드
pnpm build

# 전체 테스트
pnpm test

# 린트
pnpm lint

# 타입 체크
pnpm typecheck

# 특정 서비스 개발 서버
pnpm --filter "auth-service" dev

# 특정 서비스 테스트 (watch 모드)
pnpm --filter "auth-service" test -- --watch

# 변경된 패키지만 빌드 (Turborepo 캐시 활용)
pnpm build --filter "[origin/main]"

# 새 패키지 추가
pnpm --filter "auth-service" add zod

# 개발 의존성 추가
pnpm --filter "auth-service" add -D vitest @types/node
```

### k3s / kubectl 운영 명령어

```bash
# Pod 전체 상태
kubectl get pods -A

# 특정 네임스페이스 Pod
kubectl get pods -n saas-staging

# Pod 로그 실시간 조회
kubectl logs -f deployment/auth-service -n saas-staging

# Pod 재시작
kubectl rollout restart deployment/auth-service -n saas-staging

# 재시작 상태 모니터링
kubectl rollout status deployment/auth-service -n saas-staging

# 서비스 목록
kubectl get svc -n saas-staging

# Helm 릴리스 목록
helm list -n saas-staging

# Helm 배포 상태
helm status saas-stg -n saas-staging

# Helm 롤백 (이전 버전으로)
helm rollback saas-stg 1 -n saas-staging

# ConfigMap 조회
kubectl get configmap -n saas-staging
kubectl describe configmap saas-platform-config -n saas-staging
```

### DORA 지표 조회 명령어

```bash
# DORA 현재 메트릭 (Prometheus 형식)
curl http://dora-exporter:9170/metrics | grep "^dora_"

# 배포 빈도 확인
curl http://dora-exporter:9170/metrics | grep "dora_deployment_total"

# 팀 등급 확인
curl -X POST http://dora-exporter:9170/classify | jq .

# 주간 보고서 (JSON)
curl "http://dora-exporter:9170/report/weekly?format=json" | jq .

# 주간 보고서 (Markdown)
curl "http://dora-exporter:9170/report/weekly" > weekly-report.md

# CSAP 증거용 보고서
curl "http://dora-exporter:9170/report/weekly?format=evidence" | jq .

# 추세 데이터 (최근 30일)
curl "http://dora-exporter:9170/api/trends?period=weekly&count=30" | jq .

# 이벤트 큐 상태
curl http://dora-exporter:9170/api/queue/stats | jq .
```

### Flux GitOps 명령어

```bash
# Flux 전체 상태
flux get all -n flux-system

# HelmRelease 목록
flux get helmreleases -n flux-system

# HelmRelease 수동 동기화 강제 실행
flux reconcile helmrelease auth-service -n flux-system --with-source

# GitRepository 동기화
flux reconcile source git saas-gitops -n flux-system

# Flux 이벤트 로그
flux events -n flux-system

# HelmRelease 상세 상태
kubectl get helmrelease auth-service -n flux-system -o yaml | \
  grep -A 30 "conditions:"
```

### 감사 로그 조회 명령어

```bash
# 오늘의 감사 로그
TODAY=$(date +%Y-%m-%d)
grep "$TODAY" .claude/audit.jsonl | jq .

# 특정 액션 필터
grep "USER_DELETE\|USER_CREATE" .claude/audit.jsonl | jq .

# 특정 배우(actor) 기준 조회
grep '"actor":"admin@example.go.kr"' .claude/audit.jsonl | jq .

# 마지막 100개 엔트리
tail -100 .claude/audit.jsonl | jq .

# 감사 로그 통계 (액션별 건수)
jq -r '.action' .claude/audit.jsonl | sort | uniq -c | sort -rn

# CSAP 증거 수집 (특정 기간)
jq -c 'select(.timestamp >= "2026-04-01" and .timestamp <= "2026-04-30")' \
  .claude/audit.jsonl > csap-april-evidence.jsonl
```

### Q-Gate 품질 검사 로컬 실행

```bash
# G1: FR ID 전수 검사
grep -roh 'FR-[A-Z0-9]*\.[0-9]*' docs/01-plan/mtus/*.plan.md | sort -u | wc -l

# G3: 코드 품질
pnpm typecheck && pnpm lint

# G4: 테스트 커버리지
pnpm test -- --coverage
cat coverage/coverage-summary.json | jq '.total.lines.pct'

# G5: OWASP — 하드코딩 시크릿 탐지
grep -rn --include="*.ts" --include="*.js" \
  -E "sk-[a-zA-Z0-9]{20,}|PRIVATE.KEY" \
  platform/ 2>/dev/null | grep -v "node_modules" | grep -v ".test."

# G5: SQL 직접 결합 탐지
grep -rn --include="*.ts" --include="*.js" \
  -E "SELECT.*FROM.*\\\$\{|INSERT.*INTO.*\\\$\{" \
  platform/services/ 2>/dev/null

# G7: 감사 로그 확인
wc -l .claude/audit.jsonl
tail -5 .claude/audit.jsonl | jq .

# 전체 Q-Gate 결과 요약
echo "=== Q-Gate 로컬 검사 ==="
echo "G1 FR ID 수: $(grep -roh 'FR-[A-Z0-9]*\.[0-9]*' docs/01-plan/mtus/*.plan.md 2>/dev/null | sort -u | wc -l)"
echo "G3 타입 체크: $(pnpm typecheck > /dev/null 2>&1 && echo PASS || echo FAIL)"
echo "G3 린트: $(pnpm lint > /dev/null 2>&1 && echo PASS || echo WARN)"
echo "G7 감사 로그 엔트리: $(wc -l < .claude/audit.jsonl 2>/dev/null || echo 0)"
```

---

## 부록: 공통 패턴 레퍼런스

### 표준 Fastify 서비스 구조

신규 마이크로서비스를 만들 때 따라야 하는 표준 파일 구조입니다. `auth-service`를 참고 모델로 합니다.

```
platform/services/my-new-service/
├── src/
│   ├── index.ts               # 진입점: Fastify 앱 생성, 플러그인 등록
│   ├── routes.ts              # 라우트 정의 (인증 미들웨어 적용)
│   ├── handlers/              # 요청 핸들러 (비즈니스 로직)
│   │   └── my-feature.handler.ts
│   ├── lib/                   # 유틸리티, 외부 연동
│   │   ├── audit.ts           # 감사 로그 (CSAP D-06 필수)
│   │   └── prisma.ts          # DB 클라이언트
│   ├── middleware/            # Fastify 미들웨어
│   │   └── auth.middleware.ts # JWT 검증
│   └── schemas/               # Zod 입력 검증 스키마 (CSAP D-12)
│       └── my-feature.schema.ts
├── prisma/
│   └── schema.prisma          # DB 스키마
├── Dockerfile                 # 컨테이너 빌드
├── package.json
└── tsconfig.json
```

모든 API 엔드포인트는 아래 패턴을 따릅니다:

```typescript
// routes.ts 표준 패턴
import { requirePermission } from '../middleware/auth.middleware';
import { logSecurityEvent } from '../lib/audit';
import { myFeatureSchema } from '../schemas/my-feature.schema';

export async function registerRoutes(app: FastifyInstance) {
  // CSAP D-08: 인증 미들웨어 반드시 적용
  app.post('/api/my-feature', {
    preHandler: requirePermission('my-feature:create'),
  }, async (request, reply) => {
    // CSAP D-12: 입력 검증 (Zod)
    const body = myFeatureSchema.parse(request.body);

    // 비즈니스 로직
    const result = await doSomething(body);

    // CSAP D-06: 민감 작업 감사 로그
    await logSecurityEvent('MY_FEATURE_CREATED', {
      targetId: result.id,
      actorId: request.user.sub,
    });

    return reply.status(201).send({ success: true, data: result });
  });
}
```

### CSAP 준수 코드 패턴 요약

자주 참조하는 CSAP 준수 코드 패턴을 항목별로 정리합니다.

```typescript
// D-08: 접근 통제 — 권한 없으면 403 반환
if (!hasPermission(request.user, 'resource:write')) {
  return reply.status(403).send({
    error: { code: 'AUTH_FORBIDDEN', message: '권한이 부족합니다' },
  });
}

// D-09: 암호화 — 환경 변수에서 키 로드, 절대 하드코딩 금지
const encryptionKey = process.env.ENCRYPTION_KEY;
if (!encryptionKey) throw new Error('ENCRYPTION_KEY 환경 변수 누락');

// D-06: 감사 로그 — 민감 작업 전수 기록
await auditLogger.log({
  actor: request.user.sub,
  action: 'SENSITIVE_ACTION',
  target: targetId,
  targetType: 'resource',
  tenantId: request.user.tenantId,
  ip: request.ip,
  userAgent: request.headers['user-agent'],
});

// D-12: 입력 검증 — 매개변수화 쿼리 필수
const user = await prisma.user.findUnique({
  where: { email: validatedEmail },  // ✅ Prisma ORM이 자동으로 매개변수화
});
// 절대 금지: await db.execute(`SELECT * FROM users WHERE email = '${email}'`)

// D-12: 에러 응답에 민감 정보 노출 금지
catch (error) {
  logger.error('처리 중 오류', { errorId: uuid() });  // 서버 로그에만 상세 기록
  return reply.status(500).send({
    error: { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' },
    // ❌ 절대 포함 금지: error.message, error.stack, DB 정보
  });
}
```

---

## 부록: 트러블슈팅 빠른 참조

### 증상별 진단 트리

```
서비스가 응답하지 않는다
├── kubectl get pods -n saas-staging
│   ├── CrashLoopBackOff → kubectl logs deployment/xxx --previous
│   ├── Pending → kubectl describe pod xxx (이벤트 확인)
│   │   ├── Insufficient memory → values.yaml 리소스 증가
│   │   └── ImagePullBackOff → Harbor 자격증명 확인
│   └── Running인데 응답 없음 → kubectl exec -it pod -- curl localhost:PORT/healthz

JWT 토큰 인증이 계속 실패한다
├── 토큰 만료 확인 (15분 이내인가?)
├── kubectl exec auth-service -- env | grep JWT_KEY_ID
│   JWT_KEY_ID 값이 발급 시와 다르면 → 키 로테이션 중 발생
│   해결: 토큰 재발급 (로그아웃 후 재로그인)
└── Vault에서 JWT 키 버전 확인
    vault kv get saas/secrets/auth-service | grep JWT_KEY_ID

pnpm install이 실패한다
├── pnpm 버전 확인: pnpm --version (9.15.0이어야 함)
├── Node.js 버전 확인: node --version (22.x.x이어야 함)
├── lockfile 충돌: git checkout pnpm-lock.yaml && pnpm install
└── 사설 레지스트리: .npmrc에 Harbor npm registry 설정 확인

Flux HelmRelease가 적용 안 된다
├── flux get helmreleases -n flux-system (상태 확인)
├── 의존성 확인: dependsOn 서비스가 Ready인가?
├── 강제 동기화: flux reconcile helmrelease xxx -n flux-system --with-source
└── 이벤트 확인: kubectl get events -n flux-system --sort-by='.lastTimestamp'
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|-------|
| 1.0.0 | 2026-04-13 | 최초 작성 — 플랫폼 엔지니어링 FAQ 25가지 (온보딩 Iteration 21-B) | Implementer Agent |
