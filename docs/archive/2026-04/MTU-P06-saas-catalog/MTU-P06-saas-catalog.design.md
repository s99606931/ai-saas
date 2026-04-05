# MTU-P06: SaaS 서비스 카탈로그 -- Design 문서

> **문서 ID**: DESIGN-MTU-P06 | **버전**: 1.0.0 | **작성일**: 2026-04-05

## 아키텍처

```
API Gateway (/api/v1/catalog) → catalog-service (port 3005)
                                     ↓
                                 PostgreSQL (Service, FeatureFlag 모델)
```

## API 설계

| Method | Path | FR | 설명 |
|--------|------|-----|------|
| GET | /catalog/services | FR-P06.1 | 서비스 목록 조회 |
| GET | /catalog/services/:id | FR-P06.1 | 서비스 상세 조회 |
| POST | /catalog/services | FR-P06.1 | 서비스 등록 |
| PUT | /catalog/services/:id | FR-P06.1 | 서비스 수정 |
| DELETE | /catalog/services/:id | FR-P06.1 | 서비스 삭제 |
| PUT | /catalog/services/:id/version | FR-P06.2 | 버전 업데이트 |
| GET | /catalog/services/:id/flags | FR-P06.3 | Feature Flag 목록 |
| PUT | /catalog/services/:id/flags/:key | FR-P06.3 | Feature Flag 토글 |

## 데이터 모델

- `Service`: id, name, slug, description, category, version, isBuiltIn, isActive, config
- `FeatureFlag`: id, serviceId, key, enabled, config

## 보안 매핑

| CSAP | 구현 |
|------|------|
| D-12 | 버전 관리로 서비스 변경 추적 |
