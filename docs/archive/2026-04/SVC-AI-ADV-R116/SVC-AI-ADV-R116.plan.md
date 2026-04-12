# SVC-AI-ADV-R116 — Streaming Response Assembler

> 작성일: 2026-04-12 | 버전: 1.0.0 | 작성자: PM Lead
> 원 요청 번호: R111 (충돌로 재배정)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | LLM 스트리밍 토큰을 JSON/Markdown 구조화 응답으로 실시간 조립 |
| 품질 | 조립 오류율 0.1% 이하, 부분 파싱 성공 |
| 보안 | 토큰에 민감정보 포함 시 실시간 마스킹 |
| 비용 | 스트리밍 기반 저지연 |

## Context Anchor

- **WHY**: 스트리밍 LLM은 토큰 단위 출력이라 구조화 응답 파싱 어려움 → 부분 완성 단계에서도 사용자가 결과 확인 필요
- **WHO**: AI Chat UI, 실시간 폼 채움, 대시보드 생성
- **RISK**: 불완전 JSON으로 파싱 실패 → 점진적 파서 + fallback 스트림
- **SUCCESS**: 토큰이 누적될수록 구조 검증 + 부분 결과 이벤트 발행
- **SCOPE**: In — 토큰 입력, 부분 파싱, 이벤트 발행, 최종 검증. Out — LLM 호출, UI 렌더링

## 요구사항

- **FR-R116.1**: 토큰 append API (feed)
- **FR-R116.2**: 점진적 JSON 파싱 (불완전 허용)
- **FR-R116.3**: 부분 결과 이벤트 (onPartial)
- **FR-R116.4**: 최종 검증 (onComplete with Zod schema)
- **FR-R116.5**: 오류 복구 — 재동기화 가능 지점 탐색
- **FR-R116.6**: PII 실시간 마스킹 — 이메일/주민번호 패턴 탐지 시 즉시 치환
- **FR-R116.7**: N2SF 등급 guard
- **FR-R116.8**: `getAuditLog()` 필수
- **NFR-R116.1**: TypeScript strict 0, 테스트 80%+
- **NFR-R116.2**: 1000 토큰/초 처리

## 추적성 매트릭스

| FR ID | 구현 | 테스트 | CSAP |
|-------|------|--------|------|
| FR-R116.1~5 | streaming-response-assembler.ts | .test.ts | - |
| FR-R116.6 | PII mask | test | D-09 |
| FR-R116.7 | guard | test | N2SF |
| FR-R116.8 | auditLog | test | D-06 |
