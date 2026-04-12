# SVC-AI-ADV-R260 — 재난 대응 코디네이터

> 작성일: 2026-04-13 | 버전: 1.0.0 | 작성자: PM Lead (자율 생성)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 재난 이벤트 등록 + 심각도 분류 + 대피소/자원 배분 + 시민 경보 생성 |
| 품질 | 결정론적 우선순위, 테스트 11개+ |
| 보안 | C/S 차단(피해자 개인정보), 시민 ID 마스킹, CSAP D-06 감사 로그 |
| 비용 | 로컬 엔진, 외부 호출 없음 |

## Context Anchor

- **WHY**: 재난 발생 시 수작업 대응 지연 → AI 기반 자동 조정 필요
- **WHO**: 재난안전대책본부, 지자체 공무원, 시민
- **RISK**: 잘못된 심각도 판정 시 대피 지연 → 인명피해
- **SUCCESS**: 이벤트 등록 → 심각도 산출 → 자원 배분 → 경보 발행
- **SCOPE**: In — 조정·배분 로직. Out — 실제 통신 발송

## 요구사항

- **FR-R260.1**: 재난 이벤트 등록 (eventId·type·locationCode·affectedCount·severity 입력 필드)
- **FR-R260.2**: 심각도 자동 분류 (affected<100→LOW, <1000→MEDIUM, <10000→HIGH, ≥10000→CRITICAL)
- **FR-R260.3**: 대피소 등록·용량 관리 (shelterId·capacity·currentOccupancy)
- **FR-R260.4**: 대피소 배분 (affectedCount → 가장 가까운 여유 대피소 우선, 부족 시 분산)
- **FR-R260.5**: 자원 요청 생성 (심각도별 필수 자원 목록: 의료/식량/물/구호품)
- **FR-R260.6**: 시민 경보 생성 (alertLevel·message·targetLocationCode)
- **FR-R260.7**: C/S 차단, citizenId 마스킹, CSAP D-06 감사 로그, getAuditLog()
- **NFR-R260.1**: TypeScript strict, 테스트 11개+

## 추적성 매트릭스

| FR ID | 구현 | 테스트 | CSAP |
|-------|------|--------|------|
| FR-R260.1~7 | disaster-response-coordinator.ts | .test.ts | D-06, D-12 |
