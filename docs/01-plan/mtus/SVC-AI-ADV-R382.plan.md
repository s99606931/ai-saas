# SVC-AI-ADV-R382 Plan: AI기반 공공 서비스 접근성 자동 평가 v2

## Context Anchor
- **WHY**: 장애인·고령자를 위한 웹 접근성 자동 검증
- **WHO**: UI/UX팀, 공공서비스 담당자
- **RISK**: 접근성 항목 누락으로 법적 의무 미준수 가능
- **SUCCESS**: SC-R382-1 접근성 점수 계산, SC-R382-2 개선 항목 분류
- **SCOPE**: 서비스 등록, 접근성 항목 평가, 점수 계산

## 요구사항
- FR-R382.1: 서비스 등록 (id, name, serviceType)
- FR-R382.2: 접근성 항목 평가 기록 (serviceId, itemId, passed, score)
- FR-R382.3: 접근성 종합 점수 계산
- FR-R382.4: 미통과 항목 심각도 분류 (critical/major/minor)
- NFR-R382.1: C/S 등급 데이터 전송 금지 (N2SF N-05)
- NFR-R382.2: 모든 작업 감사 로그 기록
