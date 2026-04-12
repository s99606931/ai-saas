# SVC-AI-ADV-R109-complaint — Public Complaint Classifier

> 작성일: 2026-04-12 | 버전: 1.0.0 | 작성자: Implementer
> 세션: #트랙B (R106~R113)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 공공 민원 텍스트 자동 분류 + 담당 부서 자동 배분 |
| 품질 | 분류 정확도 90%+, 미분류 항목 수동 검토 큐 전달 |
| 보안 | N2SF O등급 공개 민원만 처리, PII 마스킹 필수 |
| 비용 | 키워드 기반 분류, LLM 없음 |

## Context Anchor

- **WHY**: 공공기관 민원 폭증 시 수동 분류·배분에 수일 소요. 24시간 이내 처리 기준 미달 위험.
- **WHO**: 민원 담당자, 부서 관리자
- **RISK**: 오분류로 잘못된 부서 배분, PII 유출
- **SUCCESS**: 민원 텍스트 입력 → 분류 카테고리 + 담당 부서 + 우선순위 반환 완결
- **SCOPE**: In — 키워드 기반 분류, 부서 라우팅, PII 마스킹. Out — 실제 민원 시스템 연동, LLM 분류.

## 요구사항

- **FR-R109-C.1**: `registerCategory(category)` — 민원 분류 카테고리 + 키워드 등록
- **FR-R109-C.2**: `registerDepartment(department)` — 담당 부서 + 관할 카테고리 등록
- **FR-R109-C.3**: `classify(complaintText, dataGrade)` — 민원 분류 + PII 마스킹 적용
- **FR-R109-C.4**: `route(classification)` — 담당 부서 배분
- **FR-R109-C.5**: `getAuditLog()` — 분류 이력 조회 (CSAP D-06)
- **NFR-R109-C.1**: TypeScript strict 0 에러, 테스트 6개+
- **NFR-R109-C.2**: N2SF N-05 C/S 등급 차단
- **CSAP D-06**: 감사 로그 append-only

## 추적성 매트릭스

| FR ID | 구현 파일 | 테스트 | CSAP |
|-------|-----------|--------|------|
| FR-R109-C.1~4 | public-complaint-classifier.ts | .test.ts | - |
| FR-R109-C.3 | PII 마스킹 | test | N2SF N-05 |
| FR-R109-C.5 | getAuditLog() | test | D-06 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 최초 작성 | Implementer |
