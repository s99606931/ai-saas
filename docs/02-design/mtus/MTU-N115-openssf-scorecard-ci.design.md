# MTU-N115: OpenSSF Scorecard CI 자동화 — 설계 문서

> 버전: 1.0.0 | 작성일: 2026-04-10
> Plan 참조: docs/01-plan/mtus/MTU-N115-openssf-scorecard-ci.plan.md

## Design Anchor

| 항목 | 내용 |
|------|------|
| 패턴 | Gitea Actions 워크플로우 + 셸 스크립트 기반 PR 게이트 |
| 핵심 결정 | scorecard CLI 로컬 실행, SARIF 출력, PR 코멘트 자동화 |
| 의존성 | 기존 scorecard 설정 (MTU-N90), Gitea Actions (기 구축) |

## 상세 설계

### DS-N115.1: Gitea Actions 워크플로우

```yaml
# .gitea/workflows/scorecard-ci.yaml
name: OpenSSF Scorecard CI
on:
  pull_request:
    branches: [main, stg]
  schedule:
    - cron: '0 3 * * 1'
```

### DS-N115.2: PR 차단 스크립트

```bash
# scripts/scorecard-gate.sh
# 점수 < 5.0 → exit 1 (PR 머지 차단)
# 점수 < 7.0 → WARNING
# 점수 >= 7.0 → PASS
```

### DS-N115.3: PR 코멘트 형식

```markdown
## OpenSSF Scorecard 결과
| 항목 | 점수 | 상태 |
|------|------|------|
| Branch-Protection | 8/10 | PASS |
...
총점: 7.2/10
```

### DS-N115.4: 보안 개선 제안

항목별 실패 시 자동 가이드 생성:
- Branch-Protection 실패 → "main 브랜치 보호 규칙 설정 필요"
- Pinned-Dependencies 실패 → "의존성 버전 고정 필요"
