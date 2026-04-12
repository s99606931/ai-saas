# Report: MTU-N29 E2E 시나리오 테스트

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N29 |
| 최종 매치율 | 100% (5/5 FR) |
| 테스트 결과 | 28/28 ALL PASS |
| 완료일 | 2026-04-08 |

---

## FR 달성 현황

| FR ID | 요구사항 | 상태 |
|-------|---------|------|
| FR-N29.1 | 인증 E2E 시나리오 | PASS (5/5 TC) |
| FR-N29.2 | 서비스 간 통신 시나리오 | PASS (12/12 TC) |
| FR-N29.3 | 인프라 서비스 시나리오 | PASS (5/5 TC) |
| FR-N29.4 | NetworkPolicy 검증 | PASS (3/3 TC) |
| FR-N29.5 | 공급망 보안 검증 | PASS (3/3 TC) |

---

## 테스트 결과 상세

### S1: 인증 E2E (5건 PASS)
- API Gateway 헬스, 14개 서비스 등록, Auth/User/Tenant 헬스

### S2: 서비스 간 통신 (12건 PASS)
- Auth, Audit, AI, Compliance, Security Monitor, Billing, Menu,
  Catalog, Subscription, CRM, Notification, File 전 서비스 통신 확인

### S3: 인프라 서비스 (5건 PASS)
- PostgreSQL, Redis, Prometheus, Grafana, Harbor 접속 확인

### S4: NetworkPolicy 격리 (3건 PASS)
- 15+ NetworkPolicy 적용, default-deny 존재, Pod 안정성

### S5: 공급망 보안 (3건 PASS)
- Cosign 공개키 존재, 이미지 서명 검증, Kyverno 정책 존재

---

## 산출물

| 경로 | 설명 |
|------|------|
| scripts/test-e2e-scenarios.sh | E2E 테스트 스크립트 (28건) |
