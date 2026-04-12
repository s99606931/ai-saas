# SVC-AI-ADV-R150 — 실시간 번역 스트리밍

> 작성일: 2026-04-12 | 버전: 1.0.0 | 작성자: Implementer (트랙 B 3차)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | SSE 기반 실시간 스트리밍 번역 (청크 단위 순차 배달) |
| 품질 | 문장 단위 청크 분리, 번역 진행률 추적 |
| 보안 | N2SF N-05 C/S 등급 차단, PII 마스킹 |
| 비용 | 모의 번역 엔진 (실제 LLM 없음) |

## Context Anchor

- **WHY**: 공공기관 국제 업무에서 긴 문서 번역 시 결과 대기 시간이 길어 UX 저하.
- **WHO**: 국제협력 담당자, 다국어 서비스 운영자
- **RISK**: 스트리밍 중단 시 부분 번역만 제공
- **SUCCESS**: 번역 요청 → 청크 생성 → AsyncIterable 스트림 반환
- **SCOPE**: In — 청크 분리, 스트림 생성, 진행률 추적. Out — 실제 LLM 번역.

## 요구사항

- **FR-R150.1**: `translate(text, fromLocale, toLocale, dataGrade)` — 스트리밍 번역 시작
- **FR-R150.2**: `getChunks(text)` — 텍스트를 문장 단위 청크로 분리
- **FR-R150.3**: `streamTranslation(chunks)` — AsyncIterable 청크 스트림 반환
- **FR-R150.4**: `getAuditLog()` — 번역 이력 (CSAP D-06)
- **NFR-R150.1**: TypeScript strict 0 에러, 테스트 5개+
- **N2SF N-05**: C/S 등급 차단

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 최초 작성 | Implementer |
