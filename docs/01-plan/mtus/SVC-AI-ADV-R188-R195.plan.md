# SVC-AI-ADV R188~R195 계획서 (트랙 B 6차)

> **요구사항 ID**: SVC-AI-ADV-R188 ~ R195
> **작성일**: 2026-04-12
> **작성자**: Implementer (ai-impl-b)
> **버전**: 1.0.0

---

## Context Anchor

| 관점 | 내용 |
|------|------|
| WHY | 공공기관 SaaS 플랫폼 AI 기능 확장 — 마이크로서비스 자동 검색, API 마이그레이션, 멀티모달 검색 등 8개 신규 모듈 |
| WHO | 공공기관 시스템 운영자, AI 서비스 담당자 |
| RISK | N2SF C/S 등급 데이터 AI 처리 노출, 권한 승급 미탐지 |
| SUCCESS | 8개 MTU 전 테스트 통과, CSAP D-06/D-08/D-12 준수 |
| SCOPE | `/platform/services/ai-service/src/lib/` 내 8개 TypeScript 모듈 |

---

## 대상 MTU

| MTU ID | 기능명 | 구현 파일 | FR ID |
|--------|--------|----------|-------|
| R188 | AI기반 마이크로서비스 자동 검색 | microservice-autodiscovery-ai.ts | FR-AI.188 |
| R189 | AI기반 API 버전 마이그레이션 지원 | api-version-migration-ai.ts | FR-AI.189 |
| R190 | AI기반 멀티모달 공공 서비스 검색 | multimodal-public-search.ts | FR-AI.190 |
| R191 | AI기반 모델 드리프트 자동 수정 | model-drift-corrector.ts | FR-AI.191 |
| R192 | AI기반 동적 권한 승급 감지 | privilege-escalation-detector.ts | FR-AI.192 |
| R193 | AI기반 스트리밍 이상 감지 | streaming-anomaly-detector.ts | FR-AI.193 |
| R194 | AI기반 예산 집행 패턴 분석 | budget-execution-analyzer.ts | FR-AI.194 |
| R195 | AI기반 민원 우선순위 자동 분류 v2 | complaint-priority-classifier-v2.ts | FR-AI.195 |

---

## 성공 기준 (SC)

### R188 — 마이크로서비스 자동 검색
- SC01: 인텐트 텍스트 기반 서비스 검색 (키워드 매칭 + 점수화)
- SC02: unhealthy 서비스 검색 결과 자동 제외
- SC03: 태그 필터 및 최소 버전 필터 지원
- SC04: CSAP D-06 감사 로그

### R189 — API 버전 마이그레이션 지원
- SC01: 두 버전 간 엔드포인트 차이 분석 (REMOVE/ADD/MODIFY)
- SC02: 리스크 수준 자동 산정 (LOW/MEDIUM/HIGH)
- SC03: 예상 작업 시간 산출

### R190 — 멀티모달 공공 서비스 검색
- SC01: TEXT/IMAGE/DOCUMENT 모달리티 지원
- SC02: N2SF N-05 C/S 등급 문서 색인 차단 (BLOCKED 에러)
- SC03: 카테고리/모달리티 복합 필터

### R191 — 모델 드리프트 자동 수정
- SC01: accuracy/precision/recall 드리프트 감지
- SC02: CRITICAL(≥0.2) → ROLLBACK 자동 수행
- SC03: HIGH(≥0.1) → RETRAIN 권고

### R192 — 동적 권한 승급 감지
- SC01: 5단계 역할 계층 (VIEWER→USER→OPERATOR→ADMIN→SUPERADMIN)
- SC02: 2단계 이상 승급 자동 차단 (CSAP D-08)
- SC03: 3단계 이상 CRITICAL 즉시 차단

### R193 — 스트리밍 이상 감지
- SC01: 베이스라인(이전 이벤트) 기반 Z-score 계산
- SC02: SPIKE/DROP/STOP 3종 이상 탐지
- SC03: std=0 베이스라인 시 임의 변화 감지

### R194 — 예산 집행 패턴 분석
- SC01: FRONT_LOADED/BACK_LOADED/EVEN/IRREGULAR 패턴 탐지
- SC02: 집행률 = totalSpent / annualBudget
- SC03: 집중 지출 월 bottleneck 탐지

### R195 — 민원 우선순위 자동 분류 v2
- SC01: N2SF N-05 C/S 등급 차단
- SC02: 긴급/위험 키워드, 반복 민원, 대기일수, 채널 다중 가중치
- SC03: CRITICAL(≥60)/HIGH(≥35)/NORMAL(≥15)/LOW 4단계 분류

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|-------|
| 1.0.0 | 2026-04-12 | 최초 작성 | ai-impl-b |
