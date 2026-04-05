# MTU-F2: 참조 기반 레이어 Design 문서

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-F2 |
| Phase | Phase 1 Foundation |
| 버전 | 0.1.0 |
| 상태 | Draft |
| 작성일 | 2026-04-05 |
| 작성자 | PM Lead Agent (Claude Code) |
| 관련 Plan | docs/01-plan/mtus/MTU-F2-references.plan.md |
| 관련 Framework Design | docs/02-design/features/public-saas-framework.design.md |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | 프레임워크 전체에서 참조하는 규정/법령의 단일 출처(Single Source of Truth) 확립. 규정 변경 시 이 파일 한 곳만 업데이트하면 전체 반영 |
| **WHO** | CTO/PM/개발자/보안 담당자 -- 규정 원문을 찾는 모든 프레임워크 사용자 |
| **RISK** | N2SF 2026년 하반기 본격 시행 + CSAP-N2SF 제도 통합 진행 중. ISMS-P 2027-07 의무화 확정. 규정 URL 변경 가능성 |
| **SUCCESS** | 규정 12건 이상 인덱스 완비, 용어 32개 이상, 약어 30개 이상, 30초 내 용어 검색 가능 |
| **SCOPE** | `99-references/regulations-index.md` + `99-references/glossary-and-acronyms.md` 2개 파일 |

---

## 1. Overview

### 1.1 설계 목적

본 설계는 MTU-F2 Plan에서 정의한 2개 파일(`regulations-index.md`, `glossary-and-acronyms.md`)의 내부 구조, 2026년 최신 규정 반영 사항, 문서 유형별 섹션 표준(Framework Design 3절) 적용 방법을 구체화합니다.

### 1.2 설계 원칙

- **단일 출처 원칙**: 규정 URL, 버전, 용어 정의는 이 2개 파일에서만 관리. 다른 MTU는 반드시 참조 링크로 연결
- **단방향 참조**: `99-references/`는 프레임워크 최하위 기반 레이어. 어떤 파일도 참조하지 않음 (다른 파일이 이 파일을 참조)
- **감리 친숙도**: 공공기관 표준 용어 사용, 한국어 전용
- **유효성 관리**: 분기 1회 규정 최신 확인 주기 명시

---

## 2. 아키텍처

### 2.1 파일 구조

```
docs/framework/
  99-references/
    regulations-index.md     <-- 규정 인덱스 (매핑 테이블형)
    glossary-and-acronyms.md <-- 용어/약어 사전 (참조형)
```

### 2.2 참조 관계

```
[02-csap/*]  ---------> [99-references/regulations-index.md]
[03-n2sf/*]  ---------> [99-references/regulations-index.md]
[04-audit/*] ---------> [99-references/regulations-index.md]
[모든 MTU]   ---------> [99-references/glossary-and-acronyms.md]

규칙: 99-references/ 내 파일은 다른 파일을 참조하지 않음 (최하위 기반)
```

### 2.3 의존 관계

| 구성 요소 | 의존 대상 | 목적 |
|---------|---------|------|
| regulations-index.md | 외부 규정 원문 (URL) | CSAP/N2SF/ISMS-P/감리기준 최신 정보 |
| glossary-and-acronyms.md | 없음 | 자체 완결 용어 사전 |
| 다른 MTU 전체 | regulations-index.md | 규정 참조 단일 출처 |

---

## 3. 상세 설계

### 3.1 regulations-index.md 설계

**문서 유형**: 매핑 테이블형 (Framework Design 3.6절)

#### 메타데이터 헤더

```markdown
| 항목 | 내용 |
|------|------|
| 문서 ID | REF-INDEX |
| 최종 업데이트 | 2026-04-05 |
| 커버리지 | 14/14 (100%) |
| 자동 검증 | Auditor 에이전트 (매 Phase 완료 시) |
```

#### 규정 목록 (14건 -- Plan 12건 + 2026 신규 2건)

| REF ID | 규정명 | 발행 기관 | 최신 버전 | 비고 |
|--------|-------|---------|---------|------|
| REF-01 | CSAP 표준등급 기준 | KISA | 2023 개정 | 2026 상반기 N2SF 통합 개편 예정 |
| REF-02 | CSAP 중요(상)등급 기준 | KISA | 2023 개정 | 동일 |
| REF-03 | N2SF 보안가이드라인 | 국가정보원 | v1.0 (2025-09) | 260여개 통제항목. 2026 하반기 본격 시행 |
| REF-04 | 정보시스템 감리기준 | 행정안전부 | 고시 제2023-1호 | |
| REF-05 | ISMS-P 인증 기준 | KISA | 2023 | 2027-07 의무화 확정 |
| REF-06 | 개인정보 보호법 | 개인정보보호위원회 | 2023 개정 | |
| REF-07 | 클라우드컴퓨팅법 | 과학기술정보통신부 | 2023 | |
| REF-08 | 전자정부법 | 행정안전부 | 2024 개정 | |
| REF-09 | 공공기관 정보보안 지침 | 행정안전부 | 2024 | |
| REF-10 | NIST SP 800-53 Rev.5 | NIST | 2020 | OSCAL 매핑 기반 |
| REF-11 | NIST OSCAL 명세 | NIST | 1.1.2 | |
| REF-12 | OWASP Top 10 | OWASP | 2021 | |
| REF-13 | N2SF CSK 2025 발표 자료 | 국가정보원 | 2025-09 | 보안통제 176개 -> 260여개 확장 |
| REF-14 | CSAP-N2SF 제도 통합 방안 | 과학기술정보통신부 | 2025-12 | 2026 상반기 법령 개정 착수 |

#### 필수 필드 (각 규정 항목)

| 필드 | 설명 | 예시 |
|------|------|------|
| REF ID | 고유 식별자 | REF-01 |
| 규정명 | 공식 명칭 (한글) | CSAP 보안인증 기준 (표준등급) |
| 영문 표기 | 영문 공식명 | Cloud Security Assurance Program |
| 발행 기관 | 주관 기관명 | KISA |
| 최신 버전/고시 | 현재 유효 버전 | 2023 개정 |
| 시행일 | 현재 유효한 시행일 | 2023-XX-XX |
| URL | 원문 접근 URL | https://isms.kisa.or.kr |
| 프레임워크 적용 영역 | 관련 MTU 목록 | MTU-C1~C3, MTU-A5 |
| 유효성 확인 주기 | 규정 변경 확인 주기 | 분기 1회 |
| 비고 | 향후 개정 예고 등 | 2026 상반기 N2SF 통합 예정 |

#### 유효성 관리 섹션

- 분기 1회 전체 규정 URL 유효성 점검
- 규정 개정 시 즉시 업데이트 + CHANGELOG.md 기록
- N2SF/CSAP 제도 통합 시 대규모 업데이트 필요 (2026 하반기 예상)

### 3.2 glossary-and-acronyms.md 설계

**문서 유형**: 참조형 (별도 유형, 프레임워크 기반)

#### 메타데이터 헤더

```markdown
| 항목 | 내용 |
|------|------|
| 문서 ID | REF-GLOSSARY |
| 최종 업데이트 | 2026-04-05 |
| 용어 수 | 35개 |
| 약어 수 | 35개 |
```

#### 용어 정의 섹션 (35개 -- Plan 32개 + 3개 추가)

Plan에서 정의한 G-01~G-32 용어에 다음 3개 추가:

| 번호 | 한글 용어 | 영문 표기 | 근거 |
|------|---------|---------|------|
| G-33 | 보안적합성 검증 | Security Conformity Verification | 2026 CSAP-N2SF 통합으로 추가 |
| G-34 | 예비심사 | Preliminary Audit | ISMS-P 2027 의무화 신규 제도 |
| G-35 | 보안통제 항목 | Security Control Item | N2SF v1.0 260여개 통제항목 용어 |

#### 약어 목록 섹션 (35개 -- Plan 30개 + 5개 추가)

추가 약어:

| 약어 | 원문 | 한글 의미 |
|------|------|---------|
| CSK | Cyber Summit Korea | 글로벌 사이버안보 행사 |
| GGUF | GPT-Generated Unified Format | 경량 LLM 모델 형식 |
| OPA | Open Policy Agent | 범용 정책 엔진 |
| OTel | OpenTelemetry | 관찰성 표준 프레임워크 |
| RTO/RPO | Recovery Time/Point Objective | 복구 목표 시간/시점 |

#### 필수 필드 (각 용어 항목)

| 필드 | 설명 |
|------|------|
| 번호 | G-XX 형식 |
| 한글 용어 | 공공기관 표준 한글 명칭 |
| 영문 표기 | 영문 공식명 |
| 정의 | 1~2문장 명확한 정의 |
| 관련 규정 | REF-XX 참조 ID |

---

## 4. 품질 기준 (Q-Gate 매핑)

| Q-Gate | 검사 항목 | MTU-F2 적용 기준 |
|--------|---------|----------------|
| G1 | FR ID 전수 | FR-0.4, FR-0.5 매핑 확인 |
| G2 | 설계 완전성 | 매핑 테이블형 필수 섹션 4개 + 참조형 필수 섹션 완비 |
| G3 | 참조 링크 유효성 | 외부 URL 14개 접근 가능 |
| G5 | ID 형식 준수 | REF-XX, G-XX 형식 오류 0개 |
| G7 | 감사 추적 | audit.jsonl에 파일 생성 기록 |

---

## 5. 테스트 계획

| TS ID | 테스트 목적 | 테스트 방법 | 성공 기준 |
|-------|-----------|-----------|---------|
| TS-F2-01 | 용어 검색 속도 | 목차(가나다순) 확인 + "N2SF" 검색 | 30초 이내 |
| TS-F2-02 | CSAP 원문 URL 확인 | REF-01 행에서 URL 클릭 | 1분 이내 |
| TS-F2-03 | 규정 14건 완비 | REF-01~REF-14 전수 확인 | 14/14 = 100% |
| TS-F2-04 | 용어 35건 완비 | G-01~G-35 전수 확인 | 35/35 = 100% |
| TS-F2-05 | 약어 35건 완비 | 알파벳순 약어 목록 전수 확인 | 35/35 = 100% |

---

## 6. 구현 가이드

### 6.1 구현 순서

1. `docs/framework/99-references/` 디렉토리 생성
2. `regulations-index.md` 작성 (기반 레이어이므로 최우선)
3. `glossary-and-acronyms.md` 작성
4. 두 파일 상호 참조 없음 확인 (최하위 기반 원칙)
5. Reviewer 검증: 필수 섹션/ID 형식
6. Auditor 검증: G1, G2, G5

### 6.2 Session Guide

| 세션 | 대상 | 예상 소요 |
|------|------|---------|
| Session 1 (본 MTU) | regulations-index.md + glossary-and-acronyms.md | 1 세션 |

단일 세션으로 2개 파일 모두 완료합니다.

---

## 7. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 최초 작성 -- 2026 최신 규정 반영 (N2SF v1.0, ISMS-P 의무화, CSAP-N2SF 통합) | PM Lead Agent |
