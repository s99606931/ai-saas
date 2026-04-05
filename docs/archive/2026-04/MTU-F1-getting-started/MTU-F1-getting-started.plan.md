# MTU-F1: Getting Started 레이어

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-F1 |
| Phase | Phase 1 Foundation |
| 상태 | Draft |
| 작성일 | 2026-04-05 |
| FR 매핑 | FR-0.1, FR-0.2, FR-0.3 |
| 의존 MTU | MTU-F2 (완료 후 참조 링크 삽입) |
| 예상 세션 | 1 세션 |

---

## 목적

공공기관 SaaS 프레임워크 진입점. 사용자가 15분 이내에 전체 구조를 파악하고 자신의 역할에 맞는 파일로 즉시 이동할 수 있어야 합니다.

---

## 산출물 파일 (3개)

| 파일 | 문서 유형 | 핵심 내용 |
|------|---------|---------|
| `00-getting-started/README.md` | 진입점 | 프레임워크 전체 구조 + 역할별 진입점 표 |
| `00-getting-started/quick-start.md` | 구현 가이드형 | 역할별 3가지 15분 경로 |
| `00-getting-started/prerequisites.md` | 체크리스트형 | WSL2 + k3s + Gitea 사전 요건 |

---

## 기능 요구사항

| ID | 요구사항 | 수용 기준 |
|----|---------|---------|
| FR-0.1 | 신규 사용자 15분 경로 | CTO/PM/개발자 3가지 역할별 경로 완비 |
| FR-0.2 | 프레임워크 구조 개요 | 모듈 7개 + 신규 ISMS-P, Policy as Code 포함 |
| FR-0.3 | 사전 요건 체크리스트 | WSL2 / k3s / Gitea / Claude Code 요건 |

---

## 역할별 진입점 설계

| 역할 | 목표 | 첫 번째 파일 |
|------|------|-----------|
| CTO/팀장 | 프레임워크 전체 파악 | README.md |
| PM/기획자 | CSAP 인증 준비 | `02-csap/simple-grade/checklist-simple.md` |
| 개발자 | 개발 환경 구성 | `07-infra/k3s-wsl2/cluster-setup-recipe.md` |
| 감리 담당 | 산출물 준비 | `06-audit-compliance/templates/T01-business-plan.md` |
| 보안 담당 | CSAP/N2SF 확인 | `02-csap/standard-grade/checklist-master.md` |

---

## 합격 기준 (Acceptance Criteria)

1. 신규 사용자(비전문가)가 README.md 읽고 15분 내 본인 역할의 첫 파일 찾을 수 있음
2. 역할별 최소 3개 이상 진입점 경로 존재
3. 68개 산출물 파일 목록 링크 완비
4. CC 하네스(CLAUDE.md) 존재 및 7단계 Q-Gate 설명 포함
5. 변경 이력 섹션 존재

---

## 테스트 시나리오

**TS-F1-01**: 공공기관 SaaS 신규 진출 기업 PM이 README.md를 읽고 CSAP 체크리스트 파일 경로를 찾는 데 걸리는 시간 < 15분

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 최초 작성 | Claude Code |
