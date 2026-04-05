# 공공기관 SaaS 프레임워크 Design 문서

| 항목 | 내용 |
|------|------|
| Feature ID | public-saas-framework |
| 버전 | 0.1.0 |
| 상태 | Draft |
| 작성일 | 2026-04-05 |
| 작성자 | Claude Code (PDCA Design Phase) |
| 관련 Plan | docs/01-plan/features/public-saas-framework.plan.md |
| 관련 PRD | docs/00-pm/public-saas-framework.prd.md |
| 아키텍처 선택 | Option C — 점진적 강화형 (Progressive Enhancement) |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | 공공기관 SaaS 진입 장벽(CSAP, 감리)을 표준화된 프레임워크로 제거 — 대기업 독점 시장 민주화 |
| **WHO** | Beachhead: 공공 SaaS 첫 진출 중소 IT 기업 CTO/PM/개발자 (10~50인, 연 5억~50억 매출) |
| **RISK** | N2SF 2026년 시행 기준 변경 위험 (High), CSAP 상등급 항목 수 미확정 (Medium) |
| **SUCCESS** | CSAP 79항목 100% 커버, k3s 10분 이내 구성, 감리 1차 통과율 90%+ |
| **SCOPE** | 프레임워크 문서·템플릿·가이드·레시피 (비즈니스 로직 구현 제외) |

---

## 1. Overview

### 1.1 설계 목적

본 문서는 Plan 단계에서 정의된 54개 파일 프레임워크 구조를 **어떻게 작성할 것인가**를 설계합니다.
각 문서의 내부 구조(섹션), 문서 간 참조 방식, CC 에이전트가 생성·검증하는 방법을 명세합니다.

### 1.2 선택된 아키텍처: Option C — 점진적 강화형

```
99-references/     ← 공통 기반 레이어 (법령 원문 인덱스, 용어집)
     ↑ 참조
02-csap/           ← CSAP 원천 레이어 (항목 정의, 구현 가이드)
     ↑ 참조
03-n2sf/           ← CSAP→N2SF 매핑 레이어 (등급 분류, 영역 통제)
     ↑ 참조
08-ai-integration/ ← AI 보안 패턴 레이어 (N2SF 분류 기반 게이트웨이)
     ↑ 참조
06-audit-compliance/ ← 통합 추적성 레이어 (전체 FR↔CSAP↔테스트 매핑)
```

**핵심 원칙**:
- 단방향 참조만 허용 (하위 레이어 → 상위 레이어 참조 금지)
- Plan 54개 파일 구조 100% 유지 (감리관 친숙도 보장)
- `99-references/`는 어디서도 참조받지 않는 최하위 기반
- Auditor 에이전트가 참조 무결성 자동 검증

### 1.3 관련 문서

| 문서 | 경로 | 역할 |
|------|------|------|
| Plan | `docs/01-plan/features/public-saas-framework.plan.md` | 요구사항 원천 |
| PRD | `docs/00-pm/public-saas-framework.prd.md` | 제품 목표 원천 |
| CC 오케스트레이션 PRD | `docs/01-plan/features/cc-orchestration-prd.md` | 하네스 에이전트 설계 원천 |
| CSAP 고시 | KISA 2023년 개정 (외부) | CSAP 79항목 원천 |
| N2SF 가이드라인 | 국가정보원 (외부) | N2SF 6영역 원천 |

---

## 2. 정보 아키텍처 (Information Architecture)

### 2.1 ID 체계 설계

프레임워크 내 모든 항목은 고유 ID를 가집니다.

| ID 유형 | 형식 | 예시 | 설명 |
|---------|------|------|------|
| 기능 요구사항 | `FR-X.Y` | `FR-2.1` | 모듈X, 요구사항Y |
| CSAP 통제항목 | `CSAP-DXX-YY` | `CSAP-D08-03` | 분야XX, 항목YY |
| N2SF 영역 | `N2SF-NXX` | `N2SF-N03` | 영역XX |
| 감리 산출물 | `TX` | `T01` | 감리 산출물 번호 |
| 테스트 시나리오 | `TS-X` | `TS-1` | 테스트 시나리오 번호 |
| CC 요구사항 | `CC-REQ-X` | `CC-REQ-3` | 하네스 요구사항 번호 |

### 2.2 단방향 참조 체계

문서 간 참조는 아래 마크다운 형식만 사용합니다:

```markdown
<!-- 참조 형식 -->
> [참조: 02-csap/standard-grade/checklist-master.md#CSAP-D08-03]
> [참조: 99-references/regulatory-references.md#N2SF-가이드라인]
```

**참조 허용 매트릭스**:

| 참조 방향 | 허용 여부 |
|-----------|----------|
| `02-csap/` → `99-references/` | ✅ 허용 |
| `03-n2sf/` → `02-csap/` | ✅ 허용 |
| `03-n2sf/` → `99-references/` | ✅ 허용 |
| `08-ai-integration/` → `03-n2sf/` | ✅ 허용 |
| `06-audit-compliance/` → 전체 | ✅ 허용 (통합 레이어) |
| `01-dev-standards/` → `02-csap/` | ✅ 허용 |
| `07-infra/` → `02-csap/` | ✅ 허용 |
| `07-operations/` → `07-infra/` | ✅ 허용 |
| 하위 레이어 → 상위 레이어 역참조 | ❌ 금지 |
| 동일 레이어 상호 참조 | ⚠️ 최소화 |

### 2.3 CSAP ↔ N2SF ↔ FR 3방향 매핑 구조

```
FR-2.1 (표준등급 79개 체크리스트)
  └── CSAP-D08-01 ~ CSAP-D08-12 (접근통제 12항목)
        └── N2SF-N02 (인증 영역)
              └── 적용 모듈: 08-ai-integration/, 07-infra/
                    └── 감리 산출물: T04 (상세설계서)
                          └── 테스트: TS-1 (CSAP 체크리스트 검증)
```

이 매핑은 `06-audit-compliance/traceability-matrix.md`에 중앙 관리됩니다.

---

## 3. 문서 유형별 표준 섹션 구조

프레임워크의 54개 파일은 6개 문서 유형으로 분류됩니다.
각 유형마다 표준 섹션 구조를 정의합니다.

### 3.1 체크리스트형 (Checklist) — 8개 파일

적용 파일: `checklist-master.md`, `checklist-simple.md`, `self-diagnosis.md`, `code-review-checklist.md` 등

```markdown
# [문서명]

| 항목 | 내용 |
|------|------|
| 문서 ID | [ID] |
| 버전 | X.Y.Z |
| 최종 수정일 | YYYY-MM-DD |
| 관련 CSAP | [CSAP-DXX-YY] |
| 관련 N2SF | [N2SF-NXX] |

## 1. 적용 범위 및 목적

## 2. 사전 준비 사항

## 3. 체크리스트

| 번호 | 항목 | 구분 | 확인 방법 | 증거 자료 | 결과 |
|------|------|------|----------|---------|------|
| [CSAP-D08-01] | 계정 및 권한 분리 여부 | 필수 | 설정 확인 | 계정 목록 | □ 완료 / □ 미완 / □ 해당없음 |

## 4. 결과 판정 기준

## 5. 관련 문서 참조

> [참조: 99-references/regulatory-references.md#CSAP-고시]

## 6. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 최초 작성 | — |
```

### 3.2 구현 가이드형 (Implementation Guide) — 18개 파일

적용 파일: `D01-policy.md` ~ `D13-public-additional.md`, `cluster-setup-recipe.md`, `setup-guide.md` 등

```markdown
# [도메인명] 구현 가이드

| 항목 | 내용 |
|------|------|
| 문서 ID | [FR ID] |
| 관련 CSAP 분야 | DXX — [분야명] |
| 항목 수 | N개 |
| 적용 환경 | WSL2 Ubuntu 22.04 / k3s v1.28+ |

## 1. 개요 및 목적

## 2. CSAP 해당 항목 목록

| CSAP ID | 항목명 | 중요도 | 대응 방안 요약 |
|---------|--------|--------|--------------|

## 3. 구현 방법 (단계별)

### 3.1 [단계명]

**목적**: ...  
**방법**: ...  
**확인**: ...

```bash
# 예시 명령어 (해당 시)
```

## 4. 증거 자료 목록

| 항목 | 수집 방법 | 파일 형식 |
|------|----------|---------|

## 5. 자주 발생하는 결함 및 대응

| 결함 유형 | 원인 | 대응 방안 |
|----------|------|---------|

## 6. 관련 문서 참조

> [참조: 02-csap/standard-grade/checklist-master.md#CSAP-DXX]

## 7. 변경 이력
```

### 3.3 절차서형 (Procedure) — 10개 파일

적용 파일: `07-operations/` 전체, `certification-procedure.md`, `defect-response-guide.md` 등

```markdown
# [프로세스명] 절차서

| 항목 | 내용 |
|------|------|
| 문서 ID | [FR ID] |
| 대상 | [역할/담당자] |
| 주기 | [정기/이벤트 기반] |
| 관련 감리 산출물 | [TX] |

## 1. 목적 및 범위

## 2. 역할 및 책임 (RACI)

| 역할 | 책임 항목 |
|------|---------|

## 3. 절차 흐름도 (텍스트 형식)

```
[Step 1: 트리거] → [Step 2: 확인] → [Step 3: 조치] → [Step 4: 기록]
```

## 4. 단계별 상세 절차

### Step 1: [단계명]
- **실행 조건**: ...
- **실행자**: ...
- **조치 내용**: ...
- **완료 기준**: ...

## 5. 체크리스트 (실행 시 사용)

## 6. 이력 관리

## 7. 관련 문서 참조
```

### 3.4 아키텍처 레퍼런스형 (Architecture Reference) — 7개 파일

적용 파일: `architecture-patterns.md`, `grade-c-architecture.md`, `security-gateway-pattern.md` 등

```markdown
# [아키텍처명] 레퍼런스

| 항목 | 내용 |
|------|------|
| 문서 ID | [FR ID] |
| 적용 등급 | [C/S/O / 간편/표준/상] |
| N2SF 연관 영역 | [N2SF-NXX] |
| 적용 환경 | WSL2 + k3s |

## 1. 아키텍처 개요

## 2. 컴포넌트 구성도 (텍스트 다이어그램)

```
[컴포넌트A] ──── [컴포넌트B]
     │
     └──── [컴포넌트C]
```

## 3. 보안 통제 포인트

| 통제 포인트 | 적용 기술 | CSAP 항목 | N2SF 영역 |
|------------|---------|---------|---------|

## 4. 배포 구성 (k3s 기반)

## 5. 한계 및 주의사항

## 6. 관련 문서 참조
```

### 3.5 템플릿형 (Audit Template) — 6개 파일

적용 파일: `T01-business-plan.md` ~ `T06-test-result.md`

```markdown
# [감리 산출물명] 템플릿

> **산출물 ID**: TX
> **감리 기준**: 행정안전부 고시 제2023-1호 [조항]
> **작성 기준**: [해당 감리 단계] 완료 전 제출
> **감리관 확인**: [ ] 완료

---
<!-- 이 줄 아래부터 프로젝트별 실제 내용 작성 -->

## 문서 기본 정보

| 항목 | 내용 |
|------|------|
| 과제명 | [프로젝트명] |
| 발주기관 | [기관명] |
| 수행기관 | [업체명] |
| 문서 버전 | 0.1.0 |
| 작성일 | YYYY-MM-DD |
| 작성자 | [성명] |

## [산출물 본문 섹션]

## 변경 이력 (감리 필수)

| 버전 | 일자 | 변경 내용 | 작성자 | 감리관 확인 |
|------|------|---------|--------|----------|
```

### 3.6 매핑 테이블형 (Mapping Table) — 5개 파일

적용 파일: `traceability-matrix.md`, `csap-to-n2sf-mapping.md`, `regulatory-references.md` 등

```markdown
# [매핑명] 테이블

| 항목 | 내용 |
|------|------|
| 문서 ID | [ID] |
| 최종 업데이트 | YYYY-MM-DD |
| 커버리지 | X/Y (XX%) |
| 자동 검증 | Auditor 에이전트 (매 Phase 완료 시) |

## 1. 매핑 현황 요약

| 항목 | 전체 | 매핑 완료 | 미매핑 | 커버리지 |
|------|------|---------|--------|--------|

## 2. 상세 매핑 테이블

| [원천 ID] | [원천명] | [대상 ID] | [대상명] | [산출물] | [테스트] | 상태 |
|-----------|---------|---------|--------|--------|--------|------|

## 3. 미매핑 항목 처리 계획

## 4. 변경 이력
```

---

## 4. 모듈별 상세 설계

### 4.1 Module 0: Getting Started

**목적**: 프레임워크 첫 진입점. 15분 내 방향 파악 보장.

| 파일 | 필수 섹션 | 핵심 내용 |
|------|---------|---------|
| `README.md` | 프레임워크 구조, 사용 방법, 빠른 참조 | 디렉토리 구조 + 역할별 진입점 표 |
| `quick-start.md` | 준비사항 체크, 첫 번째 파일, 15분 경로 | 역할별 3가지 경로: CSAP 준비 / 감리 준비 / k3s 구성 |
| `prerequisites.md` | 하드웨어, 소프트웨어, 지식 요건 | WSL2 체크리스트, k3s 설치 전 확인 항목 |

**설계 포인트**:
- `README.md`는 다른 어떤 파일도 참조받지 않음 (진입점 전용)
- 역할별 진입점 표로 CTO/PM/개발자가 각자 필요한 파일로 바로 이동 가능

### 4.2 Module 1: 개발 표준 가이드라인

**문서 유형**: 구현 가이드형 (§3.2)

| 파일 | 참조 | 핵심 설계 결정 |
|------|------|--------------|
| `coding-standards.md` | `02-csap/standard-grade/D12-dev-security.md` | CSAP D-12 (시스템 개발 보안) 기준 TypeScript/Python 코딩 규칙 |
| `architecture-patterns.md` | `03-n2sf/grade-classification-guide.md` | N2SF 등급별 아키텍처 패턴 카탈로그 (C/S/O 3개 섹션) |
| `code-review-checklist.md` | `coding-standards.md` | 체크리스트형, CSAP D-12 항목을 PR 체크리스트로 변환 |
| `secure-coding-guide.md` | `02-csap/standard-grade/D12-dev-security.md` | OWASP Top10 × CSAP D-12 교차 매핑 실무 가이드 |

### 4.3 Module 2: CSAP 인증 지원

**이 모듈이 전체 프레임워크의 원천 레이어.**

#### 간편등급 (Phase 1)

| 파일 | 핵심 설계 결정 |
|------|--------------|
| `checklist-simple.md` | 31개 항목 × 체크리스트형. 항목별 `[CSAP-간편-XX]` ID 부여 |
| `implementation-guide.md` | 구현 가이드형. 31개 항목을 7개 분야로 그룹핑하여 설명 |

#### 표준등급 (Phase 2)

| 파일 | 핵심 설계 결정 |
|------|--------------|
| `checklist-master.md` | **전체 프레임워크의 핵심 파일**. 79개 항목 전수, `[CSAP-DXX-YY]` ID 부여. 다른 모듈이 이 ID를 참조 |
| `self-diagnosis.md` | 체크리스트형. `checklist-master.md`의 항목을 셀프 평가 형식으로 재구성 |
| `D01-policy.md` ~ `D13-public-additional.md` | 구현 가이드형 (분야별 1파일). 각 파일이 `checklist-master.md#CSAP-DXX` 참조 |
| `certification-procedure.md` | 절차서형. KISA 인증 신청 → 심사 → 획득 단계별 절차 |

**CSAP ID 설계**:
```
CSAP-D08-03
  │    │   └── 항목 번호 (01~99)
  │    └────── 분야 번호 (D01~D13)
  └─────────── CSAP 표준등급 식별자
```

#### 상등급 (Phase 3)

| 파일 | 핵심 설계 결정 |
|------|--------------|
| `additional-requirements.md` | 표준등급 체크리스트 참조 + 상등급 추가 항목 (KISA 확정 후 기입) |

### 4.4 Module 3: N2SF 보안체계

**이 모듈은 `02-csap/`를 참조하는 두 번째 레이어.**

| 파일/디렉토리 | 핵심 설계 결정 |
|-------------|--------------|
| `grade-classification-guide.md` | 아키텍처 레퍼런스형. C/S/O 판단 플로우차트 (텍스트). N2SF 시행 일정 포함 |
| `N01-authority.md` ~ `N06-assets.md` | 구현 가이드형. 각 영역별 CSAP 항목 매핑 테이블 + 통제 구현 방법 |
| `csap-to-n2sf-mapping.md` | 매핑 테이블형. **79항목 × 6영역 전수 매핑**. 추적성 매트릭스 원천 |
| `grade-c-architecture.md` | 아키텍처 레퍼런스형. C등급 k3s 배포 구성도 |
| `grade-s-architecture.md` | 아키텍처 레퍼런스형. S등급 (망분리 고려) 배포 구성도 |
| `grade-o-architecture.md` | 아키텍처 레퍼런스형. O등급 (개방형) 최소 보안 배포 구성도 |

**N2SF ID 설계**:
```
N2SF-N03
  │    └── 영역 번호 (N01~N06)
  └──────── N2SF 식별자
```

### 4.5 Module 4: 감리 대응

**이 모듈은 전체 프레임워크의 통합 추적성 레이어. 모든 모듈을 참조.**

#### 감리 산출물 템플릿 (T01~T06)

| 파일 | 감리 단계 | 주요 섹션 설계 |
|------|---------|--------------|
| `T01-business-plan.md` | 착수 | 사업 배경, 추진 전략, 산출물 목록, 일정, 보안 계획 |
| `T02-requirements.md` | 분석 | FR/NFR 목록, 우선순위, CSAP 요건 정의, N2SF 등급 선언 |
| `T03-design-basic.md` | 설계 (기본) | 시스템 구성도, 데이터 흐름, 보안 아키텍처, CSAP 설계 반영 |
| `T04-design-detail.md` | 설계 (상세) | 컴포넌트별 상세 설계, API 명세, DB 스키마, 접근통제 설계 |
| `T05-test-plan.md` | 시험 계획 | 시험 범위, 시험 유형(단위/통합/보안), CSAP 항목별 시험 방법 |
| `T06-test-result.md` | 시험 결과 | 시험 실행 결과, 결함 목록, 재시험 결과, CSAP 충족 여부 |

#### 추적성 매트릭스 (T07)

`traceability-matrix.md`는 4방향 매핑을 단일 파일로 관리:

```
FR-2.1 | 표준등급 79개 체크리스트 | checklist-master.md | TS-1 | CSAP-D08-01~12 | T04 | 완료
FR-3.1 | C/S/O 분류 가이드      | grade-classification-guide.md | TS-3 | N2SF-N01~N06 | T02 | 완료
...
```

**설계 포인트**: 이 파일은 Phase 완료 시마다 Auditor 에이전트가 자동 업데이트.

#### 감리 체크리스트 (5종)

`audit-checklist/` 내 파일은 감리 단계별(착수→분석→설계→구현→시험) 감리관 체크포인트 목록.
각 체크포인트는 `T01~T06` 및 `FR` ID와 연결.

### 4.6 Module 5: 기술 인프라

**이 모듈은 `02-csap/`와 `03-n2sf/`를 참조하는 실습형 가이드.**

| 파일/디렉토리 | 핵심 설계 결정 |
|-------------|--------------|
| `cluster-setup-recipe.md` | 구현 가이드형. **10분 이내 k3s 설치** 목표. 명령어 복붙 가능한 코드블록 전용 구성 |
| `scripts/` | bash 스크립트 3개 (install-k3s.sh, setup-monitoring.sh, reset-k3s.sh) |
| `setup-guide.md` | 구현 가이드형. Gitea 설치 + 초기 설정 + Gitea Actions 활성화 |
| `build.yml` / `test.yml` / `deploy.yml` | CI/CD 파이프라인 템플릿. CSAP D-12 준수 파이프라인 |
| `container-security-baseline.md` | 체크리스트형. CIS Kubernetes Benchmark × CSAP-D11 매핑 |
| `network-security.md` | 아키텍처 레퍼런스형. k3s 네트워크 보안 구성, TLS 설정 |
| `monitoring-logging.md` | 구현 가이드형. Prometheus/Grafana + 감사로그 적재 구성 |

**k3s 설치 스크립트 설계**:
```bash
# install-k3s.sh 핵심 구조
# 1. 사전 요건 체크 (WSL2 확인, 메모리, 디스크)
# 2. k3s 설치 (INSTALL_K3S_VERSION 고정)
# 3. CSAP D-11 보안 설정 적용 (--disable traefik, TLS 설정)
# 4. 설치 검증 (kubectl get nodes)
# 총 실행 시간 목표: 10분 이내
```

### 4.7 Module 6: AI 서비스 연동

**이 모듈은 `03-n2sf/` 등급 분류를 기반으로 AI 보안 패턴을 정의하는 최상위 레이어.**

| 파일 | 핵심 설계 결정 |
|------|--------------|
| `security-gateway-pattern.md` | 아키텍처 레퍼런스형. N2SF 등급 분류 → AI API 허용/차단 결정 트리 |
| `data-classification-masking.md` | 구현 가이드형. C등급 차단 / S등급 차단 / O등급 마스킹 후 허용 로직 |
| `mcp-integration-guide.md` | 구현 가이드형. MCP 서버 구성 + 공공시스템 연동 패턴 |
| `lmstudio-guide.md` | 아키텍처 레퍼런스형. **LM Studio** 설치·설정·모델 로드 + WSL2 접근 패턴 |
| `lmstudio-client-examples.md` | 구현 가이드형. Python/TypeScript 클라이언트 코드 예시 (`host.docker.internal:1234`) |
| `claude-api-guide.md` | 구현 가이드형. Claude API 연동 + 보안 게이트웨이 통과 예시 코드 |
| `fallback-patterns.md` | 아키텍처 레퍼런스형. AI API 장애 시 수동 전환 패턴 3가지 |

**AI 보안 게이트웨이 핵심 설계**:
```
요청 → [N2SF 등급 분류] ─→ C/S등급? → [LM Studio 라우팅] → host.docker.internal:1234
                        └→ O등급?  → [PII 마스킹] → [Claude API 호출] → [응답 검증] → 반환
```

**LM Studio 아키텍처 (온프레미스 LLM)**:
```
Windows 호스트: LM Studio (localhost:1234, GGUF 모델)
     ↑ host.docker.internal:1234
WSL2/k3s: AI 보안 게이트웨이 → C/S등급 요청만 전달
```

지원 모델: Llama 3.1 8B, Mistral 3 7B, Gemma 2 9B, Phi-3 Mini, DeepSeek Coder 6.7B (GGUF 형식)

### 4.8 Module 7: 운영 가이드

**절차서형 전용 모듈.**

| 파일 | 핵심 내용 | CSAP 연결 |
|------|---------|---------|
| `deployment-procedure.md` | k3s 배포 → 검증 → 롤백 절차 | CSAP-D12 (배포 보안) |
| `incident-response.md` | 침해 탐지 → 격리 → 복구 → 보고 | CSAP-D06 (침해사고 관리) |
| `backup-recovery.md` | 백업 주기, 복구 RTO/RPO, 검증 절차 | CSAP-D07 (재해복구) |
| `performance-management.md` | 모니터링 임계값, 튜닝 절차 | NFR-3 (성능) |
| `change-management.md` | 변경 요청 → 승인 → 적용 → 검증 4단계 | CSAP-D04 (자산관리) |

---

## 5. CC 하네스 통합 설계

### 5.1 Cascade 워크플로우 (문서 생성 시)

```
Implementer 에이전트
  ├── Plan 파일 목록 확인 (FR ID 매핑)
  ├── 해당 문서 유형 템플릿 적용 (§3)
  ├── 단방향 참조 삽입 (§2.2)
  └── Design Ref 주석 삽입
        // Design Ref: §4.3 — CSAP-D08 참조 필수

Reviewer 에이전트 (AgentShield 102규칙)
  ├── 필수 섹션 완비 여부 (각 유형별 §3 기준)
  ├── ID 형식 준수 (CSAP-DXX-YY, N2SF-NXX 등)
  └── 변경 이력 섹션 존재 여부

Auditor 에이전트 (Opus)
  ├── Q-GATE G1: FR ID 전수 확인 (누락 FR 검출)
  ├── Q-GATE G2: 단방향 참조 무결성 검증
  ├── Q-GATE G6: Phase별 CSAP 항목 커버리지
  ├── Q-GATE G7: traceability-matrix.md 자동 업데이트
  └── audit.jsonl 기록
```

### 5.2 Auditor 에이전트 자동 검증 항목

Phase 완료 시 Auditor가 다음을 자동 검증합니다:

| 검증 항목 | 방법 | 실패 시 |
|---------|------|--------|
| 참조 무결성 | `[참조: path]` 링크 경로 실존 확인 | Reviewer BLOCKED 상태 전환 |
| FR 커버리지 | Plan FR 목록 × 생성 파일 1:1 매핑 | 미생성 파일 목록 리포트 |
| CSAP ID 일관성 | `CSAP-DXX-YY` 형식 정규식 검증 | 형식 오류 항목 리포트 |
| 변경 이력 존재 | 모든 파일 마지막 섹션 확인 | 누락 파일 리포트 |
| 추적성 매트릭스 완결성 | 미매핑 항목 수 0 확인 | 미매핑 항목 리포트 |

### 5.3 모델 라우팅 설계

| 작업 | 에이전트 | 모델 | 근거 |
|------|---------|------|------|
| 문서 초안 작성 | Implementer | claude-sonnet-4-6 | 긴 문서 생성, 200K 컨텍스트 |
| 섹션 구조 검토 | Reviewer | claude-sonnet-4-6 | 코드리뷰 수준 검토 |
| CSAP/N2SF 준수 분석 | Auditor | claude-opus-4-6 | 복합 규제 매핑 분석 |
| 체크리스트 항목 채우기 | Implementer | claude-sonnet-4-6 | 반복적 항목 생성 |
| 참조 링크 수정 | Refactorer | claude-haiku-4-5 | 단순 경로 수정 |

### 5.4 파일 생성 순서 (의존성 기반)

```
Phase 1 (의존성 없음 — 먼저 생성):
  1. 99-references/regulatory-references.md    ← 기반 레이어
  2. 99-references/glossary.md
  3. 02-csap/simple-grade/checklist-simple.md  ← CSAP 원천 (간편)
  4. 00-getting-started/README.md
  5. 01-dev-standards/*.md (4개)

Phase 2 (Phase 1 의존):
  6. 02-csap/standard-grade/checklist-master.md ← CSAP 원천 (표준) ★핵심
  7. 02-csap/standard-grade/D01~D13.md (13개)
  8. 06-audit-compliance/templates/T01~T04.md
  9. 03-n2sf/*.md (전체)
  10. 07-infra/*.md (전체)

Phase 3 (Phase 2 의존):
  11. 08-ai-integration/*.md (6개)
  12. 06-audit-compliance/traceability-matrix.md ← 전체 통합
  13. 06-audit-compliance/defect-response-guide.md
  14. 02-csap/high-grade/additional-requirements.md
  15. 07-operations/*.md (5개)
  16. 03-n2sf/reference-architecture/*.md (3개)
```

---

## 6. 품질 설계 (Q-Gate 매핑)

### 6.1 문서 품질 기준

| Q-Gate | 검사 내용 | 통과 기준 | 담당 에이전트 |
|--------|---------|---------|------------|
| G1 | FR ID 전수 문서 생성 여부 | 미생성 FR 0개 | Auditor |
| G2 | 설계 완전성 (필수 섹션 완비) | 각 유형별 §3 섹션 100% | Auditor |
| G3 | 참조 링크 유효성 | 깨진 링크 0개 | Reviewer |
| G4 | 문서 커버리지 | Phase별 파일 80%+ 완성 | Tester |
| G5 | CSAP ID 형식 준수 | 형식 오류 0개 | Reviewer |
| G6 | CSAP Phase 항목 커버리지 | Phase별 해당 항목 100% | Auditor |
| G7 | 감사 추적 (audit.jsonl) | 모든 문서 생성 기록 | Auditor |

### 6.2 Phase별 완료 기준 (Plan § 12 재확인)

| Phase | 문서 완료 기준 | CC Q-Gate |
|-------|-------------|---------|
| Phase 1 | 17개 파일 (00, 01, 02-simple, 기본 참조) | G1~G3 통과 |
| Phase 2 | 37개 파일 (02-standard, 03, 04-T01~T04, 05) | G1~G6 통과 |
| Phase 3 | 54개 파일 전체 완성 | G1~G7 통과 |
| Phase 4 | 별도 Plan 문서 생성 후 결정 | — |

---

## 7. 비기능 설계

### 7.1 문서 접근성 (NFR-6 기반)

- 모든 마크다운 파일: GitHub Flavored Markdown (GFM) 호환
- 텍스트 다이어그램만 사용 (외부 도구 의존 없음)
- 코드블록: 언어 태그 필수 (`bash`, `yaml`, `typescript`)
- 테이블: ASCII 정렬 (120자 이내)

### 7.2 유지보수성 (NFR-4 기반)

- CSAP 항목 변경 시: `02-csap/standard-grade/checklist-master.md` 한 파일만 수정
- N2SF 기준 변경 시: `03-n2sf/grade-classification-guide.md` + `csap-to-n2sf-mapping.md` 수정
- 참조 체인으로 변경 영향 범위 자동 추적 가능

### 7.3 감리 추적성 (NFR-5 기반)

- 모든 파일: 변경 이력 섹션 필수
- `traceability-matrix.md`: Phase 완료 시 Auditor 자동 업데이트
- 파일 생성/수정 이력: `audit.jsonl` 자동 기록 (CC-REQ-2)

---

## 8. 테스트 계획

### 8.1 테스트 시나리오 매핑 (Plan TS-1~TS-6)

| TS ID | 테스트 목적 | 테스트 방법 | 성공 기준 |
|-------|-----------|-----------|---------|
| TS-1 | CSAP 체크리스트 완성도 | 기술 PM이 checklist-master.md로 자가진단 수행 | 5일 이내 79항목 진단 가능 |
| TS-2 | k3s 구성 재현성 | cluster-setup-recipe.md 따라 WSL2 신규 설치 | 10분 이내 완료 |
| TS-3 | 감리 템플릿 사용성 | T01-business-plan.md로 사업계획서 초안 작성 | 3시간 이내 20페이지 초안 |
| TS-4 | AI 게이트웨이 보안 | security-gateway-pattern.md 기반 C등급 차단 시뮬레이션 | C/S등급 100% 차단 |
| TS-5 | N2SF 등급 분류 | grade-classification-guide.md로 3개 서비스 유형 분류 | 오분류 0건 |
| TS-6 | CSAP↔N2SF 매핑 완결 | csap-to-n2sf-mapping.md 79항목 전수 확인 | 미매핑 0항목 |

### 8.2 문서 품질 자동화 테스트

Tester 에이전트가 실행하는 자동 검증:

```bash
# 참조 링크 무결성 검사
grep -rn "\[참조:" . --include="*.md" | grep -v "99-references" | \
  while read line; do
    path=$(echo $line | grep -oP '(?<=\[참조: )[^#\]]+')
    [ ! -f "$path" ] && echo "BROKEN: $path"
  done

# FR 커버리지 확인
# Plan에서 FR 목록 추출 → 파일 존재 확인
# CSAP ID 형식 검증
grep -rn "CSAP-" . --include="*.md" | grep -vP "CSAP-D\d{2}-\d{2}" && echo "FORMAT ERROR"
```

---

## 9. 구현 가이드

### 9.1 구현 원칙 (Do Phase 적용)

1. **문서 유형 우선 결정**: §3의 6개 유형 중 해당 유형 선택 후 템플릿 적용
2. **의존성 순서 준수**: §5.4 파일 생성 순서 엄격히 따름 (`checklist-master.md` 우선)
3. **ID 부여 즉시**: 파일 생성 즉시 상단 메타데이터에 ID 기입
4. **참조 링크 즉시**: 내용 작성 중 관련 파일 참조 링크 즉시 삽입
5. **변경 이력 필수**: 모든 파일 마지막 섹션에 변경 이력 테이블
6. **Design Ref 주석**: 핵심 설계 결정 부분에 `<!-- Design Ref: §X.X -->` 삽입

### 9.2 Session Guide (Module Map)

다중 세션으로 분할 구현하기 위한 모듈 맵:

| 세션 | 대상 모듈 | 파일 수 | `/pdca do` 명령 |
|------|---------|--------|----------------|
| Session 1 | 기반 레이어 (99-references + 00-getting-started) | 5개 | `--scope session-1` |
| Session 2 | Module 1 개발 표준 | 4개 | `--scope session-2` |
| Session 3 | Module 2 CSAP 간편등급 + 체크리스트 마스터 | 4개 | `--scope session-3` |
| Session 4 | Module 2 CSAP 구현 가이드 D01~D07 | 7개 | `--scope session-4` |
| Session 5 | Module 2 CSAP 구현 가이드 D08~D13 + 기타 | 6개 | `--scope session-5` |
| Session 6 | Module 3 N2SF 전체 | 8개 | `--scope session-6` |
| Session 7 | Module 4 감리 템플릿 T01~T06 + 체크리스트 | 8개 | `--scope session-7` |
| Session 8 | Module 5 인프라 전체 | 8개 | `--scope session-8` |
| Session 9 | Module 6 AI 연동 전체 | 6개 | `--scope session-9` |
| Session 10 | Module 7 운영 + 추적성 매트릭스 + 상등급 | 8개 | `--scope session-10` |

### 9.3 구현 체크포인트

각 세션 완료 시 Auditor 에이전트 실행 필수:

```
세션 완료
  → Reviewer: 구조 검증 (Q-Gate G2, G3, G5)
  → Auditor: 커버리지 + 참조 무결성 (Q-Gate G1, G6)
  → 추적성 매트릭스 업데이트 (Q-Gate G7)
  → 다음 세션 착수 허용
```

---

## 10. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 최초 작성 — Option C (점진적 강화형) 선택 | Claude Code |
