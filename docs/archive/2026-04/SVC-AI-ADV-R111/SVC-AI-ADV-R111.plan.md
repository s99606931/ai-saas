# SVC-AI-ADV-R111 — AI i18n Automation

> 작성일: 2026-04-12 | 버전: 1.0.0 | 작성자: Implementer
> 세션: #트랙B (R106~R113)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 코드베이스 i18n 키 자동 추출 + 번역 자동 생성 (결정적 규칙 기반) |
| 품질 | 키 추출 정확도 100%, 누락 번역 탐지 완전성 |
| 보안 | PII 포함 번역 문자열 마스킹, C/S 등급 콘텐츠 AI 전송 금지 |
| 비용 | 패턴 매칭 기반, 외부 API 없음 |

## Context Anchor

- **WHY**: 공공기관 다국어 서비스 요건(한국어 + 영어 필수)에서 수동 i18n 키 관리는 누락 및 불일치 발생
- **WHO**: 프론트엔드 개발자, 번역 담당자
- **RISK**: i18n 키 누락으로 런타임 오류, 번역 일관성 훼손
- **SUCCESS**: 코드 스캔 → 키 추출 → 누락 번역 식별 → 번역 제안 완결
- **SCOPE**: In — i18n 키 추출, 누락 탐지, 번역 제안 생성. Out — 실제 번역 파일 자동 업데이트, LLM 번역.

## 요구사항

- **FR-R111.1**: `extractKeys(code, pattern)` — 코드에서 i18n 키 추출
- **FR-R111.2**: `findMissingTranslations(keys, translations)` — 번역 누락 키 탐지
- **FR-R111.3**: `suggestTranslation(key, locale)` — 규칙 기반 번역 제안
- **FR-R111.4**: `mergeTranslations(base, additions)` — 번역 파일 병합
- **FR-R111.5**: `getAuditLog()` — 추출/병합 이력 조회 (CSAP D-06)
- **NFR-R111.1**: TypeScript strict 0 에러, 테스트 6개+
- **NFR-R111.2**: 1000개 키 처리 10ms 이내
- **CSAP D-06**: 감사 로그 append-only
- **N2SF N-05**: 번역 콘텐츠 외부 전송 시 O등급만 허용

## 추적성 매트릭스

| FR ID | 구현 파일 | 테스트 | CSAP |
|-------|-----------|--------|------|
| FR-R111.1~4 | ai-i18n-automation.ts | .test.ts | - |
| FR-R111.5 | getAuditLog() | test | D-06 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 최초 작성 | Implementer |
