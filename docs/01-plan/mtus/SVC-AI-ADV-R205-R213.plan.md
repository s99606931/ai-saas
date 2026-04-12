# SVC-AI-ADV R205~R213 계획서 (트랙 B 7차)

> **요구사항 ID**: SVC-AI-ADV-R205 ~ R213
> **작성일**: 2026-04-12
> **작성자**: Implementer (ai-impl-b)
> **버전**: 1.0.0

---

## Context Anchor

| 관점 | 내용 |
|------|------|
| WHY | 공공기관 SaaS 플랫폼 운영 고도화 — 멀티에이전트 오케스트레이션, 보안 이벤트 분류, 배포 리스크 평가 등 9개 신규 모듈 |
| WHO | 공공기관 시스템 운영자, DevOps 담당자, 보안 담당자 |
| RISK | N2SF C/S 등급 데이터 AI 처리 노출, 보안 이벤트 미탐지 |
| SUCCESS | 9개 MTU 전 테스트 통과, CSAP D-06/D-08/D-12 준수 |
| SCOPE | `/platform/services/ai-service/src/lib/` 내 9개 TypeScript 모듈 |

---

## 대상 MTU

| MTU ID | 기능명 | 구현 파일 |
|--------|--------|----------|
| R205 | AI기반 멀티에이전트 오케스트레이터 v2 | multi-agent-orchestrator-v2.ts |
| R206 | AI기반 실시간 보안 이벤트 분류 | realtime-security-event-classifier.ts |
| R207 | AI기반 공공 조달 리스크 평가 | procurement-risk-assessor-ai.ts |
| R208 | AI기반 서비스 레벨 목표 최적화 | slo-optimizer-ai.ts |
| R209 | AI기반 지식 베이스 자동 구축 | knowledge-base-builder-ai.ts |
| R210 | AI기반 사용자 인터페이스 개인화 엔진 | ui-personalization-engine.ts |
| R211 | AI기반 배포 리스크 자동 평가 | deployment-risk-assessor-ai.ts |
| R212 | AI기반 코드 품질 자동 개선 | code-quality-improver-ai.ts |
| R213 | AI기반 서비스 장애 자동 대응 | incident-auto-responder-ai.ts |

---

## 성공 기준 요약

- R205: N2SF C/S 차단, 의존성 검사, 동기 에이전트 실행
- R206: 카테고리 분류(AUTH/NETWORK/DATA/SYSTEM), rawScore 지원, 완화 권고
- R207: 입찰 경쟁 부족/긴급/덤핑/대규모 계약 리스크 요인 탐지
- R208: 에러 예산 소진율, 레이턴시/에러율 초과 권고
- R209: N2SF C/S 차단, 키워드 기반 문서 검색
- R210: 접근성(고대비/폰트), 역할 기반 레이아웃/추천, 사용 이력 topModules
- R211: DB 마이그레이션/롤백 미비/대규모 변경 리스크 산정, 승인 필요 여부
- R212: 이슈 유형별/심각도별 집계, 품질 점수(100-감점), CRITICAL 0개+점수≥60 통과
- R213: P1~P4 심각도별 자동 액션(PAGE_ONCALL, SCALE_OUT, CIRCUIT_BREAKER), 상태 추적

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|-------|
| 1.0.0 | 2026-04-12 | 최초 작성 | ai-impl-b |
