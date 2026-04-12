# 개발자 FAQ

> **문서 ID**: ONBOARD-11-DEV
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **작성자**: Implementer (Sonnet)
> **대상**: 백엔드·풀스택 개발자
> **질문 수**: 25개

---

## 패키지 관리

---

**Q1. pnpm과 npm 차이가 뭐예요?**

A: pnpm은 npm, yarn과 동일한 패키지 매니저이지만 두 가지가 다릅니다.

첫째, **속도**: pnpm은 패키지를 전역 저장소에 한 번만 저장하고 심볼릭 링크로 참조합니다. 두 번째 설치부터 매우 빠릅니다.

둘째, **monorepo 지원**: `pnpm workspace`는 여러 패키지를 한 저장소에서 관리할 때 최적화되어 있습니다. 이 프로젝트처럼 20개 이상의 서비스가 있는 monorepo에서 npm을 쓰면 의존성 관리가 복잡해집니다.

이 프로젝트에서는 반드시 pnpm을 사용해야 합니다.

```bash
# 올바른 설치
pnpm install

# 특정 패키지 설치
pnpm add zod --filter auth-service

# 잘못된 예 (사용 금지)
npm install   # package-lock.json 충돌 발생
yarn install  # yarn.lock 충돌 발생
```

---

**Q2. 왜 monorepo를 사용해요?**

A: 이 프로젝트는 17개 이상의 마이크로서비스와 여러 공유 패키지(`@public-saas/*`)로 구성됩니다. monorepo를 사용하면 다음이 가능합니다.

1. **공유 코드 재사용**: `@public-saas/auth-sdk`, `@public-saas/health` 등 공통 라이브러리를 모든 서비스가 공유합니다.
2. **단일 CI 파이프라인**: 변경된 서비스만 빌드·테스트합니다 (Turbo 의존 그래프).
3. **일관된 버전 관리**: 모든 서비스가 같은 TypeScript, Fastify 버전을 사용합니다.
4. **원자적 커밋**: 여러 서비스에 걸친 변경을 하나의 커밋으로 관리합니다.

```bash
# 전체 빌드 (변경된 서비스만 재빌드)
pnpm run build

# 특정 서비스만 빌드
pnpm run build --filter auth-service

# 특정 서비스와 의존 패키지 모두 빌드
pnpm run build --filter auth-service...
```

---

**Q3. Turbo가 뭐예요?**

A: Turborepo는 monorepo에서 빌드·테스트·린트를 **병렬**로 실행하고 **캐시**하는 도구입니다.

예를 들어 `pnpm run build`를 실행하면 Turbo가 다음을 합니다.
1. 각 패키지의 의존 관계를 파악합니다.
2. 의존 관계가 없는 패키지는 병렬로 빌드합니다.
3. 소스 코드가 변경되지 않은 패키지는 캐시에서 결과를 가져옵니다.

```bash
# turbo.json에서 작업 설정 확인
cat turbo.json

# 캐시 초기화 (빌드 문제 발생 시)
pnpm run build --force

# 어떤 패키지가 캐시에서 복원되었는지 확인
pnpm run build --verbosity=2
```

---

## 프레임워크 선택

---

**Q4. Fastify를 왜 Express 대신 써요?**

A: 세 가지 이유입니다.

1. **성능**: 벤치마크에서 Fastify는 Express보다 최대 3배 빠릅니다. 공공기관 서비스에서는 응답 시간이 중요합니다.
2. **JSON Schema 검증**: Fastify는 JSON Schema를 기반으로 요청/응답을 자동 검증합니다. Express는 별도 미들웨어가 필요합니다.
3. **OpenAPI 자동 생성**: `@fastify/swagger`로 API 문서를 자동 생성할 수 있어 CSAP D-12 문서화 요건 충족이 쉽습니다.

Fastify 라우트 기본 패턴:

```typescript
app.get('/example', {
  schema: {
    description: '예제 엔드포인트',
    response: {
      200: {
        type: 'object' as const,
        properties: { result: { type: 'string' as const } },
      },
    },
  },
}, async (request, reply) => {
  return reply.send({ result: 'ok' });
});
```

---

**Q5. Prisma ORM을 왜 써요?**

A: Prisma는 TypeScript에 최적화된 ORM으로 다음 장점이 있습니다.

1. **타입 안전성**: 스키마에서 자동 생성된 타입이 쿼리 결과에 적용됩니다.
2. **마이그레이션 관리**: `prisma migrate` 명령으로 DB 스키마 변경을 버전으로 관리합니다.
3. **SQL 인젝션 방지**: Prisma는 내부적으로 매개변수화 쿼리를 사용합니다 (CSAP D-12 준수).

```typescript
// Prisma 사용 예 — SQL 인젝션 위험 없음
const user = await prisma.user.findUnique({
  where: { email: userInput },  // 자동으로 매개변수화
  select: { id: true, email: true, name: true },
});
```

---

## 테스트

---

**Q6. 테스트는 어떻게 실행해요?**

A: 이 프로젝트는 Vitest를 사용합니다.

```bash
# 특정 서비스 테스트
cd platform/services/auth-service
pnpm test

# 감시 모드 (파일 변경 시 자동 재실행)
pnpm test --watch

# 커버리지 리포트 생성
pnpm test --coverage

# 특정 파일만 테스트
pnpm test src/handlers/__tests__/login.handler.test.ts

# 전체 monorepo 테스트
cd /data/ai-saas
pnpm run test
```

Q-Gate G4 기준: 테스트 커버리지 80% 이상이어야 PR이 통과됩니다.

---

**Q7. 테스트 파일은 어디에 두어야 해요?**

A: 두 가지 위치가 있습니다.

```
src/
├── handlers/
│   ├── login.handler.ts
│   └── __tests__/
│       └── login.handler.test.ts  ← 단위 테스트 (핸들러 옆)
└── lib/
    ├── jwt.ts
    └── __tests__/
        └── jwt.test.ts

tests/
└── e2e/
    └── auth-flow.test.ts           ← E2E 테스트 (별도 디렉터리)
```

파일명 규칙: `{대상파일}.test.ts` 또는 `{대상파일}.spec.ts`.

---

**Q8. 타입스크립트 컴파일 에러가 나는데요?**

A: 자주 발생하는 TypeScript 오류와 해결 방법입니다.

```bash
# 타입 오류 목록 확인
pnpm run typecheck

# 또는
npx tsc --noEmit
```

**자주 나는 오류 1**: `.js` 확장자 누락

```typescript
// 오류
import { loginHandler } from './handlers/login.handler';

// 수정
import { loginHandler } from './handlers/login.handler.js';
```

**자주 나는 오류 2**: Fastify schema에 `as const` 누락

```typescript
// 오류
type: 'object'

// 수정
type: 'object' as const
```

**자주 나는 오류 3**: 환경 변수 타입 오류

```typescript
// 오류 — string | undefined
const port = process.env['PORT'];
const portNum = parseInt(port);  // 타입 오류

// 수정
const port = process.env['PORT'] ?? '3001';
const portNum = parseInt(port, 10);
```

---

## 환경 변수

---

**Q9. 환경변수는 어떻게 추가해요?**

A: 환경 변수를 추가하는 절차입니다.

1. **로컬 개발용**: `.env.local`에 추가 (`.gitignore`에 포함, 커밋 금지)

```bash
# .env.local 예시
MY_NEW_SERVICE_URL=http://localhost:9000
MY_NEW_API_KEY=dev-key-only-for-local
```

2. **Vault에 등록**: 운영 환경용 값을 Vault에 등록합니다. Vault 접근 권한이 없으면 팀 리드에게 요청하십시오.

3. **k8s Secret 또는 Vault Agent로 주입**: Helm 차트의 `values.yaml`에 환경 변수 참조를 추가합니다.

4. **코드에서 읽기**:

```typescript
// 올바른 방법
const myServiceUrl = process.env['MY_NEW_SERVICE_URL'];
if (!myServiceUrl) {
  throw new Error('MY_NEW_SERVICE_URL 환경 변수가 필요합니다');
}

// 절대 금지 — 코드에 값 직접 입력
const myServiceUrl = 'http://localhost:9000';  // CSAP D-09 위반
```

---

**Q10. .env 파일과 .env.local 차이가 뭐예요?**

A:

| 파일 | 용도 | git 커밋 |
|------|------|---------|
| `.env.example` | 필요한 변수 목록 (값 없음) | 가능 (커밋해야 함) |
| `.env.local` | 로컬 개발용 실제 값 | 금지 (gitignore) |
| `.env.test` | 테스트용 값 | 민감 정보 없으면 가능 |

`.env.example`에는 변수 이름만 있고 실제 값은 없습니다.

```bash
# .env.example (커밋 가능)
DATABASE_URL=
JWT_SECRET=
REDIS_URL=

# .env.local (커밋 금지 — 실제 값 포함)
DATABASE_URL=postgresql://user:password@localhost:5432/db
JWT_SECRET=local-dev-jwt-secret-change-in-prod
REDIS_URL=redis://localhost:6379
```

---

## 서비스 및 DB 추가

---

**Q11. 새로운 서비스는 어떻게 만들어요?**

A: 새 마이크로서비스를 추가하는 절차입니다.

1. **Plan 문서 작성** (필수): `docs/01-plan/mtus/{서비스이름}.plan.md`
2. **Design 문서 작성** (필수): Plan 문서 내 Design 절

3. **디렉터리 생성**:

```bash
mkdir -p platform/services/{새서비스명}/src/{handlers,lib,middleware,schemas}
touch platform/services/{새서비스명}/src/index.ts
touch platform/services/{새서비스명}/src/routes.ts
touch platform/services/{새서비스명}/package.json
touch platform/services/{새서비스명}/tsconfig.json
```

4. **package.json 설정**:

```json
{
  "name": "@public-saas/{새서비스명}",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "fastify": "^4.x.x",
    "@public-saas/health": "workspace:*",
    "@public-saas/observability": "workspace:*"
  }
}
```

5. **Helm 차트 추가**: `platform/k8s/`에 Helm 차트 추가
6. **CI/CD 파이프라인에 서비스 추가**

---

**Q12. 기존 서비스에 DB 테이블을 어떻게 추가해요?**

A: Prisma 마이그레이션을 사용합니다.

```bash
# 1. schema.prisma에 새 모델 추가
vi platform/services/{서비스명}/prisma/schema.prisma

# 예: 새 모델 추가
# model OrderItem {
#   id        String   @id @default(uuid())
#   orderId   String
#   productId String
#   quantity  Int
#   createdAt DateTime @default(now())
# }

# 2. 마이그레이션 파일 생성
cd platform/services/{서비스명}
pnpm prisma migrate dev --name add-order-item-table

# 3. Prisma 클라이언트 재생성
pnpm prisma generate

# 4. 변경사항 확인
pnpm prisma studio
```

**주의**: `migrate dev`는 로컬 개발용입니다. 스테이징/프로덕션에는 `migrate deploy`를 사용합니다.

---

**Q13. Prisma 스키마 변경 후 빌드 오류가 나요.**

A: Prisma 클라이언트를 재생성해야 합니다.

```bash
cd platform/services/{서비스명}
pnpm prisma generate

# 그래도 안 되면
pnpm install
pnpm prisma generate
pnpm run build
```

---

## 코드 품질

---

**Q14. 린트 오류가 너무 많아요. 한 번에 고치는 방법이 있나요?**

A: ESLint auto-fix를 사용합니다.

```bash
# 자동 수정 가능한 린트 오류 수정
pnpm run lint --fix

# 특정 파일만
npx eslint src/handlers/login.handler.ts --fix

# 수정 불가능한 오류 목록 확인
pnpm run lint
```

자동으로 수정할 수 없는 오류는 직접 수정해야 합니다. Claude Code에게 오류 메시지를 붙여넣으면 수정 방법을 안내해 줍니다.

---

**Q15. Dead code란 무엇이고 왜 제거해야 해요?**

A: Dead code는 사용되지 않는 함수, 변수, import 등을 의미합니다.

이 프로젝트에서 Dead code가 중요한 이유:
- 코드 가독성 저하
- 유지보수 비용 증가
- Q-Gate G3 (코드 품질) 불통과 원인

```bash
# 미사용 export 탐지
npx ts-prune

# 미사용 npm 패키지 탐지
npx depcheck
```

예외: 공개 API에 `@deprecated` 태그, 미래 Phase 예정 코드에 `// NOTE: 미사용, Phase 2 FR-2.3 구현 시 사용 예정` 주석.

---

## Claude Code

---

**Q16. Claude Code를 처음 실행했는데 어떻게 써야 해요?**

A: 기본 사용법입니다.

```bash
# 프로젝트 루트에서 실행
cd /data/ai-saas
claude

# 대화창이 열리면 자연어로 요청
"auth-service의 routes.ts 파일 구조를 설명해 줘"
"login.handler.ts에서 보안 취약점이 있는지 확인해 줘"
"사용자 프로필 조회 API를 위한 핸들러 코드 작성해 줘"
```

**효과적인 프롬프트 패턴**:

```
# 파일 지정 + 구체적 요청
"platform/services/auth-service/src/handlers/login.handler.ts 파일을
CSAP D-08 기준으로 코드 리뷰해 줘"

# 컨텍스트 포함
"user-service에 GET /users/me 엔드포인트를 추가해야 해.
Design 문서는 docs/01-plan/mtus/EX02-user-profile.plan.md를 참고해 줘"
```

---

**Q17. Claude Code가 코드를 수정했는데 의도와 다르게 됐어요.**

A: Claude Code는 제안할 뿐이고 최종 판단은 개발자가 합니다.

```bash
# 변경사항 확인
git diff

# 원하지 않는 변경 취소
git checkout -- {파일경로}

# 또는 Claude Code에게 롤백 요청
"방금 변경한 내용을 원래대로 되돌려 줘"
```

Claude Code를 사용할 때 권장 순서:
1. 요청 전에 `git status`로 현재 상태 확인
2. 변경 후 `git diff`로 변경 내용 검토
3. 의도와 다르면 즉시 취소 또는 재요청

---

## PR 및 CI/CD

---

**Q18. PR 올렸는데 Q-Gate가 실패했어요. 어떻게 해요?**

A: 각 게이트별 실패 원인과 해결 방법입니다.

| 게이트 | 실패 원인 | 해결 방법 |
|--------|---------|---------|
| G1: FR ID 전수 | Plan 문서 없거나 FR ID 누락 | Plan 문서에 FR ID 추가 |
| G2: 설계 완전성 | Design 절 없음 | API 명세 추가 |
| G3: 코드 품질 | 린트 오류, Dead code | `pnpm run lint --fix` |
| G4: 테스트 커버리지 | 80% 미만 | 테스트 추가 |
| G5: OWASP Top10 | Semgrep 보안 오류 | 보안 패턴 수정 |
| G6: CSAP | CSAP 항목 미준수 | 7장 체크리스트 확인 |
| G7: 감사 추적 | auditLog() 누락 | 민감 작업에 auditLog 추가 |

```bash
# Gitea Actions 로그 확인
# Gitea Web UI → PR → Checks 탭에서 실패한 게이트 클릭
```

---

**Q19. 브랜치명은 어떻게 정해요?**

A: Conventional Branch 형식을 따릅니다.

```
feat/MTU-N261-새기능명
fix/auth-login-timeout
docs/onboarding-update
refactor/auth-service-cleanup
hotfix/security-sql-injection
```

**규칙**:
- `feat/`: 새 기능
- `fix/`: 버그 수정
- `docs/`: 문서만 변경
- `refactor/`: 기능 변경 없는 코드 개선
- `hotfix/`: 긴급 수정 (stg → main 바로 배포)

---

**Q20. 커밋 메시지 형식이 뭐예요?**

A: Conventional Commits 형식입니다.

```
{유형}({범위}): {제목}

{본문 (선택)}

{푸터 (선택)}
```

```bash
# 예시
git commit -m "feat(auth-service): /health/ping 엔드포인트 추가"
git commit -m "fix(user-service): 프로필 조회 시 비밀번호 해시 노출 수정"
git commit -m "docs(onboarding): 7장 CSAP 섹션 내용 보강"
git commit -m "refactor(auth-service): loginHandler 80줄 이하로 분리"
```

**유형 목록**:
- `feat`: 새 기능
- `fix`: 버그 수정
- `docs`: 문서 변경
- `refactor`: 리팩토링
- `test`: 테스트 추가/수정
- `chore`: 빌드, 의존성, 설정 변경

---

**Q21. git commit --no-verify를 쓰면 안 된다고 들었는데, 훅이 실패했어요. 어떻게 해요?**

A: `--no-verify`는 절대 사용하지 마십시오. 훅이 실패하면 그 이유를 해결해야 합니다.

```bash
# 훅 실패 원인 확인
git commit -m "..."
# 오류 메시지를 읽으면 원인을 알 수 있음

# 일반적인 원인
# 1. 린트 오류 → pnpm run lint --fix
# 2. 타입 오류 → pnpm run typecheck
# 3. 테스트 실패 → pnpm test
# 4. 시크릿 탐지 → 하드코딩된 시크릿 제거 후 환경 변수로 교체
```

---

## 개발 환경

---

**Q22. pnpm install이 너무 느려요. 빠르게 하는 방법이 있나요?**

A:

```bash
# frozen-lockfile 사용 (lockfile 변경 없이 설치)
pnpm install --frozen-lockfile

# 캐시 확인
pnpm store path
ls $(pnpm store path)

# 캐시가 비어 있으면 첫 설치는 느릴 수 있음
# 이후 설치는 캐시 덕분에 빠름
```

---

**Q23. 로컬에서 auth-service를 실행했는데 DB 연결 오류가 나요.**

A:

```bash
# PostgreSQL 로컬 실행 여부 확인
docker ps | grep postgres

# 없으면 docker compose로 실행
cd /data/ai-saas
docker compose up -d postgres redis

# .env.local의 DATABASE_URL 확인
cat .env.local | grep DATABASE_URL

# Prisma 연결 테스트
cd platform/services/auth-service
pnpm prisma db push   # 스키마 동기화
pnpm prisma studio    # GUI로 DB 확인
```

---

**Q24. 빌드는 성공했는데 서비스가 시작 안 돼요.**

A: 환경 변수 누락이 가장 흔한 원인입니다.

```bash
# 서비스 로그 확인
pnpm run dev 2>&1 | head -50

# 환경 변수 누락 오류 예시
# Error: JWT_SECRET 환경 변수가 필요합니다

# .env.local에 필요한 변수 추가
echo "JWT_SECRET=local-dev-secret" >> .env.local
```

---

**Q25. 다른 서비스에서 내가 만든 패키지를 import하고 싶어요.**

A: `@public-saas/` 패키지를 만들어 공유합니다.

```bash
# packages/ 디렉터리에 새 공유 패키지 생성
mkdir -p packages/my-new-package/src
cat > packages/my-new-package/package.json << 'EOF'
{
  "name": "@public-saas/my-new-package",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  }
}
EOF
```

다른 서비스에서 사용:

```bash
# pnpm add로 workspace 패키지 참조
pnpm add @public-saas/my-new-package --filter auth-service --workspace
```

```typescript
// auth-service에서 import
import { myFunction } from '@public-saas/my-new-package';
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 초안 작성 (25개 질문) | Implementer (Sonnet) |
