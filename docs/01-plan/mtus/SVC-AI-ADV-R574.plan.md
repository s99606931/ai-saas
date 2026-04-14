# SVC-AI-ADV-R574 Plan — AI기반 공공기관 서비스 성과 예측 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공기관 서비스 성과를 AI로 예측하여 선제적 개선 지원 |
| WHO | 공공기관 서비스 관리자 |
| RISK | N2SF C/S 등급 데이터 외부 전송 금지 |
| SUCCESS | 성과 예측 및 개선 권고 기능 동작 |
| SCOPE | service-performance-predictor-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R574.1 | 서비스 등록 (serviceId, name, category) |
| FR-R574.2 | 성과 기록 (serviceId, score, period, dataGrade?) — C/S 차단 |
| FR-R574.3 | 성과 예측 점수 반환 (최근 3개 평균) |
| FR-R574.4 | 저성과 서비스 목록 반환 (예측 점수 < 60) |
| FR-R574.5 | 감사 로그 getAuditLog() |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
