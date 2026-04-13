# SVC-AI-ADV-R379 Plan: AI기반 공공기관 감사 자동화 v2

## Context Anchor
- **WHY**: 내부 감사 업무 자동화로 감사 효율성 향상
- **WHO**: 감사 담당자, 내부통제팀
- **RISK**: 감사 항목 누락으로 규정 위반 미탐지 가능
- **SUCCESS**: SC-R379-1 감사 항목 등록, SC-R379-2 미통과 항목 집계
- **SCOPE**: 감사 항목 등록, 감사 결과 기록, 결과 요약

## 요구사항
- FR-R379.1: 감사 항목 등록 (id, name, category, required)
- FR-R379.2: 감사 결과 기록 (itemId, passed, evidence)
- FR-R379.3: 카테고리별 통과율 계산
- FR-R379.4: 미통과 필수 항목 목록 반환
- NFR-R379.1: C/S 등급 데이터 전송 금지 (N2SF N-05)
- NFR-R379.2: 모든 작업 감사 로그 기록
