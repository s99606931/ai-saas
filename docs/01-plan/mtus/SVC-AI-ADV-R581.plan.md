# SVC-AI-ADV-R581 Plan — AI기반 서비스 보안 태세 자동 평가 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 서비스 보안 태세 자동 평가로 CSAP 준수 지원 |
| WHO | 보안 담당자 |
| RISK | N2SF C/S 등급 데이터 외부 전송 금지 |
| SUCCESS | 서비스 등록, 보안 항목 점검, 보안 점수 산출 |
| SCOPE | security-posture-assessor-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R581.1 | 서비스 등록 (serviceId, name, tier) |
| FR-R581.2 | 보안 점검 기록 (serviceId, checkId, category, passed, dataGrade?) — C/S 차단 |
| FR-R581.3 | 보안 점수 반환 = passedChecks / totalChecks * 100 |
| FR-R581.4 | 취약 서비스 목록 반환 (점수 < 70) |
| FR-R581.5 | 감사 로그 getAuditLog() |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
