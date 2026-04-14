# SVC-AI-ADV R484~R492 Design — AI 고도화 서비스 (트랙 B 12차)

> 작성일: 2026-04-13 | 버전: 1.0.0 | 작성자: ai-impl-b

---

## Executive Summary (4-Perspective)

| 관점 | 내용 |
|------|------|
| 비즈니스 | 9개 도메인 AI 분석 컴포넌트: 코드 보안, 예약 최적화, 비용 이상, 감사 보고, 조직 최적화, SLA 예방, 언어 교정, 메시 보안, 장애 격리 |
| 기술 | TypeScript class 패턴, Map 기반 인메모리 스토어, append-only 감사 로그 |
| 운영 | getAuditLog() 불변 복사본 반환, 하드코딩 시크릿 없음 |
| 규제 | CSAP D-06(감사 로그), D-08(접근 통제), D-09(암호화), D-12(입력 검증) |

---

## §R484 CodeSecurityPolicyEnforcerV2

- **정책 규칙**: SECRETS(하드코딩 시크릿 CRITICAL), INJECTION(eval CRITICAL), CRYPTO(MD5 HIGH, HTTP MEDIUM), LOGGING(민감 로그 HIGH), 동적 함수(HIGH)
- **점수**: 100 - criticalHighCount×20 - mediumCount×5
- **통과 기준**: CRITICAL/HIGH 위반 없음

## §R485 PublicServiceBookingOptimizerAI

- **예약 전략**: 우선 날짜 순 탐색 → 잔여 좌석 최대 슬롯 배정 → 없으면 대기열
- **우선순위**: EMERGENCY→position=1, URGENT→우선 대기, NORMAL→순번
- **보고서**: utilizationRate = totalBookings / totalCapacity

## §R486 ServiceCostAnomalyDetectorV3

- **이상 임계값**: |deviation|≥50% → CRITICAL, ≥20% → WARNING
- **예산 초과**: actual > budget×1.1 → CRITICAL
- **집계**: serviceId:category 키로 월별 정렬 관리

## §R487 AutoSecurityAuditReporterV2

- **탐지 패턴**: 로그인 실패 5회+→HIGH, 권한 상승→CRITICAL, C/S 데이터 내보내기→CRITICAL
- **고위험 사용자**: CRITICAL/HIGH 이벤트 3건+ 사용자
- **위협 레벨**: CRITICAL > HIGH > MEDIUM > LOW 우선순위

## §R488 OrgStructureOptimizerAI

- **MERGE**: headCount≤3 + 중복 부서 존재
- **SPLIT**: 1인당 taskCount≥5 + avgTaskDuration≥10일
- **OUTSOURCE**: SUPPORT 부서 headCount≥10
- **중복 클러스터**: overlapDepts 기반 방문 집합 구성

## §R489 SLAViolationPreventerV2

- **가용성**: 목표 미달→CRITICAL, 목표-0.5%~목표→WARNING
- **응답 시간**: maxMs 초과→CRITICAL, maxMs×0.8 초과→WARNING
- **오류율**: 5% 초과→CRITICAL
- **패널티**: CRITICAL 알림 수 × penaltyPerViolationKrw

## §R490 PublicAdminLanguageCorrectorV3

- **JARGON**: 12개 행정 전문 용어 매핑 (CITIZEN→REQUIRED, GOVERNMENT→RECOMMENDED)
- **FOREIGN_TERM**: 8개 외래어 매핑 (CITIZEN 대상만 적용)
- **PASSIVE_VOICE**: `~되어집니다/있습니다` 패턴 탐지
- **가독성 점수**: 100 - REQUIRED×10 - RECOMMENDED×3

## §R491 ServiceMeshSecurityAIV2

- **MISSING_MTLS**: mtlsEnabled=false → CRITICAL
- **CERT_EXPIRY**: ≤7일 → CRITICAL, ≤30일 → HIGH
- **OPEN_EGRESS**: egressRules.length=0 + ingressPolicies>0 → HIGH
- **EXCESSIVE_PERMISSIONS**: ingressPolicies≥10 → MEDIUM
- **준수 점수**: 100 - (비준수/전체)×100

## §R492 IntelligentFaultIsolatorV2

- **탐지 임계값**: LATENCY>2000ms, ERROR_RATE>5%, MEMORY>90%, CPU>85%
- **격리 전략**: LATENCY/ERROR_RATE→CIRCUIT_BREAK, MEMORY_LEAK→RESTART, CPU_SPIKE→SCALE_OUT, NETWORK_PARTITION→FAILOVER, DB_CONNECTION→THROTTLE
- **복구 예상 시간**: CIRCUIT_BREAK=30s, THROTTLE=10s, FAILOVER=60s, SCALE_OUT=120s, RESTART=45s

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-13 | 최초 작성 | ai-impl-b |
