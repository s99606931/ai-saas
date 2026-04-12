# SVC-AI-ADV-R107 — Semantic Version Control for Prompts

> 작성일: 2026-04-12 | 버전: 2.0.0 (재작성)
> 세션: #139 (11차 PM 세션 k)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 프롬프트 시맨틱 버전 관리 (SemVer) + 롤백 + diff |
| 품질 | major/minor/patch 자동 판정, 변경 이력 완전 추적 |
| 보안 | 하드코딩 시크릿 차단, C/S 등급 템플릿 차단 |
| 비용 | 순수 문자열 처리 |

## Context Anchor

- **WHY**: 기존 prompt-versioning.ts는 순번 버전 + A/B 테스트에 특화. SemVer 관리 + diff + 롤백 기능 별도 필요.
- **WHO**: 프롬프트 엔지니어, 운영자
- **RISK**: 잘못된 버전 배포, 변경 이력 유실
- **SUCCESS**: commit → diff → rollback → history API 완결
- **SCOPE**: 프롬프트 이름별 SemVer 히스토리 + 라인 diff + 롤백. 실행 라우팅 제외.

## 요구사항

- **FR-R107.1**: `commit(name, template, bumpType)` — 새 버전 기록 (SemVer)
- **FR-R107.2**: `getActive(name)` / `setActive(name, version)` — 활성 버전
- **FR-R107.3**: `diff(name, versionA, versionB)` — 라인 단위 +/- diff
- **FR-R107.4**: `rollback(name)` — 이전 활성 버전으로
- **FR-R107.5**: `history(name)` — 전체 버전 목록
- **NFR-R107.1**: 테스트 8개+
- **CSAP D-06**: getAuditLog() 필수
- **보안**: 하드코딩 시크릿 패턴 차단
