# MTU-P09: CRM 서비스 -- Design 문서

> **문서 ID**: DESIGN-MTU-P09 | **버전**: 1.0.0 | **작성일**: 2026-04-05

## 아키텍처

```
API Gateway (/api/v1/crm) → crm-service (port 3008)
                                 ↓
                             PostgreSQL (Customer, Contact, Contract 모델)
```

## API 설계

| Method | Path | FR | 설명 |
|--------|------|-----|------|
| GET | /crm/customers | FR-P09.1 | 고객사 목록 조회 |
| GET | /crm/customers/:id | FR-P09.1 | 고객사 상세 |
| POST | /crm/customers | FR-P09.1 | 고객사 등록 |
| PUT | /crm/customers/:id | FR-P09.1 | 고객사 수정 |
| GET | /crm/customers/:id/contacts | FR-P09.2 | 담당자 목록 |
| POST | /crm/customers/:id/contacts | FR-P09.2 | 담당자 등록 |
| GET | /crm/contracts | FR-P09.3 | 계약 목록 |
| POST | /crm/contracts | FR-P09.3 | 계약 등록 |
| PUT | /crm/contracts/:id | FR-P09.3 | 계약 수정 |
| GET | /crm/pipeline | FR-P09.4 | 파이프라인 조회 |

## 데이터 모델

- `Customer`: id, tenantId?, name, industry, size, status
- `Contact`: id, customerId, name, email, phone, role, isPrimary
- `Contract`: id, customerId, title, value, startDate, endDate, status

## 보안 매핑

| CSAP | 구현 |
|------|------|
| D-08 | 접근 권한 검사 |
| D-06 | 계약/고객 변경 감사 로그 |
