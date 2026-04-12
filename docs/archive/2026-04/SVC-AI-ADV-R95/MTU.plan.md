# SVC-AI-ADV-R95 — 데이터 계보 추적기 (Data Lineage Tracker)

> 작성일: 2026-04-12 | 작성자: PM Lead | 버전: 1.0.0

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 공공 데이터 흐름 자동 추적 + 개인정보보호법 준수 검증 |
| 품질 | 추적 손실 0%, 그래프 쿼리 100ms 이내 |
| 보안 | 데이터 등급 자동 전파 (O→C→S) |
| 비용 | 내부 그래프 DB, 외부 호출 없음 |

## Context Anchor

- **WHY**: 개인정보 2차 사용/외부 전송 시 법적 증거 필요
- **WHO**: 개인정보 보호책임자(CPO), 감리원, DPO
- **RISK**: 추적 누락 → 법적 책임 → 모든 edge 감사로그 필수
- **SUCCESS**: 데이터셋 ID → 출처/변형/목적지 그래프 반환
- **SCOPE**: 인메모리/영속 스토리지 어댑터 분리

## 요구사항

- **FR-R95.1**: registerDataset(id, grade, owner) — 노드 생성
- **FR-R95.2**: recordFlow(from, to, operation, purpose) — 엣지 생성
- **FR-R95.3**: traceLineage(id) — 상/하류 전체 조회
- **FR-R95.4**: 데이터 등급 자동 전파 (상위 등급 우선)
- **FR-R95.5**: detectViolations() — 법적 위반 (C/S → 외부 전송)
- **NFR-R95.1**: 1000노드 트레이스 100ms
- **NFR-R95.2**: 테스트 5개+
