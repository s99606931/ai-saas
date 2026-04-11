# SVC-AI-ADV-R32: 문서 구조 이해 AI (Document Layout)

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead (Opus)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 공문서 스캔본/PDF의 표, 헤더, 본문 구조를 자동 파싱하여 데이터화 |
| 기술 | LayoutLM/Donut 패턴 레이아웃 분석 + LLM 구조화 + 테이블 추출 |
| 보안 | CSAP D-12 문서 처리 보안, N2SF 문서 등급별 처리 경로 분리 |
| 운영 | 온프레미스 추론 지원 (외부 API 미사용 가능) |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 공공기관 문서의 70%가 비정형 PDF/스캔본. 수작업 데이터 입력 비효율 극대 |
| WHO | 문서 관리 담당자, 행정 업무 자동화 수요 부서 |
| RISK | OCR 오류율, 표 구조 해석 실패, 비공개 문서 유출 |
| SUCCESS | 구조 인식 정확도 90%+, 표 추출 정확도 85%+, 처리 속도 < 5초/페이지 |
| SCOPE | 레이아웃 파서, 테이블 추출기, 문서 구조 트리 생성 |

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 |
|-------|---------|---------|
| FR-ADV32.1 | 레이아웃 분석 — 문서 영역 자동 분류 (제목, 본문, 표, 이미지, 각주) | P0 |
| FR-ADV32.2 | 테이블 추출 — 표 구조(행/열/병합셀) 자동 인식 + JSON/CSV 변환 | P0 |
| FR-ADV32.3 | 문서 구조 트리 — 계층 구조 (장/절/항) 자동 생성 | P0 |
| FR-ADV32.4 | OCR 후처리 — 인식 오류 교정 + 한글 최적화 | P1 |
| FR-ADV32.5 | 메타데이터 추출 — 문서 제목, 작성자, 날짜, 문서번호 자동 추출 | P1 |
| FR-ADV32.6 | 배치 처리 — 대량 문서 일괄 처리 + 진행률 추적 | P2 |

---

## 산출물

| 산출물 | 경로 |
|--------|------|
| document-layout-parser.ts | platform/services/ai-service/src/lib/document-layout-parser.ts |
| table-extractor.ts | platform/services/ai-service/src/lib/table-extractor.ts |
