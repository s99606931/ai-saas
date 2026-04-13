# SVC-AI-ADV-R381 Plan: AI기반 코드 생성 품질 검증

## Context Anchor
- **WHY**: AI 생성 코드의 품질·보안 결함 자동 검출
- **WHO**: 개발팀, DevSecOps팀
- **RISK**: 검증 기준 미비로 취약 코드 배포 가능
- **SUCCESS**: SC-R381-1 품질 점수 계산, SC-R381-2 결함 카테고리별 집계
- **SCOPE**: 코드 스니펫 등록, 결함 기록, 품질 점수 계산

## 요구사항
- FR-R381.1: 코드 스니펫 등록 (id, language, linesOfCode)
- FR-R381.2: 결함 기록 (snippetId, defectType, severity)
- FR-R381.3: 품질 점수 계산 (결함 심각도 차감)
- FR-R381.4: 결함 유형별 집계 반환
- NFR-R381.1: C/S 등급 데이터 전송 금지 (N2SF N-05)
- NFR-R381.2: 모든 작업 감사 로그 기록
