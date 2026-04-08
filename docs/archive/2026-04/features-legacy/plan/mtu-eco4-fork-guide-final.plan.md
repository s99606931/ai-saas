# MTU-ECO4 — 포크 지원 가이드 최종화

> **문서 ID**: MTU-ECO4-PLAN
> **버전**: 1.0.0 | **일자**: 2026-04-06 | **작성자**: PM Agent
> **참조**: FORK-GUIDE.md

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **비즈니스** | 공공기관 현장 포크 적용 체크리스트로 도입 장벽 최소화 |
| **기술** | FORK-GUIDE.md 확장 + 현장 적용 체크리스트 + FAQ |
| **보안** | 포크 시 시크릿 재생성 절차 포함 |
| **감리** | 포크 기관의 감리 대응 가이드 포함 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | 기존 FORK-GUIDE.md를 현장 적용 수준으로 상세화 |
| **WHO** | 공공기관 IT 담당자, SI 개발사 PM |
| **RISK** | 포크 후 환경 설정 오류로 서비스 기동 실패 |
| **SUCCESS** | 현장 적용 체크리스트 30항목+ 완비 + FAQ 20개+ |
| **SCOPE** | FORK-GUIDE.md 확장 (현장 체크리스트 + 트러블슈팅 + FAQ) |

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 | 검증 방법 |
|-------|---------|---------|---------|
| FR-ECO4.1 | 현장 적용 체크리스트 (사전 준비/포크/설정/검증/운영 5단계) | MUST | 30항목+ 체크리스트 |
| FR-ECO4.2 | 환경별 설정 가이드 (WSL2/Linux/Docker) | MUST | 3개 환경 설정 포함 |
| FR-ECO4.3 | 트러블슈팅 가이드 (빈발 오류 10건+) | MUST | 10건+ 오류/해결 |
| FR-ECO4.4 | FAQ (20개+ 질문/답변) | SHOULD | 20개+ Q&A |
| FR-ECO4.5 | 감리 대응 가이드 (포크 기관용 감리 산출물 매핑) | SHOULD | 감리 매핑 포함 |

## 산출물

| 산출물 | 경로 | 형식 |
|--------|------|------|
| FORK-GUIDE 확장 | `FORK-GUIDE.md` (기존 파일 확장) | Markdown |
| 현장 적용 체크리스트 | `docs/framework/05-ecosystem/deployment-checklist.md` | Markdown |
| 트러블슈팅/FAQ | `docs/framework/05-ecosystem/troubleshooting-faq.md` | Markdown |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 최초 작성 | PM Agent |
