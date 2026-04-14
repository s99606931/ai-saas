# SVC-AI-ADV-R582 Plan — AI기반 공공기관 민원 자동 라우팅 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 민원 자동 분류 및 담당 부서 라우팅으로 처리 속도 향상 |
| WHO | 민원 처리 담당자 |
| RISK | N2SF C/S 등급 데이터 외부 전송 금지; PII(citizenId) 마스킹 |
| SUCCESS | 민원 등록, 부서 라우팅, 처리 현황 조회 |
| SCOPE | complaint-auto-router-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R582.1 | 부서 등록 (deptId, name, categories[]) |
| FR-R582.2 | 민원 접수 (complaintId, citizenId, category, dataGrade?) — C/S 차단, citizenId SHA-256 마스킹 |
| FR-R582.3 | 민원 라우팅 (category 기반 부서 매핑) |
| FR-R582.4 | 미처리 민원 목록 반환 |
| FR-R582.5 | 감사 로그 getAuditLog() |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
