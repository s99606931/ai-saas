# 전자정부 표준프레임워크 호환성 가이드

> **문서 버전**: 1.0 | **작성일**: 2026-04-10
> **대상**: 전자정부 표준프레임워크 v4.2

## 개요

공공기관 SaaS 플랫폼은 전자정부 표준프레임워크와 **인터페이스 수준 호환성**을 제공합니다.
기존 표준프레임워크 기반 시스템과의 연계 및 데이터 교환이 원활하게 이루어집니다.

## 호환성 매핑

| 표준프레임워크 구성요소 | SaaS 플랫폼 대체 | 호환 수준 |
|-----------------------|----------------|---------|
| Spring Security | Keycloak + OAuth2/OIDC | 완전 호환 |
| Spring MVC | Express/Fastify REST API | 완전 호환 |
| MyBatis | Prisma/Drizzle ORM | 완전 호환 |
| Spring Session | JWT + Redis | 완전 호환 |
| Jenkins | Gitea Actions | 완전 호환 |
| WAS (Tomcat/JBoss) | Docker + k3s | 완전 호환 |
| 행정 연계 메시지 | REST API 어댑터 | 부분 호환 |

## 인증/인가 연동

### 기존 표준프레임워크 방식
```java
// Spring Security 기반
@PreAuthorize("hasRole('ADMIN')")
public ResponseEntity<?> adminEndpoint() { ... }
```

### SaaS 플랫폼 방식
```typescript
// Keycloak JWT + RBAC
export async function GET(req: Request) {
  const user = await verifyToken(req.headers.authorization);
  if (!hasPermission(user, 'admin')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
}
```

## 데이터 교환 표준

### 표준 응답 형식 (공공데이터포털 호환)

```json
{
  "resultCode": "200",
  "resultMsg": "정상 처리되었습니다",
  "currentPage": 1,
  "totalCount": 150,
  "numOfRows": 10,
  "data": [...]
}
```

## 마이그레이션 가이드

기존 전자정부 표준프레임워크 시스템에서 SaaS 플랫폼으로 전환 시:

1. **API 엔드포인트 매핑**: 기존 Controller URL → REST API 매핑 표 작성
2. **인증 전환**: Spring Security → Keycloak SSO 마이그레이션
3. **데이터베이스**: 기존 스키마 → Prisma 스키마 변환
4. **배포**: WAR/JAR → Docker 컨테이너화

## 호환성 자동 점검

```bash
# 호환성 자동 점검 실행
bash scripts/egov-compatibility-check.sh

# 체크리스트 확인
cat infra/compliance/egov-compatibility-checklist.yaml
```

## 제한사항

| 항목 | 설명 | 대안 |
|------|------|------|
| JSP 뷰 | JSP 렌더링 미지원 | React/Next.js SPA |
| MyBatis XML | XML 매퍼 미지원 | TypeScript ORM |
| 행정 연계 | 일부 커스터마이징 필요 | REST API 어댑터 제공 |
