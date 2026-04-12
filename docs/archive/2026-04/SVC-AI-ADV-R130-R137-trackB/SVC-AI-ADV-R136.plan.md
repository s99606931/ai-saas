# SVC-AI-ADV-R136 — AI 기반 감사 증적 자동 수집

> 작성일: 2026-04-12 | 버전: 1.0.0 | 작성자: Implementer (트랙 B 2차)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | CSAP 79항목 감사 증적 자동 수집 + 정리 |
| 품질 | 항목별 충족/미충족 판정, 누락 항목 식별 |
| 보안 | 감사 증적 불변성, append-only 저장 |
| 비용 | 규칙 기반 매핑, LLM 없음 |

## Context Anchor

- **WHY**: CSAP 갱신 시 79항목 증적 수동 수집에 수주 소요. 자동화로 갱신 주기 단축.
- **WHO**: CSAP 담당자, 보안 팀
- **RISK**: 증적 누락으로 심사 실패
- **SUCCESS**: 증적 등록 → CSAP 항목 매핑 → 충족률 계산 → 갭 목록 반환
- **SCOPE**: In — 증적 수집, 항목 매핑, 갭 분석. Out — 자동 수집 에이전트.

## 요구사항

- **FR-R136.1**: `registerEvidence(evidence)` — 감사 증적 등록
- **FR-R136.2**: `mapToCsap(evidenceId, csapItemId)` — CSAP 항목 매핑
- **FR-R136.3**: `analyzeGaps()` — 미충족 CSAP 항목 목록 반환
- **FR-R136.4**: `getComplianceReport()` — 전체 충족률 + 항목별 상태 보고서
- **FR-R136.5**: `getAuditLog()` — 수집 이력 (CSAP D-06)
- **NFR-R136.1**: TypeScript strict 0 에러, 테스트 6개+

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 최초 작성 | Implementer |
