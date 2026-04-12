# SVC-AI-ADV-R118 — Policy-Aware Response Filter

> 작성일: 2026-04-12 | 버전: 1.0.0 | 작성자: PM Lead
> 원 요청 번호: R118

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | AI 응답 출력 전 공공기관 금칙어/민감 정보/정책 위반 문구 자동 차단·치환 |
| 품질 | 탐지 정밀도 98%+, 정상 문구 오탐률 1% 이하 |
| 보안 | 금칙어 사전 + PII 유출 차단 + 정책 버전 관리 (CSAP D-06/D-12) |
| 비용 | 로컬 사전 기반 O(n) 스캔, 외부 API 호출 없음 |

## Context Anchor

- **WHY**: AI가 생성한 응답이 공공기관 금칙어(비속어/정치 편향/허위 광고성 표현)를 포함하거나 내부 정책 위반 문구를 포함할 경우 대외 노출 리스크 발생
- **WHO**: 챗봇·RAG·민원 응답 생성 파이프라인 말단 필터
- **RISK**: 오탐으로 정상 응답 차단 → 탐지 단계별 action(block/mask/flag) 분리
- **SUCCESS**: 금칙어/PII/정책 위반 탐지 후 정책에 따라 차단 또는 마스킹 처리 + 감사 기록
- **SCOPE**: In — 출력 필터, 정책 규칙 엔진, action 분기. Out — 입력 프롬프트 검증(별도 모듈)

## 요구사항

- **FR-R118.1**: 금칙어 사전 기반 단어 탐지 (대소문자 무시, 한/영 혼용)
- **FR-R118.2**: 정책 규칙 엔진 — regex 패턴 + severity + action (block/mask/flag)
- **FR-R118.3**: PII 재탐지 — 이메일/주민번호/전화번호 유출 차단
- **FR-R118.4**: 정책 버전 관리 — 규칙 세트 버전 추적
- **FR-R118.5**: 필터 결과 리포트 (탐지 항목 수, severity 분포)
- **FR-R118.6**: N2SF C/S 등급 차단 guard
- **FR-R118.7**: `getAuditLog()` 필수 (CSAP D-06)
- **NFR-R118.1**: TypeScript strict 0, 테스트 80%+
- **NFR-R118.2**: 10KB 응답 필터링 50ms 이내

## 추적성 매트릭스

| FR ID | 구현 | 테스트 | CSAP |
|-------|------|--------|------|
| FR-R118.1~5 | policy-aware-response-filter.ts | .test.ts | D-12 |
| FR-R118.3 | PII 재탐지 | test | D-09 |
| FR-R118.6 | grade guard | test | N2SF N-05 |
| FR-R118.7 | auditLog | test | D-06 |
