# SVC-AI-ADV-R470 Plan — AI기반 보안 취약점 우선순위 분류 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 다수 보안 취약점 중 우선 처리 대상을 AI로 자동 선별하여 대응 효율 향상 |
| WHO | 보안팀, DevSecOps 담당자 |
| RISK | 오분류로 인한 중요 취약점 지연 처리 방지 필요 |
| SUCCESS | SC-R470-1: 취약점 등록 / SC-R470-2: 우선순위 점수 계산 / SC-R470-3: C/S 등급 차단 |
| SCOPE | security-vuln-priority-classifier-v2.ts 구현 |

## 요구사항
- FR-R470.1: 취약점 등록 (vulnId, title, cvssScore 0-10, exploitability: public/private/none)
- FR-R470.2: 우선순위 점수 = cvssScore * 10 + exploitBonus (public:30, private:15, none:0)
- FR-R470.3: 우선순위 등급 (>=90: critical, >=70: high, >=50: medium, else low)
- FR-R470.4: 등급별 취약점 조회
- FR-R470.5: N2SF N-05 C/S 등급 차단

## 추적성
FR-R470.* ↔ `security-vuln-priority-classifier-v2.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
