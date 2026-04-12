# SVC-AI-ADV-R122 — Compliance Report Generator

> 작성일: 2026-04-12 | 버전: 1.0.0 | 작성자: PM Lead
> 원 요청 번호: R122

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | CSAP/N2SF/행안부 감리 준수 보고서 자동 생성 (Markdown + JSON 요약) |
| 품질 | 통제항목별 이행 여부·증적 경로·미흡 사유 기입, 커버리지 % 계산 |
| 보안 | 증적 파일 메타데이터만 참조, 등급 guard |
| 비용 | 로컬 집계, 외부 서비스 비의존 |

## Context Anchor

- **WHY**: 매 분기 감리 대응 시 통제항목별 증적·이행 상태를 수작업으로 정리하면 오류 및 시간 소요가 큼. 코드 + 감사 로그 + 체크리스트를 집계해 자동 리포트화 필요
- **WHO**: 감리 대응팀, 보안 책임자, 운영팀
- **RISK**: 증적 누락 → 커버리지 미달 항목을 경고로 리포트에 명시
- **SUCCESS**: 표준 통제항목 세트 입력 → 현황 집계 → Markdown 리포트 생성 + 미흡 항목 리스트
- **SCOPE**: In — 통제항목 집계·리포트 생성. Out — 증적 수집(외부 주입)

## 요구사항

- **FR-R122.1**: 통제항목(ControlItem) 레지스트리 (id, framework, description, required)
- **FR-R122.2**: 증적(Evidence) 등록 — controlId 연결, 경로/설명/작성일
- **FR-R122.3**: 이행 상태(status): compliant/partial/non-compliant/not-applicable
- **FR-R122.4**: 프레임워크별 커버리지 계산 (CSAP/N2SF/행안부)
- **FR-R122.5**: Markdown 리포트 생성 (요약 테이블 + 미흡 항목 + 증적 목록)
- **FR-R122.6**: JSON 요약 리턴 (프레임워크별 비율, 미흡 항목)
- **FR-R122.7**: N2SF 등급 guard (증적 메타데이터)
- **FR-R122.8**: `getAuditLog()` 필수
- **NFR-R122.1**: TypeScript strict 0, 테스트 80%+

## 추적성 매트릭스

| FR ID | 구현 | 테스트 | CSAP |
|-------|------|--------|------|
| FR-R122.1~6 | compliance-report-generator.ts | .test.ts | D-06 |
| FR-R122.7 | grade guard | test | N2SF N-05 |
| FR-R122.8 | auditLog | test | D-06 |
