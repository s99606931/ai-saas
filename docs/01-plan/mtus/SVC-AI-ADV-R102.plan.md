# SVC-AI-ADV-R102 — PII-Safe 테스트 데이터 팩토리

> 작성일: 2026-04-12 | 버전: 1.0.0

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 실제 데이터 스키마 기반 PII 완전 제거 합성 데이터 생성 |
| 품질 | PII 유출률 0%, 통계 분포 유사 ±5% |
| 보안 | 개인정보보호법 준수 (가명처리 방식) |
| 비용 | 순수 규칙 + 난수 |

## Context Anchor

- **WHY**: 기존 synthetic-data-generator는 범용. 공공 DB 필드(주민번호, 주소 등) 특화 필요
- **WHO**: QA, 개발팀, 감리팀
- **SUCCESS**: 스키마 입력 → PII 0 보장 데이터 N건 생성

## 요구사항

- **FR-R102.1**: 스키마 선언 (field, piiType, distribution)
- **FR-R102.2**: piiType별 안전 대체값 생성 (fakeName, fakeAddress 등)
- **FR-R102.3**: 통계 분포 유지 (normal, uniform, categorical)
- **FR-R102.4**: 생성 결과 검증 (PII 재검증)
- **FR-R102.5**: 시드 기반 재현성
- **NFR-R102.1**: 테스트 5개+
