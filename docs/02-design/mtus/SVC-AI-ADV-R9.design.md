# SVC-AI-ADV R295~R303 Design — 트랙 A 9차

> **Plan 참조**: `docs/01-plan/mtus/SVC-AI-ADV-R9.plan.md`
> **작성일**: 2026-04-13
> **작성자**: ai-impl-a
> **버전**: 1.0.0

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 공공기관 SaaS 플랫폼 AI 고급 서비스 9차 설계 |
| WHO | AI 서비스 개발팀 |
| RISK | N2SF 데이터 등급 미검사, PII 감사 로그 노출 |
| SUCCESS | CSAP D-06/D-08/D-09/D-12 준수, TypeScript strict 0 오류 |
| SCOPE | R295~R303 9개 모듈 설계 |

---

## R295: PublicServiceKpiAutomator

- UP 방향: achievementRate = (currentValue / target) × 100
- DOWN 방향: achievementRate = (target / currentValue) × 100 (min 100)
- ≥100% → ON_TRACK, ≥80% → AT_RISK, <80% → CRITICAL
- RISING/FALLING/FLAT 트렌드: 최근 3개 측정값, 5% 임계값

---

## R296: CloudMigrationPlannerAi

- C/S 등급 → K3S_ON_PREMISE 강제, blocker 생성
- LEGACY → REFACTOR (컨테이너화 필요)
- 대형(CPU≥8 or mem≥32GB) → REPLATFORM, HYBRID
- 기타 → REHOST, K3S_ON_PREMISE
- 의존성 수 × 3일 추가 effort

---

## R297: AutoDataClassifierV2

| 패턴 | 등급 | 신뢰도 |
|------|------|--------|
| SSN (\d{6}-[1-4]\d{6}) | C | 0.98 |
| BANK_ACCOUNT (\d{10,16}) | C | 0.85 |
| PASSPORT ([A-Z]{1,2}\d{7,9}) | C | 0.92 |
| PHONE (0[1-9]\d{7,9}) | S | 0.90 |
| EMAIL ([^\s@]+@...) | S | 0.95 |
| NAME (한글 2~4자) | S | 0.70 |

- 최고 등급 우선 (C > S > O)

---

## R298: SecurityComplianceAutoCorrector

- autoFixable=true + 규칙 매핑 존재 → FIXED
- autoFixable=false → PENDING_MANUAL
- 규칙 매핑 없음 → FAILED
- 미교정 감점: CRITICAL×25 / HIGH×15 / MEDIUM×8 / LOW×3

---

## R299: ServiceCatalogRecommenderAi

- 조직유형 일치: +30
- 선호 카테고리 일치: +25
- usageCount≥100: +20
- avgRating≥4.5: +15
- topN 정렬, 이미 사용 중 서비스 제외

---

## R300: EmployeeCompetencyAnalyzerAi

- gap = requiredLevel - currentScore
- gap≥2 → HIGH, gap≥1 → MEDIUM, else LOW
- currentScore ≥ requiredLevel+1 → strengths
- 감사 로그: 실명 마스킹 (첫 글자 + *)

---

## R301: SecurityTestGeneratorAi

- 문자열 필드 → SQL_INJECTION(CRITICAL) + XSS(HIGH)
- authRequired=true → AUTH_BYPASS(CRITICAL)
- GET/PUT/DELETE → IDOR(HIGH)
- sensitive 필드 존재 → SENSITIVE_EXPOSURE(HIGH)

---

## R302: RealtimeThreatIntelligenceAi

- PRIVILEGE_ESC: 70점 (1건 → CRITICAL)
- MALWARE: 50점
- DATA_EXFIL: 40점
- LATERAL_MOVE: 35점
- ≥70 → CRITICAL / ≥50 → HIGH / ≥30 → MEDIUM / ≥10 → LOW / SAFE
- IP 마스킹: x.x.*.* 형식

---

## R303: PublicDataLifecycleManagerAi

- legalHold → LEGAL_HOLD 우선
- 보존기간 만료 → DELETION_PENDING + DELETE
- lastAccess≥90일 or 90일 접근 0 → ARCHIVAL + ARCHIVE
- lastAccess≥30일 → DORMANT + RETAIN
- C등급 삭제 시 Secure Wipe 권고

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-13 | 초기 작성 | ai-impl-a |
