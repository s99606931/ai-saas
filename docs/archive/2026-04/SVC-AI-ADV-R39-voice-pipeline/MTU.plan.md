# SVC-AI-ADV-R39 — 음성 AI 파이프라인 (Voice AI)

> 작성일: 2026-04-12 | 작성자: PM Lead | 버전: 1.0.0

## Executive Summary

| 관점 | 목표 | 지표 | 결과 |
|---|---|---|---|
| 비즈니스 | 민원 전화 24/7 AI 자동 응답 | 자동처리율 70% | 미측정 |
| 기술 | STT/TTS 통합 파이프라인 구축 | WER < 10% (한국어) | 목표 설정 |
| 보안 | 통화 녹음 C등급 격리 + 마스킹 | 유출 0건 | 설계 반영 |
| 규정 | CSAP D-06 감사로그 + N2SF 준수 | 전수 기록 | 설계 반영 |

## Context Anchor

- **WHY**: 공공기관 콜센터 민원 전화 폭증(연 400만건) 대응, 24시간 응대 필요
- **WHO**: 민원 담당자, 콜센터 관리자, 음성 기록 감사자
- **RISK**:
  - R1: 한국어 공공 용어 인식률 저하 → 도메인 특화 모델 fine-tune 필요
  - R2: 통화 녹음 C등급 데이터 → 온프레미스 처리 필수 (외부 AI API 금지)
  - R3: TTS 발화가 편향/오류 정보 → ai-guardrails 연동 필수
- **SUCCESS**: 한국어 공공용어 WER 8% 이하, TTS MOS 4.0+, 처리 레이턴시 2초 이내
- **SCOPE**:
  - IN: STT 처리기, TTS 처리기, 음성 파이프라인 오케스트레이터, 세션 관리
  - OUT: 음성 합성 모델 학습, 전화 교환기 연동 (별도 MTU)

## 기능 요구사항 (FR)

| FR ID | 제목 | 우선순위 | 산출물 |
|---|---|---|---|
| FR-R39.1 | STT 음성→텍스트 변환 | P0 | stt-processor.ts |
| FR-R39.2 | TTS 텍스트→음성 합성 | P0 | tts-processor.ts |
| FR-R39.3 | 음성 세션 파이프라인 | P0 | voice-pipeline.ts |
| FR-R39.4 | 한국어 공공용어 사전 적용 | P1 | stt-processor.ts (terminology) |
| FR-R39.5 | 통화 감사 로그 기록 | P0 | audit.jsonl |
| FR-R39.6 | PII 마스킹 (주민번호/카드번호) | P0 | pii-masking 연동 |

## 비기능 요구사항 (NFR)

| NFR ID | 항목 | 목표 |
|---|---|---|
| NFR-R39.1 | 처리 레이턴시 | STT 1초 이내, TTS 1초 이내 |
| NFR-R39.2 | 동시 세션 수 | 100 세션 |
| NFR-R39.3 | 보안 등급 | 통화 녹음 C등급, 변환 텍스트 O등급(마스킹 후) |

## 추적성 매트릭스

| FR | 산출물 | 테스트 | CSAP |
|---|---|---|---|
| FR-R39.1 | stt-processor.ts | stt-processor.test.ts | D-09, D-12 |
| FR-R39.2 | tts-processor.ts | tts-processor.test.ts | D-09, D-12 |
| FR-R39.3 | voice-pipeline.ts | voice-pipeline.test.ts | D-06, D-08 |
| FR-R39.5 | audit.jsonl | audit integration test | D-06 |
| FR-R39.6 | pii-masking 연동 | masking test | N2SF N-05 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|---|---|---|---|
| 1.0.0 | 2026-04-12 | 최초 작성 | PM Lead |
