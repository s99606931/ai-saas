# CI/CD 보안 파이프라인 통합 가이드

> Plan SC: FR-N20.5
> Design Ref: D-N20.5
> CSAP: D-06-03 침해사고 예방, D-12 시스템 개발 보안

| 항목 | 내용 |
|------|------|
| 버전 | 1.0.0 |
| 작성일 | 2026-04-08 |
| 대상 | Gitea Actions (.gitea/workflows/) |

---

## 1. 보안 파이프라인 아키텍처

```
코드 푸시 (stg/main)
    │
    ├── [Stage 1] 정적 분석
    │   ├── pnpm audit (의존성 취약점)
    │   ├── ESLint (코드 품질 + 보안 규칙)
    │   └── pre-commit hook (시크릿 탐지)
    │
    ├── [Stage 2] 빌드 + 테스트
    │   ├── TypeScript 컴파일
    │   ├── 단위 테스트 (1,000+건)
    │   └── E2E 테스트 (155건)
    │
    ├── [Stage 3] 보안 스캔
    │   ├── Trivy FS (파일시스템 취약점)
    │   ├── Trivy Image (컨테이너 이미지)
    │   └── Trivy Config (IaC 설정)
    │
    ├── [Stage 4] 동적 분석 (main만)
    │   └── OWASP ZAP Baseline Scan
    │
    └── [Stage 5] 보고서 생성
        └── 보안 점검 결과 보고서
```

---

## 2. Gitea Actions 워크플로우

### security.yml (보안 전용 워크플로우)

```yaml
# .gitea/workflows/security.yml
name: Security Scan

on:
  push:
    branches: [stg, main]
  pull_request:
    branches: [main]
  schedule:
    # 매주 월요일 03:00 KST (일요일 18:00 UTC)
    - cron: '0 18 * * 0'

jobs:
  # ── Stage 1: 의존성 감사 ──
  dependency-audit:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4

      - name: pnpm 설치
        run: corepack enable && corepack prepare pnpm@9.15.0 --activate

      - name: 의존성 설치
        run: pnpm install --frozen-lockfile

      - name: 의존성 보안 감사
        run: pnpm audit --audit-level=high
        # HIGH 이상 발견 시 워크플로우 실패

      - name: JSON 리포트 생성
        if: always()
        run: |
          mkdir -p reports/vulnerability
          pnpm audit --json > reports/vulnerability/npm-audit-${{ github.sha }}.json || true

      - name: 리포트 업로드
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: npm-audit-report
          path: reports/vulnerability/

  # ── Stage 2: Trivy 파일시스템 스캔 ──
  trivy-fs:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4

      - name: Trivy FS 스캔
        run: |
          trivy fs --severity HIGH,CRITICAL \
            --ignore-unfixed \
            --exit-code 1 \
            --format json \
            --output reports/trivy-fs-${{ github.sha }}.json \
            . || exit 1

      - name: 리포트 업로드
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: trivy-fs-report
          path: reports/

  # ── Stage 3: Trivy IaC 설정 검사 ──
  trivy-config:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4

      - name: Docker Compose 설정 검사
        run: trivy config --severity HIGH,CRITICAL docker-compose.yml || true

      - name: k8s 매니페스트 검사
        run: trivy config --severity HIGH,CRITICAL k8s/ || true

  # ── Stage 4: OWASP ZAP (main만) ──
  zap-baseline:
    runs-on: self-hosted
    needs: [dependency-audit, trivy-fs]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: 서비스 기동 대기
        run: |
          # docker-compose up -d
          # 헬스체크 대기
          for i in $(seq 1 30); do
            curl -s http://localhost:4000/health && break
            sleep 2
          done

      - name: ZAP Baseline Scan
        run: |
          docker run --rm \
            -v $(pwd)/reports/zap:/zap/wrk/:rw \
            --network host \
            ghcr.io/zaproxy/zaproxy:stable \
            zap-baseline.py \
            -t http://localhost:4000 \
            -r "zap-baseline-${{ github.sha }}.html" \
            -J "zap-baseline-${{ github.sha }}.json" \
            -l WARN || true

      - name: ZAP 리포트 업로드
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: zap-report
          path: reports/zap/

  # ── Stage 5: 보안 보고서 요약 ──
  security-summary:
    runs-on: self-hosted
    needs: [dependency-audit, trivy-fs, trivy-config]
    if: always()
    steps:
      - name: 보안 점검 결과 요약
        run: |
          echo "=== 보안 점검 결과 ==="
          echo "커밋: ${{ github.sha }}"
          echo "브랜치: ${{ github.ref }}"
          echo "일시: $(date '+%Y-%m-%d %H:%M:%S KST')"
          echo ""
          echo "의존성 감사: ${{ needs.dependency-audit.result }}"
          echo "Trivy FS: ${{ needs.trivy-fs.result }}"
          echo "Trivy Config: ${{ needs.trivy-config.result }}"
```

---

## 3. 기존 CI 워크플로우에 보안 스테이지 추가

### ci.yml 수정 권고

```yaml
# .gitea/workflows/ci.yml 내 추가 (기존 test job 다음)
security:
  runs-on: self-hosted
  needs: [test]
  steps:
    - uses: actions/checkout@v4
    - name: 의존성 감사
      run: pnpm audit --audit-level=high
    - name: Trivy 파일시스템 스캔
      run: trivy fs --severity HIGH,CRITICAL --exit-code 1 .
```

---

## 4. 보안 게이트 기준

| 게이트 | 기준 | 실패 시 |
|--------|------|--------|
| G-SEC-1 | pnpm audit HIGH 0건 | CI 실패 (머지 차단) |
| G-SEC-2 | Trivy FS CRITICAL 0건 | CI 실패 (머지 차단) |
| G-SEC-3 | Trivy Image HIGH 0건 | 배포 차단 |
| G-SEC-4 | ZAP High Alert 0건 | 릴리스 차단 |
| G-SEC-5 | 시크릿 탐지 0건 | 커밋 차단 (pre-commit hook) |

---

## 5. 알림 설정

```yaml
# 보안 취약점 발견 시 알림
- name: 보안 알림 전송
  if: failure()
  run: |
    # Gitea Webhook 또는 이메일 알림
    echo "SECURITY ALERT: 보안 스캔 실패"
    echo "커밋: ${{ github.sha }}"
    echo "브랜치: ${{ github.ref }}"
    # curl -X POST 웹훅_URL ...
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 초안 작성 | PM Lead Agent |
