# MTU-N253: CSAP 증거 수집 자동화 v2 완료 보고서

> **완료일**: 2026-04-11 | **매치율**: 96.5% (28/29 + 1 WARN)

## 산출물
| # | 파일 | 설명 |
|---|------|------|
| 1 | `scripts/csap-evidence-collect-v2.sh` | CSAP 증거 수집 v2 (DORA+RCA+SLO 포함, SHA256 무결성) |
| 2 | `.gitea/workflows/csap-evidence.yml` | 주간 자동 수집 CI/CD 워크플로우 |
| 3 | `scripts/verify-csap-evidence-v2.sh` | 검증 스크립트 |

## v1 대비 개선
- DORA Four Keys 메트릭 자동 수집 (MTU-N251 연동)
- RCA 분석 결과 자동 수집 (MTU-N252 연동)
- SHA256 무결성 매니페스트
- ZIP 패키징 + 증거 인덱스
- CI/CD 주간 자동 실행

*보고서 생성: 2026-04-11*
