# MTU-F1: Getting Started 레이어 Design 문서

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-F1 |
| Phase | Phase 1 Foundation |
| 버전 | 0.1.0 |
| 상태 | Draft |
| 작성일 | 2026-04-05 |
| 작성자 | PM Lead Agent (Claude Code) |
| 관련 Plan | docs/01-plan/mtus/MTU-F1-getting-started.plan.md |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | 프레임워크 진입점이 없으면 사용자가 68개 산출물에서 길을 잃음. 15분 이내 역할별 이동 경로 필수 |
| **WHO** | CTO/팀장, PM/기획자, 개발자, 감리 담당, 보안 담당 |
| **RISK** | 파일 경로 오류, 역할별 경로 누락, 미완성 MTU에 대한 링크 깨짐 |
| **SUCCESS** | 신규 사용자 15분 내 역할별 진입점 도달, 68개 산출물 구조 파악 가능 |
| **SCOPE** | `00-getting-started/` 디렉토리 3개 파일 (README.md, quick-start.md, prerequisites.md) |

---

## 1. 설계 개요

### 1.1 설계 목적

프레임워크의 진입점 3개 파일을 작성합니다. 비전문가도 README.md를 읽고 전체 구조를 파악한 후, quick-start.md에서 역할별 15분 경로를 따라가며, prerequisites.md에서 사전 요건을 확인합니다.

### 1.2 산출물 간 관계

```
README.md (진입점)
  ├── quick-start.md (역할별 15분 경로)
  └── prerequisites.md (사전 요건 체크리스트)
```

---

## 2. 파일별 설계

### 2.1 README.md (진입점)

**문서 유형**: 진입점
**핵심 목적**: 프레임워크 전체 구조 한 눈에 파악

**필수 섹션**:

| 섹션 | 내용 |
|------|------|
| 1. 프레임워크 소개 | 공공기관 SaaS 프레임워크 목적, CSAP/N2SF/감리 인증 지원 |
| 2. 프레임워크 구조 | 8개 모듈 전체 맵 (00~07 + 99) |
| 3. 역할별 진입점 | 5개 역할 x 첫 번째 파일 경로 표 |
| 4. Phase 로드맵 | Phase 1~5 요약 + 현재 진행 상태 |
| 5. CC 하네스 | CLAUDE.md 존재 이유, 7단계 Q-Gate 간략 설명 |
| 6. 시작하기 | quick-start.md / prerequisites.md 링크 |
| 7. 변경 이력 | 버전 기록 |

**모듈 맵 (8개 + 참조)**:

| 디렉토리 | 모듈명 | 설명 | Phase |
|---------|--------|------|-------|
| 00-getting-started | 시작하기 | 진입점 + 역할별 경로 | 1 |
| 01-dev-standards | 개발 표준 | 문서 유형 템플릿 + ID 체계 + 코딩 가이드 | 1 |
| 02-csap-simple | CSAP 일반등급 | 일반등급 30항목 체크리스트 + 빠른 시작 | 1 |
| 05-audit-docs | 감리 산출물 | T01~T02 감리 템플릿 | 1 |
| 06-audit-compliance | 감리 T03~T07 | 추가 감리 산출물 (Phase 3) | 3 |
| 07-infra | 인프라 | k3s/WSL2/Gitea/Flux/네트워크 | 2 |
| 06-csap-standard | CSAP 표준등급 | 79항목 체크리스트 + N2SF + ISMS-P | 2 |
| 09-cc-harness | CC 하네스 | 하네스 검증 절차서 | 1 |
| 99-references | 참조 | 규정 인덱스 + 용어 사전 | 1 |

### 2.2 quick-start.md (역할별 15분 경로)

**문서 유형**: 구현 가이드형
**핵심 목적**: 3가지 역할별 15분 최단 경로 제공

**역할별 경로 설계**:

| 경로 | 대상 역할 | 15분 단계 |
|------|---------|---------|
| 경로 A: 경영진 경로 | CTO/팀장 | README -> CSAP 등급 비교표 -> Phase 로드맵 |
| 경로 B: 인증 경로 | PM/기획자/보안 | README -> CSAP 체크리스트 -> 감리 T01 |
| 경로 C: 개발 경로 | 개발자/DevOps | README -> 코딩 가이드 -> 인프라 사전 요건 |

각 경로는 3~5단계로 구성, 각 단계에 소요 시간 표시.

### 2.3 prerequisites.md (사전 요건 체크리스트)

**문서 유형**: 체크리스트형
**핵심 목적**: 프레임워크 사용 전 필수 환경 확인

**체크리스트 영역**:

| 영역 | 항목 | 확인 내용 |
|------|------|---------|
| 운영체제 | WSL2 | Windows 10/11 + WSL2 Ubuntu 22.04+ |
| 컨테이너 | k3s | 경량 Kubernetes v1.28+ |
| 형상관리 | Gitea | 자체 호스팅 Git 서버 + CI/CD |
| AI 도구 | Claude Code | CC v2.1.78+ (ECC 하네스 필수) |
| 편집기 | VS Code | 권장 확장 목록 |

---

## 3. 구현 순서

1. `00-getting-started/README.md` 작성
2. `00-getting-started/quick-start.md` 작성
3. `00-getting-started/prerequisites.md` 작성

---

## 4. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 최초 작성 -- 3개 파일 설계, 역할별 경로 정의 | PM Lead Agent |
