# SVC-AI-ADV-R10: Multimodal AI (문서 이미지 처리)

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 초안 작성 | PM Lead |

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 공문서 스캔 이미지를 AI로 분석하여 텍스트 추출(OCR), 표/차트 이해, 도장/서명 감지. 종이 기반 문서의 디지털 전환 및 자동 분류 |
| 기술 | Vision-Language 모델 통합, 이미지 전처리, 구조적 문서 분석, OCR+AI 하이브리드 |
| 보안 | 이미지 내 PII 감지 후 마스킹, N2SF O등급만 AI 전송, CSAP D-08 접근 통제 |
| 운영 | 지원 이미지 형식(JPEG/PNG/PDF), 최대 크기 제한, 처리 큐 관리 |

---

## Context Anchor

### WHY
공공기관에는 여전히 스캔된 종이 문서가 대량 존재합니다. 2026년 현재 Vision-Language 모델(GPT-4o, Gemma-4 VL, LLaVA 등)은 문서 이미지에서 텍스트 추출, 표 구조 이해, 도장/서명 감지를 수행할 수 있으며, OCR 단독보다 훨씬 높은 정확도를 제공합니다.

### WHO
- 민원 담당자: 스캔 문서 자동 분류 및 텍스트 추출
- 감사담당관: 도장/서명 확인 자동화
- 데이터 관리자: 비정형 문서의 구조화 데이터 변환

### RISK
- R1: VLM 모델 미가용 (완화: Tesseract OCR 폴백)
- R2: 이미지 내 PII 처리 (완화: OCR 후 PII 마스킹)
- R3: 대용량 이미지 메모리 (완화: 해상도 제한, 분할 처리)

### SUCCESS
- SC-1: 이미지 기반 문서 분석 — 텍스트 추출, 구조 파악
- SC-2: 표/차트 이해 — 행/열 구조 JSON 변환
- SC-3: 도장/서명 감지 — 위치 + 유형 분류
- SC-4: 문서 자동 분류 — 공문서 유형 판별

### SCOPE
- IN: 이미지 전처리, VLM 통합, 문서 분석, OCR 폴백
- OUT: 실시간 카메라 입력, 동영상 처리, 음성 인식

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 |
|-------|---------|---------|
| FR-ADV10.1 | 이미지 전처리 — 해상도 조정, 형식 변환, base64 인코딩 | P0 |
| FR-ADV10.2 | VLM 통합 — multimodal LLM에 이미지+텍스트 전송 | P0 |
| FR-ADV10.3 | 문서 텍스트 추출 — OCR+AI 하이브리드 | P0 |
| FR-ADV10.4 | 표/차트 구조 분석 — JSON 구조 변환 | P1 |
| FR-ADV10.5 | 도장/서명 감지 — 위치+유형 | P1 |
| FR-ADV10.6 | 문서 자동 분류 — 공문서 유형 판별 | P1 |
| FR-ADV10.7 | OCR 폴백 — VLM 미가용 시 Tesseract 대체 | P0 |
| FR-ADV10.8 | 이미지 PII 감지 — OCR 텍스트의 PII 마스킹 | P0 |

---

## 추적성 매트릭스

| FR ID | 구현 파일 | CSAP |
|-------|----------|------|
| FR-ADV10.1~10.2 | multimodal-processor.ts | D-12 |
| FR-ADV10.3~10.8 | document-analyzer.ts | D-12, D-08, N-05 |

---

## 산출물 목록

| 산출물 | 경로 |
|--------|------|
| multimodal-processor.ts | platform/services/ai-service/src/lib/multimodal-processor.ts |
| document-analyzer.ts | platform/services/ai-service/src/lib/document-analyzer.ts |
