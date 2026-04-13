# SVC-AI-ADV-R380 Plan: AI기반 지능형 네트워크 보안 감시

## Context Anchor
- **WHY**: 네트워크 이상 트래픽 실시간 탐지로 침해 대응
- **WHO**: 보안관제팀
- **RISK**: 오탐으로 정상 트래픽 차단 가능
- **SUCCESS**: SC-R380-1 트래픽 임계치 초과 탐지, SC-R380-2 위협 목록 반환
- **SCOPE**: 네트워크 세그먼트 등록, 트래픽 기록, 이상 탐지

## 요구사항
- FR-R380.1: 네트워크 세그먼트 등록 (id, name, thresholdMbps)
- FR-R380.2: 트래픽 기록 (segmentId, trafficMbps, sourceIp)
- FR-R380.3: 임계치 초과 이벤트 탐지
- FR-R380.4: 활성 위협 이벤트 목록 반환
- NFR-R380.1: C/S 등급 데이터 전송 금지 (N2SF N-05)
- NFR-R380.2: 모든 작업 감사 로그 기록
