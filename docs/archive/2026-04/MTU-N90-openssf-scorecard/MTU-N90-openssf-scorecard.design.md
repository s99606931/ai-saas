# MTU-N90: OpenSSF Scorecard 보안 점수카드 자동화 — Design

> **MTU ID**: MTU-N90
> **Plan 참조**: docs/01-plan/mtus/MTU-N90-openssf-scorecard.plan.md
> **작성일**: 2026-04-10

---

## Design Anchor

| 항목 | 내용 |
|------|------|
| 목표 | OpenSSF Scorecard 18개 보안 검사 자동화 + 점수 가시화 |
| 제약 | 에어갭 환경 고려 (로컬 Scorecard 실행), Gitea API 호환 |
| 기술 스택 | OpenSSF Scorecard CLI, Gitea Actions, jq, Grafana |

## 1. Scorecard 워크플로우 설계

```yaml
# .gitea/workflows/scorecard.yaml
name: OpenSSF Scorecard
on:
  schedule:
    - cron: '0 3 * * 1'  # 매주 월요일 03:00
  workflow_dispatch:

jobs:
  scorecard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Scorecard
        run: |
          scorecard --repo=local --format=json > scorecard-results.json
          score=$(jq '.score' scorecard-results.json)
          echo "OpenSSF Scorecard: $score/10"
          if [ "$(echo "$score < 5.0" | bc)" -eq 1 ]; then
            echo "::error::보안 점수 5.0 미만 — 즉시 개선 필요"
            exit 1
          fi
      - name: Archive Results
        run: |
          mkdir -p reports/scorecard
          cp scorecard-results.json reports/scorecard/$(date +%Y%m%d).json
```

## 2. 18개 검사 항목 매핑

| # | 검사 | 설명 | CSAP 매핑 |
|---|------|------|----------|
| 1 | Binary-Artifacts | 바이너리 파일 존재 여부 | D-05 |
| 2 | Branch-Protection | 브랜치 보호 규칙 | D-12 |
| 3 | CI-Tests | CI 테스트 존재 여부 | D-12 |
| 4 | CII-Best-Practices | CII 모범 사례 | D-12 |
| 5 | Code-Review | 코드 리뷰 수행 여부 | D-12 |
| 6 | Contributors | 다수 기여자 존재 | D-01 |
| 7 | Dangerous-Workflow | 위험한 워크플로우 패턴 | D-12 |
| 8 | Dependency-Update-Tool | 의존성 업데이트 도구 (Renovate) | D-05 |
| 9 | Fuzzing | 퍼징 테스트 수행 | D-12 |
| 10 | License | 라이선스 명시 | D-04 |
| 11 | Maintained | 프로젝트 활성 유지 | D-01 |
| 12 | Packaging | 패키지 배포 | D-05 |
| 13 | Pinned-Dependencies | 의존성 버전 고정 | D-05 |
| 14 | SAST | 정적 분석 수행 | D-12 |
| 15 | Security-Policy | 보안 정책 문서 | D-01 |
| 16 | Signed-Releases | 릴리스 서명 | D-09 |
| 17 | Token-Permissions | 토큰 최소 권한 | D-08 |
| 18 | Vulnerabilities | 알려진 취약점 | D-05 |

## 3. 점수 파싱 스크립트 설계

```bash
#!/bin/bash
# scorecard-parse.sh — OpenSSF Scorecard 결과 파싱
RESULT_FILE="${1:-scorecard-results.json}"
THRESHOLD="${2:-7.0}"

total_score=$(jq '.score' "$RESULT_FILE")
checks_passed=$(jq '[.checks[] | select(.score >= 7)] | length' "$RESULT_FILE")
checks_total=$(jq '.checks | length' "$RESULT_FILE")

echo "총점: $total_score/10"
echo "통과 검사: $checks_passed/$checks_total"

# 실패 항목 출력
jq -r '.checks[] | select(.score < 7) | "\(.name): \(.score)/10 - \(.reason)"' "$RESULT_FILE"
```

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 설계 | PM Agent |
