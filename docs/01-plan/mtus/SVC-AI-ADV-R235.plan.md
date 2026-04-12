# SVC-AI-ADV-R235 Plan: AI기반 자동 보안 감사 보고서 생성

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | CSAP 보안 감사 자동화로 인력 절감 및 정확도 향상 |
| WHO | 보안 담당자, 감리관 |
| RISK | 발견사항 미집계 시 감사 누락 |
| SUCCESS | 심각도별 점수 산출 + criticalIssues 목록 |
| SCOPE | ai-service 내 AutoSecurityAuditReporter 클래스 |

## 요구사항
- FR-R235.1: CRITICAL×20 + HIGH×10 + MEDIUM×5 + LOW×2 감점
- FR-R235.2: complianceScore = max(0, 100 - 감점)
- FR-R235.3: criticalIssues 목록 제공
- FR-R235.4: CSAP D-06 감사 로그
