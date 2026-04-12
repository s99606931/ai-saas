# Plan: L-04 -- CSP unsafe-inline 제거, nonce 기반 전환

> 작성일: 2026-04-10 | 버전: 1.0

## 기능 요구사항

### FR-L04.1: middleware.ts nonce 생성
- crypto.randomUUID() 또는 crypto.getRandomValues로 nonce 생성
- x-nonce 요청 헤더에 주입
- Content-Security-Policy 응답 헤더에 nonce 포함

### FR-L04.2: script-src nonce 전환
- `script-src 'self' 'unsafe-inline'` -> `script-src 'self' 'nonce-{nonce}'`
- next.config.ts에서 CSP 헤더 제거 (middleware로 이전)

### FR-L04.3: style-src 유지
- Tailwind CSS 인라인 스타일 필요로 unsafe-inline 유지
- 향후 CSS Modules 전환 시 nonce로 교체

### FR-L04.4: layout.tsx에 nonce 전달
- next/headers에서 x-nonce 읽기
- Script 컴포넌트에 nonce prop 전달

## 변경 파일
- `platform/apps/portal/src/middleware.ts` (신규)
- `platform/apps/portal/next.config.ts` (수정 -- CSP 라인 제거)
- `platform/apps/portal/src/app/layout.tsx` (수정 -- nonce 주입)
