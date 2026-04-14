# SVC-AI-ADV-R657 Plan — AI기반 컨테이너 보안 분석 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 컨테이너 이미지 취약점 + 런타임 이상 행위 통합 분석 |
| WHO | 보안 운영팀, DevSecOps |
| RISK | 이미지/CVE 메타데이터 N2SF 등급 분류 필수 |
| SUCCESS | FR-R657.1~6 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/container-security-ai-v3.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R657.1 | 이미지 등록 (imageId, layers, vulnerabilities, dataGrade) — C/S 차단 |
| FR-R657.2 | 런타임 이상 행위 등록 (syscall, processName) |
| FR-R657.3 | 위험도 산출 (CRITICAL/HIGH/MEDIUM/LOW) |
| FR-R657.4 | 권고 액션 (BLOCK/QUARANTINE/MONITOR/ALLOW) |
| FR-R657.5 | 통계 조회 (총 이미지 수, 위험도별 수) |
| FR-R657.6 | getAuditLog() append-only 감사 로그 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
