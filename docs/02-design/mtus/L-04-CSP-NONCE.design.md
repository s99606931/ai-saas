# Design: L-04 -- CSP unsafe-inline 제거, nonce 기반 전환

> 작성일: 2026-04-10 | 버전: 1.0

## 1. Middleware 설계

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'; ...`;
  // 요청에 nonce 전달 (layout.tsx에서 읽기)
  request.headers.set('x-nonce', nonce);
  // 응답에 CSP 설정
  response.headers.set('Content-Security-Policy', csp);
}
```

## 2. CSP 정책 최종

```
default-src 'self';
script-src 'self' 'nonce-{nonce}' 'strict-dynamic';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self';
connect-src 'self' http://localhost:* ws://localhost:*;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

## 3. 'strict-dynamic' 설명
- nonce가 있는 스크립트가 로드하는 추가 스크립트도 허용
- Next.js의 동적 chunk 로딩 지원
