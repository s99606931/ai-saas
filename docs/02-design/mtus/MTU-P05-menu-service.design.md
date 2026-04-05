# MTU-P05: 메뉴 관리 서비스 -- Design 문서

> **문서 ID**: DESIGN-MTU-P05 | **버전**: 1.0.0 | **작성일**: 2026-04-05

## 아키텍처

```
API Gateway (/api/v1/menu) → menu-service (port 3004)
                                  ↓
                              PostgreSQL (MenuItem 모델)
```

## API 설계

| Method | Path | FR | 설명 |
|--------|------|-----|------|
| GET | /menu/tree | FR-P05.1 | 테넌트별 메뉴 트리 조회 |
| POST | /menu | FR-P05.1 | 메뉴 항목 생성 |
| PUT | /menu/:id | FR-P05.1 | 메뉴 항목 수정 |
| DELETE | /menu/:id | FR-P05.1 | 메뉴 항목 삭제 |
| PUT | /menu/:id/order | FR-P05.3 | 순서 변경 |
| GET | /menu/filtered | FR-P05.2 | 역할별 메뉴 필터링 |

## 데이터 모델

Prisma `MenuItem` 모델 사용: id, tenantId, parentId, label, path, icon, order, isVisible, roles (Json)

## 보안 매핑

| CSAP | 구현 |
|------|------|
| D-08-05 | roles Json 필드로 역할별 접근 통제 |
| N-03 | tenantId 격리 |
