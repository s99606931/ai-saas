# SVC-AI-ADV-R570 Plan — AI기반 자동 보안 취약점 스캐닝 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 보안 취약점을 자동 탐지·분류하여 패치 우선순위 신속 결정 |
| WHO | 보안 운영팀, 취약점 관리자 |
| RISK | 오탐으로 인한 불필요한 패치 작업 방지 |
| SUCCESS | SC-R570-1: 취약점 수집 / SC-R570-2: 심각도 분류 / SC-R570-3: 패치 우선순위 |
| SCOPE | security-vulnerability-scanner-v3.ts 구현 |

## 요구사항
- FR-R570.1: 입력 (scanId, targetSystem, vulnerabilities: {cveId, cvssScore, isExploited, affectedComponent}[])
- FR-R570.2: 각 취약점 심각도 (cvssScore>=9: CRITICAL, >=7: HIGH, >=4: MEDIUM, else LOW)
- FR-R570.3: 즉시 패치 대상 = isExploited===true || cvssScore>=9
- FR-R570.4: 위험 요약 (criticalCount, highCount, immediatePatches: cveId 목록)
- FR-R570.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R570.* ↔ `security-vulnerability-scanner-v3.ts` ↔ 테스트 ↔ CSAP D-06, D-12
