# SVC-CONFIG-R31 DESIGN: Config Loader 라이브러리

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/SVC-CONFIG-R31.plan.md

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 초안 작성 | PM Lead |

---

## 설정 로드 흐름

```
process.env
  -> 접두사 필터링 (prefix 옵션)
  -> Zod 스키마 검증 + 타입 변환
  -> 성공: 타입 안전 설정 객체 반환
  -> 실패: 누락/유효하지 않은 필드 상세 에러 + process.exit(1)
```

---

## 주요 인터페이스

```typescript
interface ConfigLoaderOptions {
  prefix?: string;          // 환경변수 접두사 (예: 'APP_')
  sensitiveKeys?: string[]; // 마스킹 대상 키 (예: ['password', 'secret'])
  exitOnError?: boolean;    // 검증 실패 시 프로세스 종료 (기본: true, 테스트 시 false)
}

function loadConfig<T>(schema: ZodSchema<T>, options?: ConfigLoaderOptions): T;
function dumpConfig<T>(config: T, sensitiveKeys?: string[]): Record<string, string>;
```

---

## 마스킹 출력 형식

```
{
  DB_HOST: "localhost",
  DB_PORT: "5432",
  DB_PASSWORD: "***MASKED***",
  JWT_SECRET: "***MASKED***",
  NODE_ENV: "production"
}
```

---

## Session Guide

### 구현 순서
1. `src/config-loader.ts` -- 코어 Config Loader
2. `src/index.ts` -- 패키지 엔트리포인트
3. `tests/config-loader.test.ts` -- 단위 테스트

### Design Anchor
- 모든 구현 파일 상단: `// Design Ref: SVC-CONFIG-R31 DESIGN`
- 모든 함수: `// Plan SC: FR-CF.{번호}`
