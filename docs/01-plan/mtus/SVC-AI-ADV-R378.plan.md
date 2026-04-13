# SVC-AI-ADV-R378 Plan: AI기반 서비스 장애 자동 복구 v2

## Context Anchor
- **WHY**: 서비스 장애 발생 시 자동 복구로 MTTR 단축
- **WHO**: SRE팀, 운영팀
- **RISK**: 자동 복구 액션이 장애를 악화시킬 수 있음
- **SUCCESS**: SC-R378-1 장애 탐지, SC-R378-2 복구 액션 실행 및 성공률 추적
- **SCOPE**: 장애 등록, 복구 액션 실행, 성공률 계산

## 요구사항
- FR-R378.1: 서비스 등록 (id, name, recoveryActions)
- FR-R378.2: 장애 발생 기록 (serviceId, incidentType, severity)
- FR-R378.3: 복구 액션 실행 결과 기록 (success/failed)
- FR-R378.4: 서비스별 복구 성공률 계산
- NFR-R378.1: C/S 등급 데이터 전송 금지 (N2SF N-05)
- NFR-R378.2: 모든 작업 감사 로그 기록
