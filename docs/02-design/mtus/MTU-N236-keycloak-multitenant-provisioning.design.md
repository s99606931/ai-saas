# MTU-N236: Keycloak 멀티테넌트 Realm 자동 프로비저닝 -- Design

> **버전**: 1.0 | **작성일**: 2026-04-10
> **Plan 참조**: docs/01-plan/mtus/MTU-N236-keycloak-multitenant-provisioning.plan.md

## 아키텍처 옵션

| 옵션 | 설명 | 선택 |
|------|------|------|
| A. Multi-Realm | Realm per Tenant (전통적) | - |
| B. Organizations (Single Realm) | Keycloak 26+ Organizations 기능 | **선택** |
| C. 하이브리드 | 대형 테넌트=별도 Realm, 소형=Organizations | 향후 확장 |

**선택 근거**: Keycloak 26+ Organizations 기능이 GA 되어 단일 Realm에서 멀티테넌시 구현 가능.
관리 오버헤드 최소화, 성능 우수, 사용자 공유 가능.

## 상세 설계

### 1. Organizations 기반 테넌트 프로비저닝

```
[테넌트 요청] → [프로비저닝 스크립트] → [Keycloak Admin API]
                                            ↓
                                    Organization 생성
                                    + 기본 역할 할당
                                    + IdP 연결 (선택)
                                    + 관리자 초대
```

### 2. 프로비저닝 자동화 흐름

1. Organization 생성 (이름, 도메인, 설명)
2. Organization 전용 그룹 생성 (admin, user, viewer)
3. 기본 클라이언트 스코프 매핑
4. 관리자 사용자 초대 이메일
5. 테넌트별 IdP 설정 (선택적)
6. 프로비저닝 감사 로그 기록

### 3. 디프로비저닝 흐름 (FR-MT.6)

1. 조직 비활성화 (즉시)
2. 데이터 보존 기간 (90일)
3. 완전 삭제 (보존 기간 경과 후)
