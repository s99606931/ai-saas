# SVC-PROBLEMJSON-R49 Report — RFC 7807 Problem Details 빌더

| 항목 | 값 |
|------|-----|
| 일자 | 2026-04-11 |
| 상태 | 완료 |
| matchRate | 100% |
| 테스트 | 29/29 |

## Executive Summary

| 관점 | 결과 |
|------|------|
| 기능 | 빌더 + 16종 표준 preset + traceId/errors 첨부 + production sanitize |
| 품질 | 29 테스트, typecheck strict, 외부 의존성 0 |
| 보안 | production에서 detail 및 stack 자동 제거 |
| 운영 | 모든 마이크로서비스 1줄 import로 사용 가능 |

## Key Decisions

1. **한국어 title 기본값**: 공공 SaaS 사용자 대상이므로 한국어 제목.
2. **type URI 기본 base**: `https://problems.public-saas.kr/{slug}` — 추후 문서 페이지로 연결 가능.
3. **extensions 보호**: type/title/status는 extensions로 덮어쓸 수 없음.
4. **3-tier env**: development/staging는 detail 유지, production만 제거.

## 산출물

- `platform/packages/problem-details/{src,tests}` 7 파일
