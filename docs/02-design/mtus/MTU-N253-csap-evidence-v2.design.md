# MTU-N253: CSAP 증거 수집 자동화 v2 설계서

> **Plan 참조**: MTU-N253.plan.md

## 설계 요약

기존 `csap-evidence-collect.sh`(MTU-N84)를 대폭 강화하여:
1. DORA Four Keys 메트릭 증거 자동 포함
2. RCA 분석 결과 증거 포함
3. SLO/SLI 현황 증거 포함
4. SHA256 해시 기반 무결성 보증
5. ZIP 패키징 + 증거 인덱스 자동 생성
6. CI/CD 주간 자동 수집

## 산출물

| # | 파일 | 설명 |
|---|------|------|
| 1 | `scripts/csap-evidence-collect-v2.sh` | CSAP 증거 수집 v2 |
| 2 | `.gitea/workflows/csap-evidence.yml` | 주간 자동 수집 워크플로우 |
| 3 | `scripts/verify-csap-evidence-v2.sh` | 검증 스크립트 |
