# SVC-AI-ADV-R96 — AI 테스트 오라클 (Test Oracle)

> 작성일: 2026-04-12 | 버전: 1.0.0

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 예상 출력 없이 출력 정합성 자동 판단 (속성 기반 + LLM) |
| 품질 | 거짓양성률 < 10% |
| 보안 | 테스트 데이터는 O등급 전용 |
| 비용 | 속성 검사 먼저, 실패 시에만 LLM |

## Context Anchor

- **WHY**: 공공 SaaS는 케이스가 많아 정답 레이블 확보 어려움
- **WHO**: QA, 개발팀
- **SUCCESS**: 입력/출력/문맥으로 PASS/FAIL/UNCERTAIN 판정
- **SCOPE**: 오라클 엔진 단일

## 요구사항

- **FR-R96.1**: evaluate(input, output, contract) → Judgement
- **FR-R96.2**: Contract 타입: 'schema' | 'invariant' | 'semantic'
- **FR-R96.3**: schema 검사 (타입/키/범위)
- **FR-R96.4**: invariant 검사 (사용자 정의 함수)
- **FR-R96.5**: semantic 검사 (LLM 폴백)
- **NFR-R96.1**: 테스트 5개+
