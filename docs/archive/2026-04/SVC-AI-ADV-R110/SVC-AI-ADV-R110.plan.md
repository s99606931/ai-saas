# SVC-AI-ADV-R110 — Data Policy Enforcer

> 작성일: 2026-04-12 | 버전: 1.0.0 | 작성자: Implementer
> 세션: #트랙B (R106~R113)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 코드/쿼리 스캔 → 데이터 정책 위반 탐지 → 수정 제안 자동 생성 |
| 품질 | 정책 규칙 100% 검사, 수정 제안 정확도 90%+ |
| 보안 | N2SF 데이터 등급 인식, C/S 등급 코드 분석 결과 외부 전송 금지 |
| 비용 | 규칙 기반 정적 분석, LLM 없음 |

## Context Anchor

- **WHY**: 공공기관 데이터 관리 정책(개인정보보호법, CSAP D-12) 위반이 코드 레벨에서 발생하나 수동 검토만으로는 한계
- **WHO**: 개발자, 보안 담당자, 감리관
- **RISK**: 정책 위반 패턴 미탐지, 수정 제안 오탐으로 인한 혼란
- **SUCCESS**: 정책 등록 → 코드 스캔 → 위반 목록 + 수정 제안 반환 완결
- **SCOPE**: In — 규칙 기반 정적 패턴 매칭, 수정 제안 생성. Out — 자동 코드 수정 적용, 빌드 통합.

## 요구사항

- **FR-R110.1**: `registerPolicy(policy)` — 데이터 정책 규칙 등록 (정규식 패턴 + 심각도)
- **FR-R110.2**: `scanCode(code, language)` — 코드 문자열 스캔 → 위반 목록 반환
- **FR-R110.3**: `suggestFix(violation)` — 개별 위반에 대한 수정 제안 생성
- **FR-R110.4**: `scanAndFix(code, language)` — 스캔 + 수정 제안 일괄 처리
- **FR-R110.5**: `getAuditLog()` — 스캔 이력 조회 (CSAP D-06)
- **NFR-R110.1**: TypeScript strict 0 에러, 테스트 6개+
- **NFR-R110.2**: CSAP D-12 개발 보안 준수
- **CSAP D-06**: 감사 로그 append-only
- **N2SF N-05**: 스캔 대상 코드 외부 AI 전송 금지

## 추적성 매트릭스

| FR ID | 구현 파일 | 테스트 | CSAP |
|-------|-----------|--------|------|
| FR-R110.1~4 | data-policy-enforcer.ts | .test.ts | D-12 |
| FR-R110.5 | getAuditLog() | test | D-06 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 최초 작성 | Implementer |
