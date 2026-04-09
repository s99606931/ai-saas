# TraceQL 쿼리 예시 — 공공기관 SaaS 운영

> **버전**: 1.0.0 | **작성일**: 2026-04-09
> **Design Ref**: MTU-N48 Design
> **Plan SC**: FR-N48.3

---

## TraceQL 기본 문법

```
{ <span-set> } | <pipeline-operations>
```

---

## 운영 시나리오별 쿼리

### 1. 에러 트레이스 조회

```traceql
# 모든 에러 트레이스
{ status = error }

# 특정 서비스의 에러
{ resource.service.name = "api-gateway" && status = error }

# 500 에러만
{ span.http.status_code = 500 }
```

### 2. 느린 요청 분석

```traceql
# 1초 이상 소요된 요청
{ duration > 1s }

# 5초 이상 소요된 특정 서비스
{ resource.service.name = "auth-service" && duration > 5s }

# P99에 해당하는 느린 트레이스
{ duration > 2s } | select(resource.service.name, name, duration)
```

### 3. 서비스간 호출 추적

```traceql
# API Gateway → Auth Service 호출
{ resource.service.name = "api-gateway" } >> { resource.service.name = "auth-service" }

# 특정 HTTP 경로 추적
{ span.http.route = "/api/v1/tenants" }

# POST 요청만
{ span.http.method = "POST" && resource.service.name = "tenant-service" }
```

### 4. 인증/인가 관련 (CSAP D-08)

```traceql
# 인증 실패 추적
{ resource.service.name = "auth-service" && span.http.status_code = 401 }

# 권한 부족 추적
{ span.http.status_code = 403 }

# 로그인 요청 추적
{ span.http.route = "/api/v1/auth/login" }
```

### 5. 감사 추적 (CSAP D-06)

```traceql
# 감사 서비스 호출 추적
{ resource.service.name = "audit-service" }

# 데이터 삭제 작업 추적
{ span.http.method = "DELETE" } | select(resource.service.name, name, duration)

# 관리자 작업 추적
{ span.user.role = "admin" }
```

### 6. 멀티테넌트 격리 (CSAP D-08)

```traceql
# 특정 테넌트의 모든 요청
{ resource.tenant.id = "tenant-001" }

# 테넌트간 교차 접근 감지 (보안 감사)
{ span.tenant.id != resource.tenant.id }
```

### 7. AI 서비스 모니터링

```traceql
# AI Gateway 호출 추적
{ resource.service.name = "ai-gateway" }

# LLM API 응답 시간
{ resource.service.name = "ai-gateway" && name = "llm.completion" } | select(duration)

# AI 서비스 에러
{ resource.service.name =~ "ai-.*" && status = error }
```

### 8. 성능 분석

```traceql
# 서비스별 응답시간 분포
{ } | select(resource.service.name, duration)

# 데이터베이스 쿼리 추적
{ span.db.system = "postgresql" && duration > 100ms }

# 캐시 히트/미스
{ span.cache.hit = false && resource.service.name = "api-gateway" }
```

---

## Grafana에서 사용법

1. Explore 메뉴 → Tempo 데이터소스 선택
2. TraceQL 탭 클릭
3. 위 쿼리 입력 후 실행
4. 트레이스 클릭 → 상세 타임라인 확인
5. "Logs for this span" 클릭 → Loki 연동 로그 확인

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
