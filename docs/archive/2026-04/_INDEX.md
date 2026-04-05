# Archive Index — 2026-04

> 이 폴더는 2026년 4월에 완료된 PDCA 사이클 문서를 보관합니다.

| Feature | 완료일 | 매치율 | 아카이브 경로 |
|---------|------|--------|------------|
| av-skill | 2026-04-05 | 93.6% | `docs/archive/2026-04/av-skill/` |
| **MTU-F2** 참조 기반 레이어 | 2026-04-05 | 100% | `docs/archive/2026-04/MTU-F2-references/` |
| **MTU-F6** CC 하네스 완성도 검증 | 2026-04-05 | 100% | `docs/archive/2026-04/MTU-F6-harness-verify/` |
| **MTU-F1** Getting Started 레이어 | 2026-04-05 | 100% | `docs/archive/2026-04/MTU-F1-getting-started/` |
| **MTU-F4** CSAP 간편등급 | 2026-04-05 | 100% | `docs/archive/2026-04/MTU-F4-csap-simple/` |
| **MTU-F5** 감리 T01~T02 | 2026-04-05 | 100% | `docs/archive/2026-04/MTU-F5-audit-t01-t02/` |
| **MTU-F3** 개발 표준 가이드 | 2026-04-05 | 100% | `docs/archive/2026-04/MTU-F3-dev-standards/` |

## av-skill 요약

- **설명**: Auto-Vibe Plugin Advisor — 자연어 요구사항을 6-의도로 분류하고 bkit/ECC 200개+ 구성요소 자동 선택·실행
- **PDCA 사이클**: PM → Plan → Design → Do (2 sessions) → Check → Report
- **최종 매치율**: 93.6%
- **산출물**: `~/.claude/skills/av/` (SKILL.md + 3개 참조 파일, 36KB)
- **문서**:
  - `av-skill.plan.md` — Plan 문서
  - `av-skill.design.md` — Design 문서 (Option C 아키텍처)
  - `av-skill.report.md` — 완료 보고서

## MTU-F2 참조 기반 레이어 요약

- **설명**: CSAP/N2SF/ISMS-P 외부 규정 인덱스 + 용어·약어 사전
- **PDCA 사이클**: Plan → Design → Do → Check (100%) → Report → Archive
- **최종 매치율**: 100% (6/6 수용 기준 전수 통과)
- **산출물**: `docs/framework/99-references/` (regulations-index.md, glossary-and-acronyms.md)
- **주요 성과**: 2026년 최신 규정 14건, 용어 35개, 약어 37개, 32개 MTU 역참조 매트릭스
- **문서**:
  - `MTU-F2-references.plan.md` — Plan 문서
  - `MTU-F2-references.design.md` — Design 문서
  - `MTU-F2.report.md` — 완료 보고서

## MTU-F6 CC 하네스 완성도 검증 요약

- **설명**: ECC 하네스 5개 에이전트 + Q-Gate G1~G7 검증 절차
- **최종 매치율**: 100% (7/7 수용 기준 통과)
- **산출물**: `docs/framework/07-cc-harness/harness-verification-guide.md`
- **문서**: Plan + Design + Report

## MTU-F1 Getting Started 레이어 요약

- **설명**: 프레임워크 진입점 — README, 빠른 시작, 사전 준비 가이드
- **최종 매치율**: 100% (5/5 수용 기준 통과)
- **산출물**: `docs/framework/00-getting-started/` (README.md, quick-start.md, prerequisites.md)
- **문서**: Plan + Design + Report

## MTU-F4 CSAP 간편등급 요약

- **설명**: CSAP 일반등급 빠른 시작 가이드 + 간편 체크리스트
- **최종 매치율**: 100% (6/6 수용 기준 통과)
- **산출물**: `docs/framework/02-csap-simple/` (quick-start-guide.md, checklist-simple.md)
- **문서**: Plan + Design + Report

## MTU-F5 감리 T01~T02 요약

- **설명**: 행안부 감리기준 T01(사업계획서) + T02(요구사항정의서) 템플릿
- **최종 매치율**: 100% (6/6 수용 기준 통과)
- **산출물**: `docs/framework/03-audit-docs/` (T01-business-plan.md, T02-requirements.md)
- **문서**: Plan + Design + Report

## MTU-F3 개발 표준 가이드 요약

- **설명**: 문서 유형 템플릿, 요구사항 ID 체계, 코딩 스타일, 코드리뷰 체크리스트
- **최종 매치율**: 100% (6/6 수용 기준 통과)
- **산출물**: `docs/framework/01-dev-standards/` (4개 파일)
- **문서**: Plan + Design + Report
