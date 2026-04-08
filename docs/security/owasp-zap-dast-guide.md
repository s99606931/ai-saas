# OWASP ZAP 동적 분석 (DAST) 가이드

> Plan SC: FR-N20.2
> Design Ref: D-N20.2
> CSAP: D-12-05 보안 시험

| 항목 | 내용 |
|------|------|
| 버전 | 1.0.0 |
| 작성일 | 2026-04-08 |
| 도구 | ZAP by Checkmarx (ghcr.io/zaproxy/zaproxy:stable) |
| 대상 | API 게이트웨이 (http://localhost:4000), 포털 (http://localhost:3000) |

---

## 1. 사전 조건

- Docker 설치 (ZAP은 Docker 이미지로 실행)
- 대상 서비스 기동 상태 확인
- OpenAPI 3.0 사양 파일 (docs/api/openapi.yaml)

```bash
# 서비스 기동 확인
curl -s http://localhost:4000/health | jq .
curl -s http://localhost:3000 | head -5
```

---

## 2. 스캔 유형

### 2.1 Baseline Scan (자동, CI/CD 권장)

빠른 패시브 스캔. 적극적 공격 없이 응답 분석만 수행.

```bash
# API 게이트웨이 Baseline Scan
docker run --rm \
  -v $(pwd)/reports/zap:/zap/wrk/:rw \
  --network host \
  ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py \
  -t http://localhost:4000 \
  -r "zap-baseline-api-$(date +%Y%m%d).html" \
  -J "zap-baseline-api-$(date +%Y%m%d).json" \
  -l WARN

# 포털 Baseline Scan
docker run --rm \
  -v $(pwd)/reports/zap:/zap/wrk/:rw \
  --network host \
  ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py \
  -t http://localhost:3000 \
  -r "zap-baseline-portal-$(date +%Y%m%d).html" \
  -J "zap-baseline-portal-$(date +%Y%m%d).json" \
  -l WARN
```

### 2.2 API Scan (OpenAPI 연동)

OpenAPI 사양 기반으로 모든 엔드포인트를 자동 탐색 후 스캔.

```bash
# OpenAPI 3.0 사양 기반 API Scan
docker run --rm \
  -v $(pwd)/reports/zap:/zap/wrk/:rw \
  -v $(pwd)/docs/api/openapi.yaml:/zap/openapi.yaml:ro \
  --network host \
  ghcr.io/zaproxy/zaproxy:stable \
  zap-api-scan.py \
  -t http://localhost:4000 \
  -f openapi \
  -O /zap/openapi.yaml \
  -r "zap-api-$(date +%Y%m%d).html" \
  -J "zap-api-$(date +%Y%m%d).json"
```

### 2.3 Full Scan (반기 정기 점검)

적극적 공격 포함. 프로덕션이 아닌 스테이징 환경에서만 실행.

```bash
# Full Active Scan (주의: 서비스 부하 발생)
docker run --rm \
  -v $(pwd)/reports/zap:/zap/wrk/:rw \
  --network host \
  ghcr.io/zaproxy/zaproxy:stable \
  zap-full-scan.py \
  -t http://localhost:4000 \
  -r "zap-full-$(date +%Y%m%d).html" \
  -J "zap-full-$(date +%Y%m%d).json" \
  -m 10  # 10분 타임아웃
```

---

## 3. 결과 해석

### ZAP 경고 등급

| 등급 | 의미 | CSAP 영향 | 조치 |
|------|------|----------|------|
| High | 심각한 취약점 (SQL Injection, XSS 등) | D-12 실패 | 즉시 수정, 릴리스 차단 |
| Medium | 중간 위험 (보안 헤더 누락, CSRF 등) | D-12 조건부 | 릴리스 전 수정 권고 |
| Low | 낮은 위험 (정보 노출, 쿠키 설정 등) | 미영향 | 백로그 등록 |
| Informational | 정보성 (서버 버전 노출 등) | 미영향 | 검토 후 무시 가능 |

### 주요 탐지 항목 (OWASP Top 10 매핑)

| OWASP | ZAP 탐지 | 예상 결과 (현재 구현 기준) |
|-------|---------|------------------------|
| A01 Broken Access Control | IDOR, 권한 우회 | PASS (RBAC 적용) |
| A02 Cryptographic Failures | TLS 미적용, 약한 암호화 | PASS (AES-256 + bcryptjs) |
| A03 Injection | SQL Injection, XSS | PASS (Zod + 매개변수화 쿼리) |
| A04 Insecure Design | 비즈니스 로직 취약점 | 수동 검토 필요 |
| A05 Security Misconfiguration | 보안 헤더 누락, 기본 계정 | 확인 필요 |
| A06 Vulnerable Components | 알려진 취약점 | PASS (pnpm audit HIGH 0건) |
| A07 Auth Failures | 무차별 대입, 세션 고정 | PASS (계정 잠금 + JWT 15분) |
| A08 Data Integrity Failures | 서명 미검증 | PASS (Cosign 이미지 서명) |
| A09 Security Logging | 로그 부재 | PASS (audit-sdk 전수 기록) |
| A10 SSRF | 서버 측 요청 위조 | 확인 필요 (ai-service 프록시) |

---

## 4. 보안 헤더 확인

```bash
# API 응답 보안 헤더 확인
curl -I http://localhost:4000/health

# 확인 항목:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# Strict-Transport-Security: max-age=31536000
# Content-Security-Policy: default-src 'self'
# X-XSS-Protection: 0 (CSP가 대체)
```

---

## 5. 정기 점검 일정

| 점검 유형 | 주기 | 도구 | 환경 |
|---------|------|------|------|
| Baseline Scan | 매주 (CI/CD) | ZAP Baseline | 스테이징 |
| API Scan | 격주 | ZAP API Scan | 스테이징 |
| Full Scan | 반기 | ZAP Full Scan | 스테이징 |
| 침투 테스트 | 연 1회 | 외부 전문 업체 | 프로덕션 (협의) |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 초안 작성 | PM Lead Agent |
