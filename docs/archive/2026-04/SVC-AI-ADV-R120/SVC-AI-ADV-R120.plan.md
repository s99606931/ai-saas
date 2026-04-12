# SVC-AI-ADV-R120 — Document Intelligence Pipeline

> 작성일: 2026-04-12 | 버전: 1.0.0 | 작성자: PM Lead
> 원 요청 번호: R120

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 문서 OCR → 분류 → 엔티티 추출 → 구조화 end-to-end 파이프라인 |
| 품질 | 단계별 신뢰도 점수 + 단계 실패 시 스킵·재시도 |
| 보안 | 문서 등급 guard, PII 마스킹, 처리 단계별 감사 |
| 비용 | 스테이지 pluggable, 로컬 우선, 캐시 활용 |

## Context Anchor

- **WHY**: 공공 민원/증빙 문서는 OCR → 분류(민원 종류) → 엔티티(신청자·법령·금액) → 구조화 JSON 순서로 처리되는데, 기존 모듈들이 분산되어 흐름 관리가 어려움
- **WHO**: 민원 자동처리, 증빙 검증, 서식 자동입력
- **RISK**: 단계별 실패 시 전체 중단 → 파이프라인 단계 스킵·부분 결과 반환
- **SUCCESS**: Stage 인터페이스 기반 파이프라인 구축, 각 단계 신뢰도 추적, 결과 구조화
- **SCOPE**: In — 파이프라인 오케스트레이션·스테이지 추상화. Out — 실제 OCR/LLM(외부 주입)

## 요구사항

- **FR-R120.1**: Stage 인터페이스 (input → output + confidence)
- **FR-R120.2**: 기본 스테이지: OCR, Classify, Extract, Structure
- **FR-R120.3**: 파이프라인 실행 + 중간 결과 누적
- **FR-R120.4**: 단계 실패 시 스킵/재시도 옵션
- **FR-R120.5**: 최종 결과 `DocumentPackage` (원문·분류·엔티티·구조화 JSON)
- **FR-R120.6**: N2SF 등급 guard
- **FR-R120.7**: PII 자동 마스킹 (구조화 결과)
- **FR-R120.8**: `getAuditLog()` 필수
- **NFR-R120.1**: TypeScript strict 0, 테스트 80%+

## 추적성 매트릭스

| FR ID | 구현 | 테스트 | CSAP |
|-------|------|--------|------|
| FR-R120.1~5 | document-intelligence-pipeline.ts | .test.ts | - |
| FR-R120.6 | grade guard | test | N2SF N-05 |
| FR-R120.7 | PII mask | test | D-09 |
| FR-R120.8 | auditLog | test | D-06 |
