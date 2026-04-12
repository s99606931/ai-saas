# SVC-HTTPSEC-R38 DESIGN: HTTP Security Headers

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead

## API

```ts
evaluateCors(request, options) → {
  allowed: boolean,
  headers: Record<string,string>,
  isPreflight: boolean
}

buildCspHeader(directives) → string
buildHstsHeader({maxAge, includeSubDomains, preload}) → string
buildSecurityHeaders(options) → Record<string, string>
```

## CORS 평가 로직

```
1. Origin 헤더 확인
2. allowedOrigins: string[] 또는 '*' 또는 함수
3. method 화이트리스트 체크
4. preflight: Access-Control-Request-Method/Headers 허용 여부
5. credentials=true면 origin='*' 금지
```

## Session Guide
- `src/http-security.ts` → `src/index.ts` → `tests/http-security.test.ts`
