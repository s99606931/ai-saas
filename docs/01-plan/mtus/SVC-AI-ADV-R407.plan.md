# SVC-AI-ADV-R407 Plan: AI기반 공공기관 계약 위험 분석

## Context Anchor
- **WHY**: 계약서 위험 조항 자동 탐지로 법적 분쟁 예방
- **WHO**: 계약 담당자, 법무팀
- **RISK**: 위험 조항 오탐지로 계약 진행 지연 가능
- **SUCCESS**: SC-R407-1 위험 점수 계산, SC-R407-2 고위험 계약 목록
- **SCOPE**: 계약 등록, 위험 조항 기록, 위험 점수 계산

## 요구사항
- FR-R407.1: 계약 등록 (id, title, contractType)
- FR-R407.2: 위험 조항 기록 (contractId, clauseType, severity)
- FR-R407.3: 계약별 위험 점수 계산 (심각도 가중 합산)
- FR-R407.4: 고위험 계약 목록 반환 (riskScore >= threshold)
- NFR-R407.1: C/S 등급 데이터 전송 금지 (N2SF N-05)
- NFR-R407.2: 모든 작업 감사 로그 기록
