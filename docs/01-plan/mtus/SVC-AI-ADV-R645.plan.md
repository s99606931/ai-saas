# SVC-AI-ADV-R645 Plan — AI기반 장애 대응 플레이북 자동 생성 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공기관 SaaS 플랫폼 AI 고도화 (트랙 B 23차) |
| WHO | 공공기관 SRE/장애 대응 담당자 |
| RISK | N2SF C/S 등급 데이터 외부 전송 금지 |
| SUCCESS | FR-R645.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/incident-playbook-generator-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R645.1 | 장애 유형 등록 (incidentType, severity) |
| FR-R645.2 | 플레이북 단계 추가 (dataGrade? C/S 차단) |
| FR-R645.3 | 유형별 총 단계 수 산출 |
| FR-R645.4 | 단계 부족(< threshold) 유형 목록 반환 |
| FR-R645.5 | 감사 로그 getAuditLog() |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
