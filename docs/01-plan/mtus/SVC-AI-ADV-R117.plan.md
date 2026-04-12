# SVC-AI-ADV-R117 — Cross-Lingual AI Bridge

> 작성일: 2026-04-12 | 버전: 1.0.0 | 작성자: PM Lead
> 원 요청 번호: R112 (충돌로 재배정)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 한국어 ↔ 다국어(영/중/일) AI 응답 자동 변환 + 공공기관 전용 용어 보존 |
| 품질 | 용어 보존율 99%+, 번역 정확도 BLEU 0.7+ |
| 보안 | 번역 원문 AI 전송 전 N2SF 등급 검사, C/S 차단 |
| 비용 | 용어 사전 로컬 캐시 + 로컬 LLM 우선 |

## Context Anchor

- **WHY**: 공공기관 다국어 민원/문서 응대 시 고유명사(부처명/법령명) 오역이 빈번 → 용어 사전 기반 후처리 필요
- **WHO**: 다국어 포털, 민원 챗봇, 국제 협력 문서
- **RISK**: 오역으로 법적 의미 변형 → 용어 사전 강제 적용 + 원문 병기
- **SUCCESS**: 번역 후 공공기관 표준 용어 자동 치환, 원문 링크 포함
- **SCOPE**: In — 번역 요청, 용어 보존, 방향 감지. Out — 실제 번역 모델(외부 위임)

## 요구사항

- **FR-R117.1**: 언어 감지 (ko/en/zh/ja)
- **FR-R117.2**: 번역 방향 자동 결정
- **FR-R117.3**: 공공기관 용어 사전 로드 + 후처리 치환
- **FR-R117.4**: 원문 병기 옵션 (dual-text)
- **FR-R117.5**: 번역 품질 점수 반환 (confidence 0~1)
- **FR-R117.6**: N2SF C/S 등급 차단 guard — 번역 API 전송 전 검증
- **FR-R117.7**: PII 마스킹 후 외부 번역 모델 호출
- **FR-R117.8**: `getAuditLog()` 필수
- **NFR-R117.1**: TypeScript strict 0, 테스트 80%+
- **NFR-R117.2**: 용어 사전 1만 개 조회 10ms 이내

## 추적성 매트릭스

| FR ID | 구현 | 테스트 | CSAP |
|-------|------|--------|------|
| FR-R117.1~5 | cross-lingual-ai-bridge.ts | .test.ts | - |
| FR-R117.6 | grade guard | test | N2SF N-05 |
| FR-R117.7 | PII mask | test | D-09 |
| FR-R117.8 | auditLog | test | D-06 |
