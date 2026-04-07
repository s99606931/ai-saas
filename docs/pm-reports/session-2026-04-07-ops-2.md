# PM 세션 보고서 -- 2026-04-07 (8차 세션: 운영 완성 2)

## 세션 개요

| 항목 | 내용 |
|------|------|
| 세션 ID | session-2026-04-07-ops-2 |
| 모드 | 완전 자율 + 운영 완성 |
| 대상 | 미탐색 6개 영역 분석 및 보강 |
| 테스트 결과 | 827개 PASS / 0 FAIL |
| pnpm audit | HIGH 0개, MODERATE 2개 (개발 전용) |

---

## 6개 탐색 영역 분석 결과

### 1. OpenTelemetry 분산 추적

**현황**: 인프라 계획 수준 완전 -- 실제 SDK 미통합
- OTel Collector DaemonSet 구성 가이드 완비 (`docs/framework/07-infra/opentelemetry-guide.md`)
- Jaeger/Loki/Prometheus 통합 파이프라인 설계 완료
- CSAP-D06 침해사고 탐지 연동 규칙 5개 정의
- Correlation ID (X-Request-ID) 플러그인 구현 완료 + 테스트 5건
- Node.js SDK 계측 코드 가이드 문서 포함 (Section 6)

**판단**: 현상 유지. OTel SDK 통합은 k8s 클러스터 배포 시점에 환경 변수(`OTEL_EXPORTER_OTLP_ENDPOINT`)와 함께 활성화하는 것이 올바른 접근. 현재 Correlation ID로 요청 추적 기본 기능은 구현됨.

### 2. Redis 캐싱 전략

**현황**: 핵심 영역 Redis 통합 완료
- auth-service: ioredis로 Redis 7 직접 연결, 세션 관리/토큰 블랙리스트 구현 (CSAP D-08)
- 동시 세션 3개 제한 FIFO 만료 구현 (D-08-04)
- docker-compose.yml: Redis 7 서비스 + 비밀번호 인증 구성
- CI 환경: Redis 서비스 포함
- 공공데이터 플러그인: 인메모리 캐시 폴백 (Redis 미설정 시)

**판단**: 현상 유지. 핵심 인증/세션 영역은 Redis 완전 통합. 플러그인 인메모리 폴백은 의도된 설계(단일 인스턴스 경량 배포 지원).

### 3. 파일 업로드 보안 -- 보강 완료

**이전 현황**: MIME 타입 검증 + 크기 제한만 존재
**발견된 결함**:
- Path Traversal 방어 없음 (파일명에 `../` 허용)
- 실행 파일 확장자 차단 로직 없음 (테스트에서만 검증)

**보강 내용**:
- `sanitizeFilename()` 함수 추가: `/`, `\`, null byte, `..` 제거
- `hasBlockedExtension()` 함수 추가: 18종 실행 파일 확장자 차단
- uploadFileHandler에 새니타이징 + 차단 로직 통합
- 테스트 보강: Path Traversal 6케이스 + 확장자 차단 5케이스

### 4. API 버전 관리 전략

**현황**: 이미 구현 완료
- URL 기반 버전 관리: `/api/v1/{serviceId}/*`
- 서비스 레지스트리: 14개 정적 서비스 + 동적 플러그인 라우팅
- OpenAPI 3.0 문서 자동 생성 (Swagger UI: `/api/docs`)
- api-routes.md: 전체 API 엔드포인트 맵 문서화

**판단**: 현상 유지. v2 전환은 향후 요구 시 수행.

### 5. 린트 & 포맷 -- 보강 완료

**이전 현황**: ESLint/Prettier 설정 없음, CI에서 lint 실행하지만 실제 규칙 부재
**보강 내용**:
- `eslint.config.mjs` 생성: typescript-eslint 기반 flat config
  - `no-eval`, `no-implied-eval`, `no-new-func` 금지 (CSAP D-12)
  - 하드코딩 API 키 패턴 탐지
  - max-lines-per-function: 80줄 경고 (CLAUDE.md)
  - 테스트 파일 완화 규칙
- `.prettierrc` 생성: 120자 폭, 싱글 쿼트, trailing comma
- `.prettierignore` 생성
- 17개 서비스 + 패키지에 `"lint": "eslint src/ --max-warnings 0"` 스크립트 추가
- pre-commit hook 추가: 시크릿 파일/하드코딩 시크릿 차단 + TypeScript 검사

### 6. 패키지 보안 감사 -- 보강 완료

**이전 현황**: 8개 취약점 (6 HIGH, 2 MODERATE)
- HIGH 4개: `tar` (bcrypt > @mapbox/node-pre-gyp > tar)
- HIGH 2개: `esbuild`, `vite` 관련 (개발 전용)
- MODERATE 2개: `esbuild`, `vite`

**보강 내용**:
- `bcrypt` (네이티브) -> `bcryptjs` (순수 JS) 마이그레이션
  - auth-service, user-service 의존성 교체
  - 4개 파일 import 변경
  - 52개 네이티브 패키지 제거
- 결과: HIGH 0개, MODERATE 2개 (개발 전용 vitest > vite > esbuild)

**잔여 취약점**: esbuild (GHSA-67mh), vite (GHSA-4w7w) -- 둘 다 vitest 개발 의존성으로 프로덕션 미포함. vitest 업그레이드 시 자동 해결 예정.

---

## 변경된 파일 목록

### 보안 보강
- `platform/services/file-service/src/handlers/file.handler.ts` -- 파일명 새니타이징 + 확장자 차단
- `platform/services/file-service/tests/unit/file-csap.test.ts` -- Path Traversal + 확장자 테스트

### bcrypt -> bcryptjs 마이그레이션
- `platform/services/auth-service/src/lib/password.ts`
- `platform/services/auth-service/package.json`
- `platform/services/user-service/src/handlers/user.handler.ts`
- `platform/services/user-service/src/handlers/password.handler.ts`
- `platform/services/user-service/src/handlers/password-reset.handler.ts`
- `platform/services/user-service/package.json`

### 린트 & 포맷 인프라
- `eslint.config.mjs` (신규)
- `.prettierrc` (신규)
- `.prettierignore` (신규)
- `platform/services/*/package.json` (17개 lint 스크립트 추가)
- `platform/packages/*/package.json` (lint 스크립트 추가)
- `.git/hooks/pre-commit` (신규)
- `package.json` (eslint, typescript-eslint, @eslint/js 의존성)

### 기타
- `CHANGELOG.md` -- Security 섹션 추가
- `pnpm-lock.yaml` -- 의존성 갱신

---

## 전체 진행률

- 완료 MTU: 46 / 46 (100%)
- 테스트: 827 ALL PASS
- pnpm audit: HIGH 0, MODERATE 2 (개발 전용)
- CSAP D-12: ESLint + 파일 보안 보강 완료

## 다음 세션 권장

1. OTel SDK 통합: k8s 배포 환경 준비 완료 시 `@opentelemetry/sdk-node` 패키지 추가
2. vitest 업그레이드: vite/esbuild moderate 취약점 해소
3. E2E 테스트 안정화: Playwright 기반 브라우저 테스트 재실행
