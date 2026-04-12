# Design — SVC-AI-ADV-R164 AI Service Catalog Manager

## 아키텍처 옵션

| 옵션 | 장점 | 단점 | 선택 |
|------|------|------|------|
| 인메모리 Map + 요청 워크플로 | 단순, 테스트 용이 | 영속성 없음 | ★ Pragmatic |
| DB ORM 기반 | 영속성 | 의존성 | - |
| OpenAPI + 외부 레지스트리 | 표준 | 복잡 | - |

## 모듈 구조

```
ai-service-catalog-manager-r164.ts
├── CatalogService { id, name, category, tags, owner, description }
├── AccessRequest { id, serviceId, userId, status, approvedBy?, at }
├── AiServiceCatalogManagerR164
│   ├── register(service, owner, grade)
│   ├── discover(query)
│   ├── getService(serviceId, userId)
│   ├── requestAccess(serviceId, userId)
│   ├── approveAccess(requestId, approver)
│   ├── getStats(), getAuditLog()
```

## 핵심 결정

- service id는 slug화된 이름 (중복 체크 기준)
- 승인 사용자만 getService 상세 허용, discover는 메타만 반환
- 요청 상태: pending/approved/rejected

## Session Guide

- 파일 < 320 줄, 테스트 10+

## 추적성

- FR-R164.1~FR-R164.8 → 메서드 매핑
