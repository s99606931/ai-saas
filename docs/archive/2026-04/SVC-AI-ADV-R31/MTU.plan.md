# SVC-AI-ADV-R31: Text2SQL (자연어 -> SQL 변환)

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead (Opus)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 비전문가도 자연어 질의로 DB 데이터 조회 가능 (민원 통계 등) |
| 기술 | LLM 기반 자연어→SQL 변환 + 스키마 인식 + SQL 검증 |
| 보안 | CSAP D-12 SQL 주입 방지, 매개변수화 쿼리 강제, 읽기 전용 |
| 운영 | 쿼리 실행 전 검증 필수, 실행 시간 제한, 감사 로그 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 공공기관 데이터 활용 수요 증가. SQL 전문 인력 부족. 자연어 인터페이스 필수 |
| WHO | 공공기관 데이터 분석 담당자, 민원 처리 담당자 |
| RISK | SQL 주입 공격, 대량 데이터 유출, 느린 쿼리 실행 |
| SUCCESS | SQL 생성 정확도 85%+, SQL 주입 0건, 쿼리 실행 < 10초 |
| SCOPE | Text2SQL 변환 엔진, SQL 검증기, 스키마 관리, 안전한 실행 |

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 |
|-------|---------|---------|
| FR-ADV31.1 | 자연어→SQL 변환 — LLM 기반 쿼리 생성 | P0 |
| FR-ADV31.2 | 스키마 인식 — 테이블/컬럼 메타데이터 컨텍스트 주입 | P0 |
| FR-ADV31.3 | SQL 검증 — 구문 검증 + 위험 쿼리 차단 | P0 |
| FR-ADV31.4 | SQL 주입 방지 — 파라미터 바인딩 강제 (CSAP D-12) | P0 |
| FR-ADV31.5 | 읽기 전용 강제 — SELECT만 허용, DDL/DML 차단 | P0 |
| FR-ADV31.6 | 쿼리 설명 — 생성된 SQL을 자연어로 역변환 설명 | P1 |
| FR-ADV31.7 | 실행 제한 — 타임아웃, 결과 행 수 제한, LIMIT 강제 | P1 |

---

## 산출물

| 산출물 | 경로 |
|--------|------|
| text2sql.ts | platform/services/ai-service/src/lib/text2sql.ts |
| sql-validator.ts | platform/services/ai-service/src/lib/sql-validator.ts |
