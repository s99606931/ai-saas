# SVC-AI-ADV-R640 Plan — AI기반 공문서 요약 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공기관 SaaS 플랫폼 AI 고도화 (트랙 B 23차) |
| WHO | 공공기관 문서 담당자 |
| RISK | N2SF C/S 등급 데이터 외부 전송 금지 |
| SUCCESS | FR-R640.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/document-summarizer-ai-v3.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R640.1 | 문서 등록 (docId, title) |
| FR-R640.2 | 본문 저장 및 요약 요청 (dataGrade? C/S 차단) |
| FR-R640.3 | 요약 길이 비율(summary/original) 산출 |
| FR-R640.4 | 긴 문서(초과 길이) 목록 반환 |
| FR-R640.5 | 감사 로그 getAuditLog() |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
