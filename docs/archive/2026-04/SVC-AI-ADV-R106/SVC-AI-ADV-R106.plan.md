# SVC-AI-ADV-R106 — Conversational Form Filler

> 작성일: 2026-04-12 | 버전: 2.0.0 (재작성)
> 세션: #139 (11차 PM 세션 k)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 자연어 대화 → 공공 민원 서류 필드 자동 입력 (슬롯 추출) |
| 품질 | 필수 필드 충족 여부 판정 + 누락 항목 재질문 |
| 보안 | RRN/전화 입력 즉시 마스킹 저장, C/S 등급 입력 차단 |
| 비용 | 결정적 슬롯 필링 (LLM 없음) |

## Context Anchor

- **WHY**: 공공 민원 포털에서 고령층·장애인을 위한 대화형 민원 접수 필요
- **WHO**: 민원인, 민원처리 담당자
- **RISK**: PII 평문 저장. 필수 필드 누락된 채 접수 완료.
- **SUCCESS**: 폼 스키마 등록 → 대화 턴별 슬롯 채움 → 완성 판정 → 접수 레코드 반환
- **SCOPE**: 슬롯 추출·검증 엔진. 실제 접수 API 호출은 호출자 책임.

## 요구사항

- **FR-R106.1**: `registerForm(formId, fields)` — 민원 서류 스키마 등록
- **FR-R106.2**: `startSession(sessionId, formId)` — 대화 세션 시작
- **FR-R106.3**: `processUtterance(sessionId, text, dataGrade)` — 자연어 → 슬롯 추출
- **FR-R106.4**: `getMissingRequiredFields(sessionId)` — 누락 필수 필드 목록
- **FR-R106.5**: `finalize(sessionId)` — 완성 시 레코드 반환, 미완성 시 에러
- **NFR-R106.1**: 테스트 8개+
- **CSAP D-06**: getAuditLog() 필수
- **N2SF N-05**: C/S 등급 차단
