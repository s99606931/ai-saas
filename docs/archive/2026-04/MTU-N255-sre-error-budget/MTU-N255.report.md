# MTU-N255: SRE 에러 버짓 자동 액션 + 온콜 자동화 완료 보고서

> **완료일**: 2026-04-11 | **매치율**: 100% (24/24)

## 산출물
| # | 파일 | 설명 |
|---|------|------|
| 1 | `infra/monitoring/error-budget-automation-rules.yaml` | 에러 버짓 자동화 (잔여량, 소진율, 예측, 배포 동결) |
| 2 | `infra/monitoring/oncall-escalation-rules.yaml` | 온콜 에스컬레이션 (P1/P2/P3 자동) |
| 3 | `infra/monitoring/dashboards/error-budget-automation.json` | 에러 버짓 + 온콜 대시보드 |
| 4 | `scripts/verify-sre-error-budget.sh` | 검증 스크립트 |

## DORA 연계
- 에러 버짓 소진 → DORA 게이트(N251) 연동 → 자동 배포 차단
- 온콜 에스컬레이션 → MTTR 단축 → DORA MTTR 등급 개선
- RCA(N252) 패턴 자동 링크 → 인시던트 초기 진단 시간 단축
