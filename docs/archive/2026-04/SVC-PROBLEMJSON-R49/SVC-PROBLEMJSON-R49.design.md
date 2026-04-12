# SVC-PROBLEMJSON-R49 Design — Problem Details 빌더

## 모듈 구조

```
platform/packages/problem-details/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── builder.ts      # problem(), withTraceId(), withErrors()
│   ├── presets.ts      # 16종 사전정의
│   └── sanitize.ts
└── tests/
    └── problem-details.test.ts
```

## 타입

```typescript
export interface FieldError {
  field: string;
  message: string;
  code?: string;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: FieldError[];
  traceId?: string;
  [extension: string]: unknown;
}

export interface ProblemOptions {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  extensions?: Record<string, unknown>;
}
```

## Presets (16종)

| Slug | Status | Title |
|------|--------|-------|
| bad-request | 400 | 잘못된 요청 |
| unauthorized | 401 | 인증 필요 |
| forbidden | 403 | 권한 없음 |
| not-found | 404 | 리소스를 찾을 수 없음 |
| method-not-allowed | 405 | 허용되지 않은 메서드 |
| conflict | 409 | 자원 충돌 |
| gone | 410 | 리소스 영구 삭제됨 |
| precondition-failed | 412 | 사전 조건 실패 |
| payload-too-large | 413 | 요청 본문 초과 |
| unsupported-media-type | 415 | 지원하지 않는 미디어 타입 |
| unprocessable | 422 | 처리 불가 (검증 실패) |
| too-many-requests | 429 | 요청 한도 초과 |
| internal-error | 500 | 내부 서버 오류 |
| not-implemented | 501 | 구현되지 않음 |
| bad-gateway | 502 | 게이트웨이 오류 |
| service-unavailable | 503 | 서비스 일시 중단 |

기본 type: `https://problems.public-saas.kr/{slug}`

## 알고리즘

### sanitize(problem, env)
```
if env === 'production':
  remove 'detail' (default error info만 유지)
  remove stack-like extensions (extensions['stack'])
return problem
```

## 테스트 (18+)
- problem 빌더 필수 필드 검증, status 범위, type 자동 생성
- 16개 preset 각각 status code 검증 (16)
- withTraceId, withErrors 첨부
- sanitize production / development 차이
- extension 필드 자유 추가
