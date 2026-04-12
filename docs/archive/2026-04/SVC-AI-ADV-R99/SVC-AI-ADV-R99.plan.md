# SVC-AI-ADV-R99 — AutoDoc 코드 문서 자동 생성기

> 작성일: 2026-04-12 | 버전: 1.0.0

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | TypeScript 함수/클래스 AST 분석 → JSDoc 템플릿 생성 |
| 품질 | 함수 시그니처 100% 반영, 매개변수 누락 0% |
| 보안 | 코드 분석만, 외부 전송 없음 |
| 비용 | 파서 기반 규칙, LLM 옵션 |

## Context Anchor

- **WHY**: 감리 기준 문서 자동화 (행안부). 기존 api-doc-generator는 API 엔드포인트용
- **WHO**: 개발자, 감리팀
- **SUCCESS**: 함수 시그니처 입력 → JSDoc 주석 템플릿 반환
- **SCOPE**: 구조 분석 + 템플릿 생성 (AST 라이브러리 없이 regex 기반 간소화)

## 요구사항

- **FR-R99.1**: parseSignature(tsSource) — 함수 시그니처 추출
- **FR-R99.2**: generateJsDoc(signature) — JSDoc 문자열 생성
- **FR-R99.3**: 매개변수/반환 타입/설명 필드 포함
- **FR-R99.4**: generateForFile(source) — 파일 전체 함수 일괄 처리
- **FR-R99.5**: OpenAPI 경로 감지 시 summary 태그 추가
- **NFR-R99.1**: 테스트 5개+
