# SVC-AI-ADV-R262 — 레거시 문법 변환기

> 작성일: 2026-04-13 | 버전: 1.0.0 | 작성자: PM Lead (자율 생성)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | Python2→3, Java8→17 등 규칙 기반 소스코드 문법 변환 + 변환 내역 보고 |
| 품질 | 결정론적 정규식 변환, 테스트 12개+ |
| 보안 | C/S 차단, 하드코딩 시크릿 탐지, CSAP D-06 감사 로그 |
| 비용 | 로컬 변환 |

## Context Anchor

- **WHY**: 공공기관 레거시 시스템 Python2/Java8 다수 잔존 → 현대화 필요
- **WHO**: 애플리케이션 현대화팀, 시스템 운영자
- **RISK**: 잘못된 변환 → 서비스 중단
- **SUCCESS**: 소스 입력 → 변환 규칙 적용 → 변환 보고서 + 경고
- **SCOPE**: In — 구문 패턴 치환. Out — 의미 분석(컴파일/AST)

## 요구사항

- **FR-R262.1**: 지원 언어 등록 (PYTHON2_TO_3, JAVA8_TO_17)
- **FR-R262.2**: Python2→3 규칙
  - `print foo` → `print(foo)`
  - `xrange(` → `range(`
  - `raw_input(` → `input(`
  - `.iteritems()` → `.items()`
  - `has_key(k)` → `in` 경고
- **FR-R262.3**: Java8→17 규칙
  - `new ArrayList<Integer>()` → `new ArrayList<>()` (다이아몬드)
  - `com.sun.` → deprecated 경고
  - `String.format("%s", x)` 유지 (경고만)
  - `var` 키워드 도입 권고 (경고)
- **FR-R262.4**: 변환 실행 (transform: source → { transformed, changes[], warnings[] })
- **FR-R262.5**: 하드코딩 시크릿 패턴 탐지 시 BLOCKED
- **FR-R262.6**: 통계 조회 (언어별 변환 건수)
- **FR-R262.7**: C/S 차단, caller 마스킹, CSAP D-06 감사 로그, getAuditLog()
- **NFR-R262.1**: TypeScript strict, 테스트 12개+

## 추적성 매트릭스

| FR ID | 구현 | 테스트 | CSAP |
|-------|------|--------|------|
| FR-R262.1~7 | legacy-syntax-transformer.ts | .test.ts | D-06, D-12 |
