# SVC-AI-ADV-R460 Plan — 기관 간 데이터 교환 AI

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 기관 간 데이터 교환 시 스키마 자동 변환·매핑 |
| WHO | 데이터기반행정과, 공공 API 게이트웨이 |
| WHAT | 원본 레코드 + 매핑 규칙 → 변환 레코드 |
| HOW | 필드 매핑 테이블 + 데이터 유형 변환 |

## Context Anchor
- WHY: 시스템 간 데이터 형식 불일치 해소
- WHO: 데이터 교환 담당자
- RISK: 필드 손실 → 손실 항목 리포트
- SUCCESS: 매핑 규칙 100% 적용
- SCOPE: `interagency-data-exchange-ai.ts`

## 요구사항
- FR-460.1: Mapping = { sourceField, targetField, type: 'string'|'number'|'date' }
- FR-460.2: record 입력 → 매핑된 필드만 변환 결과에 포함
- FR-460.3: 유형 변환 — string: String(v), number: Number(v), date: ISO string (`YYYY-MM-DD` 형식 검증)
- FR-460.4: 매핑 대상 필드 누락 시 `lostFields` 배열에 sourceField 기록
- FR-460.5: number 변환 실패(NaN) 시 변환 결과에서 제외 + lostFields 추가
- FR-460.6: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-460.* ↔ `interagency-data-exchange-ai.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
