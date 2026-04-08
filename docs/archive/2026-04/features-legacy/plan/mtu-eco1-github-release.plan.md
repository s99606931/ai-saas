# MTU-ECO1 — GitHub 공개 배포 준비

> **문서 ID**: MTU-ECO1-PLAN
> **버전**: 1.0.0 | **일자**: 2026-04-06 | **작성자**: PM Agent
> **참조**: FORK-GUIDE.md

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **비즈니스** | 공공기관 SaaS 프레임워크 오픈소스 공개, 확산 기반 마련 |
| **기술** | README 국영문 병기 + MIT 라이선스 + 기여 가이드 |
| **보안** | 시크릿/인증정보 제거 검증 + .gitignore 최종 점검 |
| **감리** | 공개 배포 전 감리 산출물 정합성 확인 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | 공공기관 SaaS 프레임워크 확산 및 커뮤니티 생태계 구축 |
| **WHO** | 외부 개발자, 공공기관 SI 사업자, 공공 SaaS 담당자 |
| **RISK** | 시크릿 유출, 라이선스 충돌, 문서 미비로 인한 사용 진입 장벽 |
| **SUCCESS** | README + LICENSE + CONTRIBUTING + FORK-GUIDE 4종 완비 |
| **SCOPE** | GitHub 공개 배포용 필수 파일 4종 작성 |

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 | 검증 방법 |
|-------|---------|---------|---------|
| FR-ECO1.1 | README.md (국문 + 영문 병기) | MUST | 파일 존재 + 국영문 섹션 포함 |
| FR-ECO1.2 | LICENSE (MIT 라이선스) | MUST | 파일 존재 + MIT 텍스트 정확 |
| FR-ECO1.3 | CONTRIBUTING.md (기여 가이드) | MUST | 파일 존재 + PR 규칙 포함 |
| FR-ECO1.4 | FORK-GUIDE.md 최종 점검 (ECO4와 연동) | SHOULD | 기존 파일 검토 |
| FR-ECO1.5 | .gitignore 최종 점검 (시크릿 제외 확인) | MUST | .env, secrets.* 패턴 포함 |

## 산출물

| 산출물 | 경로 | 형식 |
|--------|------|------|
| README | `README.md` | Markdown |
| 라이선스 | `LICENSE` | 텍스트 |
| 기여 가이드 | `CONTRIBUTING.md` | Markdown |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 최초 작성 | PM Agent |
