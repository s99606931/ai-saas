# MTU-N252: AIOps 자동 근본 원인 분석 (RCA) 완료 보고서

> **완료일**: 2026-04-11
> **매치율**: 100% (39/39)

## 산출물
| # | 파일 | 설명 |
|---|------|------|
| 1 | `infra/monitoring/rca-correlation-rules.yaml` | 상관관계 Recording Rules (6개 이상 스코어 + 5개 상관관계) |
| 2 | `infra/monitoring/rca-pattern-rules.yaml` | RCA 패턴 알림 (10개 증상→원인 매핑) |
| 3 | `infra/monitoring/dashboards/rca-analysis.json` | Grafana RCA 대시보드 (8개 패널) |
| 4 | `scripts/generate-rca-report.sh` | RCA 보고서 자동 생성 |
| 5 | `scripts/verify-aiops-rca.sh` | 검증 스크립트 |

## DORA 시너지
- MTU-N251 DORA MTTR ← MTU-N252 RCA 자동화로 감지→진단 시간 단축
- RCA 패턴 #9 "최근 배포 문제" → DORA CFR 자동 기록 연동

*보고서 생성: 2026-04-11 | PM Lead (AI)*
