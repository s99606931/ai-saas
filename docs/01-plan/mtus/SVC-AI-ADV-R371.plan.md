# SVC-AI-ADV-R371 Plan: AI기반 코드 취약점 패턴 분석

## Context Anchor
- **WHY**: 정적 분석으로 보안 취약 패턴 조기 탐지
- **WHO**: 보안팀, 개발팀
- **RISK**: 취약점 미탐지 시 사고 발생
- **SUCCESS**: SC-R371-1 7종 취약 패턴 탐지, SC-R371-2 리스크 점수
- **SCOPE**: 코드 스캔, 심각도별 리스크 계산

## 요구사항
- FR-R371.1: SQL_INJECTION/XSS/HARDCODED_SECRET/INSECURE_CRYPTO/PATH_TRAVERSAL/COMMAND_INJECTION/SENSITIVE_LOG 탐지
- FR-R371.2: CRITICAL/HIGH/MEDIUM/LOW/INFO 심각도 분류
- FR-R371.3: riskScore = Σ(severity weight)
- FR-R371.4: passed = (CRITICAL===0 && riskScore<30)
- FR-R371.5: CSAP D-06 감사 로그

## 성공 기준 (SC)
- SVC-AI-ADV-R371-SC01: 테스트 5개+ 통과
- SVC-AI-ADV-R371-SC02: TypeScript strict 0 오류

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-13 | 최초 작성 | ai-impl-b |
