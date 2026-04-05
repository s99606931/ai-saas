# 공공기관 SaaS 프레임워크 — 다음 단계 로드맵

> **기준일**: 2026-04-06
> **기준 상태**: 58 MTU 완료 (Framework 36 + Platform 22)
> **작성자**: PM Agent
> **참조**: docs/roadmap/master-roadmap.md, docs/archive/2026-04/_INDEX.md

---

## Executive Summary

| 항목 | 내용 |
|------|------|
| **완료** | 58 MTU — Framework 문서 36개 + Platform 구현 22개 |
| **품질 미달** | MTU-P04(81.8%), MTU-P11(80%), MTU-P02(88.9%) — 3개 보완 필요 |
| **다음 목표** | UI↔DB 실연동 → 데모 테스트 → CSAP 인증 신청 → ISMS-P 의무화 대응 |
| **데드라인** | ISMS-P 2027-07 의무화 (매출 300억+ 또는 이용자 100만+) |

---

## Phase Q: 품질 완결 (즉시 — 2026 Q2)

> 목표: 모든 완료 MTU 90%+ 달성

| MTU-ID | 현재 | 목표 | 보완 내용 | 우선순위 |
|--------|------|------|---------|---------|
| **MTU-Q1** (API 게이트웨이) | 81.8% | 95%+ | 동적 라우팅 개선, 서비스 헬스체크 능동 감지 | P0 |
| **MTU-Q2** (알림 서비스) | 80% | 90%+ | 웹훅 전송 + 이메일 템플릿 완성 | P0 |
| **MTU-Q3** (사용자 관리) | 88.9% | 95%+ | 벌크 작업, 프로필 이미지 업로드 | P1 |

**완료 기준**: 3개 MTU 전수 90%+ + Q-Gate G3 통과

---

## Phase D: 실제 배포 검증 (2026 Q2 — Phase Q 완료 후)

> 목표: 사용자가 브라우저에서 실DB 데이터 화면 테스트 가능

| MTU-ID | 작업 | 검증 기준 | 완료일 |
|--------|------|---------|--------|
| **MTU-DEP1** | 포털 DB 연동 (Next.js API Routes + Prisma) | 대시보드 실DB 데이터 표시 | 2026-04-06 ✅ |
| **MTU-DEMO1** | 데모 테넌트 + 시드 데이터 | `pnpm prisma db seed` 성공 | 2026-04-06 ✅ |
| **MTU-E2E1** | Playwright E2E 자동 테스트 | 72개 시나리오 95%+ 통과 | 2026-04-06 ✅ |
| **MTU-DEP2** | Docker Compose 전체 서비스 기동 | 15개 서비스 헬스체크 Green | 2026 Q2 |
| **MTU-DEP3** | Gitea CI/CD 파이프라인 실행 | 빌드→테스트→배포 3종 통과 | 2026 Q2 |

**로컬 실행 명령**:
```bash
docker compose up -d          # PostgreSQL + Redis + MinIO
pnpm prisma migrate deploy    # 스키마 적용
pnpm prisma db seed           # 데모 데이터 주입
pnpm --filter @public-saas/portal dev  # 포털 기동 (port 4000)
pnpm playwright test          # E2E 자동 테스트
```

---

## Phase CSAP: 인증 준비 (2026 Q3)

> 목표: CSAP 표준등급 심사 신청

| MTU-ID | 작업 | 검증 기준 |
|--------|------|---------|
| **MTU-CSAP1** | 79항목 실증적 활동 (audit.jsonl 기반) | 증적 79건 전수 완비 |
| **MTU-CSAP2** | 감리 산출물 T01~T07 최종 검토 | 감리관 확인란 100% |
| **MTU-CSAP3** | OSCAL 검증 (`oscal-cli validate`) | Pass |
| **MTU-CSAP4** | 취약점 점검 (정기 점검 반기 1회) | 0 Critical, 0 High |
| **MTU-CSAP5** | 심사 신청 및 현장 심사 대응 | CSAP 표준등급 취득 |

**주요 체크포인트**:
- D-06: 감사 로그 1년 이상 보존 증적
- D-08: 접근 통제 RBAC + MFA 실제 동작 확인
- D-09: AES-256 암호화 + TLS 1.3 통신 암호화 적용
- D-12: OWASP Top 10 취약점 점검 완료

---

## Phase ISMS: 의무화 대응 (2027-07 데드라인)

> 기준: ISMS-P 2027 의무화 (매출 300억+ 또는 이용자 100만+)

| MTU-ID | 작업 | 마감 |
|--------|------|------|
| **MTU-ISMS1** | 101항목 자동 증적 파이프라인 실제 구동 | 2026 Q4 |
| **MTU-ISMS2** | ISMS-P 심사 준비 (인증기관 신청) | 2027 Q1 |
| **MTU-ISMS3** | CSAP ↔ ISMS-P 중복 30개 매핑 증적 통합 | 2027 Q2 |
| **MTU-ISMS4** | ISMS-P 갱신 주기 관리 (3년 주기) | 2027 Q3 |

**2027 타임라인**:
```
2026 Q3: CSAP 심사 신청
2026 Q4: ISMS-P 준비 착수
2027 Q1: ISMS-P 인증기관 계약
2027 Q2: ISMS-P 현장 심사
2027 Q3 (7월): 의무화 발효 전 인증 완료 목표
```

---

## Phase ECO: 에코시스템 (선택, 2026 Q4)

> 목표: 공공기관 확산 및 오픈소스 배포

| MTU-ID | 작업 | 비고 |
|--------|------|------|
| **MTU-ECO1** | GitHub 공개 배포 (FORK-GUIDE.md 활용) | MIT 라이선스 검토 필요 |
| **MTU-ECO2** | Docusaurus 문서 포털 실제 배포 | GitHub Pages or 공공 클라우드 |
| **MTU-ECO3** | 비즈니스 플러그인 샘플 앱 2종 | 전자결재, 공공데이터 연동 |
| **MTU-ECO4** | 공공기관 포크 지원 가이드 현장 적용 | FORK-GUIDE.md 실증 |

---

## 전체 로드맵 타임라인

```
2026-04  ████ Phase Q (품질보완) + Phase D (배포검증) ← 현재 위치
2026 Q2  ████ Phase D 완결 (k3s 실배포 + CI/CD)
2026 Q3  ████ Phase CSAP (인증 신청 + 현장심사)
2026 Q4  ████ Phase ISMS 착수 + Phase ECO (선택)
2027 Q1  ████ Phase ISMS 심사 준비
2027 Q2  ████ Phase ISMS 현장심사
2027 Q3  ████ ISMS-P 인증 완료 (의무화 데드라인 준수)
```

---

## KPI 추적

| KPI | 현재 | 목표 | 측정 방법 |
|-----|------|------|---------|
| MTU 완료율 | 58/60 (97%) | 60/60 | archive _INDEX.md |
| 코드 품질 | 81.8~100% | 전체 90%+ | matchRate 평균 |
| E2E 통과율 | 신규 작성 | 95%+ | Playwright 리포트 |
| CSAP 준비도 | 문서 100% | 심사 신청 | 증적 체크리스트 |
| ISMS-P 준비도 | 101항목 문서화 | 인증 완료 | checklist-101.md |
| 보안 취약점 | 미측정 | 0 Critical | OWASP ZAP / Trivy |

---

## 즉시 실행 가능 작업 (2026-04-06 완료)

| 작업 | 상태 | 결과물 |
|------|------|--------|
| MTU-DEP1: 포털 DB 연동 | ✅ 완료 | API Routes 6개 + DashboardContent 실DB |
| MTU-DEMO1: 데모 시드 | ✅ 완료 | prisma/seed/index.ts (행안부+국토부 테넌트) |
| MTU-E2E1: E2E 테스트 | ✅ 완료 | 72개 시나리오 + DEMO-TEST-GUIDE.md |
| MTU-Q1: API GW 품질 | 진행중 | 90%+ 목표 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 최초 작성 — Phase Q/D/CSAP/ISMS/ECO 정의 | PM Agent |
