# SVC-AI-ADV-R90 — AI 규제 변경 모니터링 (Regulation Change Monitor)

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead
> 상위: SVC-AI-ADV (AI 고도화 서비스)
> Phase: Advanced AI Loop 6 (R90~R99+)

## Executive Summary (4-Perspective)

| 관점 | 내용 |
|------|------|
| 비즈니스 | 공공기관 법령/고시/예규 변경에 서비스가 즉시 대응하여 비준수 리스크 제거 |
| 사용자 | 규제 담당자·CISO·컴플라이언스팀이 변경 사항을 48시간 내 인지 |
| 시스템 | 국가법령정보센터 공개 API + 행안부 고시 RSS 폴링 → LLM 영향도 분석 → 알림 |
| 준수 | CSAP D-06 감사로그, N2SF O등급 공개 법령 데이터만 처리 |

## Context Anchor

- **WHY**: CSAP/N2SF/ISMS-P 규정은 연 3~5회 개정. 수동 추적 시 평균 지연 45일 → 서비스 비준수 구간 발생.
- **WHO**: 공공기관 CISO, 규제 담당자, 서비스 PM
- **RISK**: 잘못된 영향도 분석 → 과대 경보 피로 / 과소 경보 누락. 외부 API 장애 시 탐지 공백.
- **SUCCESS**: 법령 변경 탐지 MTTD ≤ 6시간, 영향도 분류 정확도 ≥ 85%, False Positive ≤ 10%
- **SCOPE**: 공개 법령 데이터 한정 (O등급). 조직 내부 정책은 제외 (다른 MTU).

## 기능 요구사항 (FR)

| ID | 요구사항 | 우선순위 | 검증 |
|----|---------|---------|------|
| FR-R90.1 | 국가법령정보센터 OpenAPI 폴링 (24h 주기, 백오프) | HIGH | polling interval 설정 가능 |
| FR-R90.2 | 문서 diff 기반 변경 탐지 (이전 스냅샷 대비) | HIGH | hash 기반 빠른 비교 |
| FR-R90.3 | LLM 영향도 분석 (Critical/High/Medium/Low) | HIGH | 4단계 분류 |
| FR-R90.4 | 영향받는 서비스 태그 추출 (keyword→service map) | HIGH | 매핑 테이블 |
| FR-R90.5 | 알림 라우팅 (Slack/Email/Webhook) | MED | 최소 1개 채널 |
| FR-R90.6 | 변경 이력 append-only 저장 | HIGH | CSAP D-06 |
| FR-R90.7 | 대시보드용 JSON 내보내기 | MED | REST 엔드포인트 스펙 |

## 비기능 요구사항 (NFR)

- **NFR-R90.1**: 폴링 실패 5회 연속 시 관리자 알림
- **NFR-R90.2**: LLM 호출 비용 월 10,000원 이하 (모델 라우팅)
- **NFR-R90.3**: 감사 로그 `.claude/audit.jsonl` 기록

## 추적성 매트릭스

| FR | 산출물 | 테스트 | 규정 |
|----|--------|--------|------|
| FR-R90.1 | `regulation-change-monitor.ts::RegulationPoller` | poll-success.test | 감리 T-05 |
| FR-R90.2 | `regulation-change-monitor.ts::DiffDetector` | diff-detection.test | — |
| FR-R90.3 | `regulation-change-monitor.ts::ImpactAnalyzer` | impact-classification.test | N2SF N-05 |
| FR-R90.4 | `regulation-change-monitor.ts::ServiceMapper` | service-mapping.test | — |
| FR-R90.5 | `regulation-change-monitor.ts::AlertRouter` | alert-routing.test | CSAP D-06 |
| FR-R90.6 | `regulation-change-monitor.ts::ChangeLedger` | ledger-append.test | CSAP D-06 |
| FR-R90.7 | `regulation-change-monitor.ts::exportSnapshot` | export.test | — |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 최초 작성 | PM Lead |
