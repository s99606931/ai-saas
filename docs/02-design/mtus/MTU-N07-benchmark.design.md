# MTU-N07: 성능 벤치마크 -- Design 문서

> **문서 ID**: DESIGN-MTU-N07
> **버전**: 1.0.0
> **작성일**: 2026-04-08
> **Plan 참조**: PLAN-MTU-N07

---

## 설계

autocannon (Node.js HTTP 벤치마크 도구)을 사용하여 주요 API 엔드포인트의 성능을 측정합니다.

### 측정 대상

1. `/health` -- 헬스체크 (baseline)
2. `/api/v1/auth/login` -- 인증 (POST)
3. `/api/v1/users` -- 사용자 목록 (GET, 인증 필요)
4. `/api/v1/tenants` -- 테넌트 목록 (GET, 인증 필요)
5. `/api/v1/audit-logs` -- 감사 로그 (GET, 인증 필요)

### 기준값

| 지표 | 기준 |
|------|------|
| P95 응답시간 | < 200ms |
| P99 응답시간 | < 500ms |
| 에러율 | < 1% |
| 초당 요청 | > 100 RPS |

### 산출물

- `platform/scripts/benchmark.mjs` -- 벤치마크 스크립트
- 실행 결과: JSON + 콘솔 테이블

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 초기 작성 | PM Lead |
