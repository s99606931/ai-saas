# MTU-N20: 보안 최종 점검 Design

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N20 |
| Phase | Phase 7 New (보안) |
| 버전 | 1.0.0 |
| 상태 | Approved |
| 작성일 | 2026-04-08 |
| 작성자 | PM Lead Agent (Claude Opus) |
| Plan 참조 | docs/01-plan/mtus/MTU-N20-security-final-audit.plan.md |

---

## Design Anchor

| 항목 | 내용 |
|------|------|
| 아키텍처 옵션 | Option B: Pragmatic Balance (기존 security-audit.sh 확장 + 가이드 문서) |
| 선택 근거 | 이미 security-audit.sh가 Trivy + npm audit + ZAP을 지원. 추가로 이미지 스캔 절차와 CI/CD 통합 가이드를 문서화 |
| 제약 | CLAUDE.md 절대 제약, CSAP D-12, 외부 서비스 사용 금지 (Docker 이미지만 활용) |

---

## D-N20.1: Trivy 컨테이너 이미지 스캔

### 스캔 대상

18개 Dockerfile이 존재하는 서비스:
- platform/services/: 16개 서비스
- platform/apps/portal/: 1개 포털
- (추가 필요 시 admin-portal, tenant-portal)

### 실행 절차

```bash
# 1. 이미지 빌드 (로컬)
docker build -t saas-auth:latest platform/services/auth-service/

# 2. Trivy 이미지 스캔
trivy image --severity HIGH,CRITICAL \
  --ignore-unfixed \
  --format json \
  --output reports/trivy-auth-$(date +%Y%m%d).json \
  saas-auth:latest

# 3. 전체 서비스 일괄 스캔 스크립트
for svc in auth user tenant api-gateway ai audit menu catalog \
           subscription billing crm notification file compliance \
           security security-monitor; do
  docker build -t "saas-${svc}:latest" "platform/services/${svc}-service/" 2>/dev/null
  trivy image --severity HIGH,CRITICAL "saas-${svc}:latest" || true
done
```

### 결과 해석 기준

| 심각도 | 조치 | 기한 |
|--------|------|------|
| CRITICAL | 즉시 패치, 릴리스 차단 | 24시간 |
| HIGH | 릴리스 전 패치 권고 | 1주일 |
| MEDIUM | 다음 스프린트 조치 | 1개월 |
| LOW | 백로그 등록 | 분기 |

---

## D-N20.2: OWASP ZAP 동적 분석

### Baseline Scan (자동)

```bash
# API 게이트웨이 대상 Baseline Scan
docker run --rm \
  -v $(pwd)/reports:/zap/wrk/:rw \
  ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py \
  -t http://host.docker.internal:4000 \
  -r "zap-baseline-$(date +%Y%m%d).html" \
  -J "zap-baseline-$(date +%Y%m%d).json" \
  -l WARN
```

### API Scan (OpenAPI 연동)

```bash
# OpenAPI 3.0 사양 기반 API Scan
docker run --rm \
  -v $(pwd)/reports:/zap/wrk/:rw \
  -v $(pwd)/docs/api/openapi.yaml:/zap/openapi.yaml:ro \
  ghcr.io/zaproxy/zaproxy:stable \
  zap-api-scan.py \
  -t /zap/openapi.yaml \
  -f openapi \
  -r "zap-api-$(date +%Y%m%d).html" \
  -J "zap-api-$(date +%Y%m%d).json"
```

### Full Scan (반기 정기 점검)

```bash
# 기존 security-audit.sh --full 사용
./scripts/security-audit.sh --full
```

### 결과 해석 기준

| ZAP 등급 | 의미 | 조치 |
|---------|------|------|
| High | 심각한 취약점 | 즉시 수정 (릴리스 차단) |
| Medium | 중간 위험 | 릴리스 전 수정 권고 |
| Low | 낮은 위험 | 백로그 등록 |
| Informational | 정보성 | 검토 후 무시 가능 |

---

## D-N20.3: 의존성 보안 감사

### 실행 절차

```bash
# pnpm audit 실행
pnpm audit --audit-level=high

# JSON 리포트 생성
pnpm audit --json > reports/npm-audit-$(date +%Y%m%d).json

# 특정 취약점 무시 (개발 전용 의존성)
# .pnpmauditrc 또는 --ignore-advisories 사용
```

### 현재 상태 (2026-04-08 기준)

- HIGH 취약점: 0건 (bcrypt -> bcryptjs 마이그레이션 완료)
- MODERATE 취약점: 2건 (개발 전용 의존성, 프로덕션 무영향)

### 조치 절차

1. `pnpm audit` 실행
2. HIGH/CRITICAL 발견 시: `pnpm update {패키지}` 또는 대체 패키지 검토
3. MODERATE 이하: 개발 전용 여부 확인 후 백로그 등록
4. 결과를 audit-report-template.md에 기록

---

## D-N20.4: 보안 점검 결과 보고서 템플릿

### 표준 양식 (CSAP D-12 감리 증적)

```markdown
# 보안 점검 결과 보고서

| 항목 | 내용 |
|------|------|
| 점검 일시 | YYYY-MM-DD HH:MM |
| 점검 대상 | 공공기관 SaaS 프레임워크 v{버전} |
| 점검 도구 | Trivy {버전}, OWASP ZAP {버전}, pnpm audit |
| 점검자 | {이름} |

## 1. 취약점 점검 결과 요약

| 도구 | CRITICAL | HIGH | MEDIUM | LOW | 총계 |
|------|----------|------|--------|-----|------|
| Trivy FS | 0 | 0 | N | N | N |
| Trivy Image | 0 | 0 | N | N | N |
| OWASP ZAP | 0 | 0 | N | N | N |
| pnpm audit | 0 | 0 | N | N | N |

## 2. 상세 결과
...

## 3. 조치 계획
...

## 4. CSAP D-12 매핑
| D-12 항목 | 점검 결과 | 증적 |
|-----------|---------|------|
| D-12-01 | PASS/FAIL | {보고서 파일} |
```

---

## D-N20.5: CI/CD 보안 파이프라인

### Gitea Actions 보안 스테이지

```yaml
# .gitea/workflows/security.yml
name: Security Scan
on:
  push:
    branches: [stg, main]
  schedule:
    - cron: '0 3 * * 1'  # 매주 월요일 03:00

jobs:
  trivy-scan:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4
      - name: Trivy FS Scan
        run: trivy fs --severity HIGH,CRITICAL --exit-code 1 .

  npm-audit:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4
      - name: pnpm audit
        run: pnpm audit --audit-level=high

  zap-baseline:
    runs-on: self-hosted
    needs: [trivy-scan, npm-audit]
    if: github.ref == 'refs/heads/main'
    steps:
      - name: ZAP Baseline
        run: |
          docker run --rm ghcr.io/zaproxy/zaproxy:stable \
            zap-baseline.py -t http://host.docker.internal:4000 -l WARN
```

---

## Session Guide (구현 순서)

1. docs/security/ 디렉토리 확인 (기존 파일 확인)
2. FR-N20.1: trivy-image-scan-guide.md 작성
3. FR-N20.2: owasp-zap-dast-guide.md 작성
4. FR-N20.3: dependency-audit-guide.md 작성
5. FR-N20.4: audit-report-template.md 작성
6. FR-N20.5: cicd-security-pipeline.md 작성

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 초안 작성 | PM Lead Agent (Opus) |
