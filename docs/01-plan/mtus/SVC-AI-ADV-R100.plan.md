# SVC-AI-ADV-R100 — WCAG 2.2 준수 스캐너

> 작성일: 2026-04-12 | 버전: 1.0.0

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | WCAG 2.2 신규 기준(포커스 외관, 타깃 크기 등) 전용 스캐너 |
| 품질 | 9개 신규 기준 100% 룰 커버리지 |
| 보안 | HTML 정적 분석, 외부 전송 없음 |
| 비용 | 순수 규칙 기반, LLM 없음 |

## Context Anchor

- **WHY**: 행안부 2026년 공공 웹접근성 WCAG 2.2 의무화
- **WHO**: 웹 개발자, 접근성 담당자
- **SCOPE**: 기존 accessibility-checker와 독립, 2.2 신규 성공기준 전담

## 요구사항

- **FR-R100.1**: scan(html) → Violation[] (WCAG 2.2 기준 한정)
- **FR-R100.2**: 9개 신규 기준 룰 (2.4.11 Focus Not Obscured 등)
- **FR-R100.3**: 심각도 분류 (A/AA/AAA)
- **FR-R100.4**: 수정 제안 반환
- **FR-R100.5**: report(violations) 요약 리포트
- **NFR-R100.1**: 테스트 5개+
