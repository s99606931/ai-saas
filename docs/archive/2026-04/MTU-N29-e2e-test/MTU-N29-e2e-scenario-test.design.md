# Design: MTU-N29 E2E 시나리오 테스트

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N29 |
| 버전 | 1.0.0 |
| 작성일 | 2026-04-08 |
| 선택 옵션 | Option B: Pragmatic Balance |

---

## Design Anchor

- **결정**: kubectl port-forward + curl 기반 E2E 테스트
- **근거**: k3s 내부 서비스 접근, 추가 도구 불필요
- **영향**: 브라우저 테스트 제외 (API 레벨 테스트만)

---

## 시나리오 설계

### S1: 인증 E2E

```
1. POST /api/auth/register → 201 Created
2. POST /api/auth/login → 200 + JWT
3. GET /api/auth/me (with JWT) → 200 + 사용자 정보
4. POST /api/auth/refresh → 200 + 새 JWT
5. POST /api/auth/logout → 200
6. GET /api/auth/me (expired JWT) → 401
```

### S2: 테넌트 격리

```
1. POST /api/tenants → 201 (테넌트 A)
2. POST /api/tenants → 201 (테넌트 B)
3. GET /api/tenants/:a (테넌트 A 토큰) → 200
4. GET /api/tenants/:b (테넌트 A 토큰) → 403 (격리 확인)
```

### S3: API 게이트웨이

```
1. GET /api/health → 200
2. GET /api/services (인증 없음) → 401
3. GET /api/services (인증 있음) → 200
```

### S4: 감사 로그

```
1. POST /api/audit/query (로그인 이벤트 조회) → 200
2. 이전 S1~S3 작업 기록 존재 확인
```

---

## 테스트 스크립트 구조

```bash
scripts/test-e2e-scenarios.sh
  ├── test_auth_scenario()
  ├── test_tenant_isolation()
  ├── test_api_gateway()
  ├── test_audit_logs()
  └── summary_report()
```
