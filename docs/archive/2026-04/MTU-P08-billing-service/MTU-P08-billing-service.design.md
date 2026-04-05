# MTU-P08: 빌링 서비스 -- Design 문서

> **문서 ID**: DESIGN-MTU-P08 | **버전**: 1.0.0 | **작성일**: 2026-04-05

## 아키텍처

```
API Gateway (/api/v1/billing) → billing-service (port 3007)
                                     ↓
                                 PostgreSQL (Invoice, Payment 모델)
```

## API 설계

| Method | Path | FR | 설명 |
|--------|------|-----|------|
| GET | /billing/invoices | FR-P08.1 | 인보이스 목록 조회 |
| GET | /billing/invoices/:id | FR-P08.1 | 인보이스 상세 |
| POST | /billing/invoices/generate | FR-P08.1 | 인보이스 자동 생성 |
| POST | /billing/invoices/:id/pay | FR-P08.2 | 결제 처리 |
| GET | /billing/payments | FR-P08.2 | 결제 이력 조회 |
| POST | /billing/invoices/:id/tax-invoice | FR-P08.3 | 세금계산서 생성 |
| GET | /billing/dashboard | FR-P08.4 | 수익 대시보드 데이터 |

## 데이터 모델

- `Invoice`: id, subscriptionId, amount, currency, status, issuedAt, paidAt, dueDate
- `Payment`: id, invoiceId, amount, method, status, paidAt

## 보안 매핑

| CSAP | 구현 |
|------|------|
| D-06 | 결제 이력/인보이스 변경 감사 로그 |
