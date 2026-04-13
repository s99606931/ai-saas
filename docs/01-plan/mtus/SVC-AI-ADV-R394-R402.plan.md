# SVC-AI-ADV R394~R402 Plan — AI 고도화 서비스 (트랙 B 9차)

> 작성일: 2026-04-13 | 버전: 1.0.0 | 작성자: ai-impl-b

---

## Executive Summary (4-Perspective)

| 관점 | 내용 |
|------|------|
| 비즈니스 | 공공기관 AI 서비스 고도화: 로그 집계·업무 위험·SLA 보고·위협 탐지·리소스 예약·언어 교정·행동 분석·CI/CD 최적화·의존성 문서화 자동화 |
| 기술 | TypeScript strict, Vitest 단위 테스트, N2SF C/S 등급 차단, CSAP D-06 감사 로그 |
| 운영 | 각 MTU 독립 배포 가능, 감사 추적 append-only, 외부 AI API 호출 없음 (로컬 규칙 기반) |
| 규제 | CSAP D-06/D-08/D-12, N2SF N-05, 행안부 정보시스템 감리기준 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 공공 SaaS 플랫폼 AI 기능 확장 — 9개 도메인 자동화로 운영 효율화 |
| WHO | 공공기관 IT 운영팀, 개발팀, 보안 담당자 |
| RISK | N2SF C/S 등급 데이터 AI 처리 시 개인정보 침해; SQL/XSS 공격 미탐지 |
| SUCCESS | 9개 MTU 전수 구현, Vitest 5개+/MTU, TypeScript 0 에러, ESLint 0 경고 |
| SCOPE | R394~R402 구현 파일 9개 + 테스트 파일 9개, 외부 의존성 없음 |

---

## 요구사항 목록

| MTU ID | 기능명 | 성공 기준 ID | 우선순위 |
|--------|--------|-------------|---------|
| R394 | AI기반 지능형 로그 집계 분석 | SVC-AI-ADV-R394-SC01 | HIGH |
| R395 | AI기반 공공기관 업무 위험 평가 | SVC-AI-ADV-R395-SC01 | HIGH |
| R396 | AI기반 자동 서비스 수준 보고서 | SVC-AI-ADV-R396-SC01 | HIGH |
| R397 | AI기반 실시간 API 보안 위협 탐지 | SVC-AI-ADV-R397-SC01 | CRITICAL |
| R398 | AI기반 스마트 리소스 예약 관리 | SVC-AI-ADV-R398-SC01 | MEDIUM |
| R399 | AI기반 공공 서비스 언어 자동 교정 v2 | SVC-AI-ADV-R399-SC01 | MEDIUM |
| R400 | AI기반 멀티테넌트 이상 행동 분석 | SVC-AI-ADV-R400-SC01 | HIGH |
| R401 | AI기반 자동 CI/CD 최적화 v2 | SVC-AI-ADV-R401-SC01 | MEDIUM |
| R402 | AI기반 서비스 의존성 자동 문서화 v2 | SVC-AI-ADV-R402-SC01 | MEDIUM |

---

## 성공 기준 상세

- **SVC-AI-ADV-R394-SC01**: N2SF C/S 등급 차단, 오류율 기반 이상 탐지, 패턴 집계, 감사 로그 불변
- **SVC-AI-ADV-R395-SC01**: N2SF C/S 등급 차단, 마감/예산/PII/외부 연계 위험 요인 평가
- **SVC-AI-ADV-R396-SC01**: A~F 등급 산정, 가용성/응답/에러율/MTTR 기반, 추세 탐지
- **SVC-AI-ADV-R397-SC01**: SQL 주입/XSS/경로 순회/무차별 대입/속도 남용 탐지, CRITICAL 시 차단
- **SVC-AI-ADV-R398-SC01**: 시간 충돌 없는 최적 배정, URGENT 우선 대기열, 취소 처리
- **SVC-AI-ADV-R399-SC01**: N2SF C/S 등급 차단, 전문 용어/비공식 표현 교정, 가독성·격식 점수
- **SVC-AI-ADV-R400-SC01**: 대량 내보내기/비정상 시간/크로스 테넌트/비정상 볼륨 탐지, CRITICAL 차단
- **SVC-AI-ADV-R401-SC01**: 병렬화/캐시/리소스 증가 제안, 병목 탐지, 절감 시간 추정
- **SVC-AI-ADV-R402-SC01**: MARKDOWN/MERMAID/JSON 형식 생성, 아웃바운드/인바운드 의존성, 크리티컬 목록

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-13 | 최초 작성 | ai-impl-b |
