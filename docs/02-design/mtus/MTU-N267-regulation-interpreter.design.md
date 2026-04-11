# MTU-N267: AI 법령/규정 자동 해석 엔진 — Design

> **버전**: 1.0 | **작성일**: 2026-04-12 | **작성자**: PM Lead

## Design Anchor

| 항목 | 내용 |
|------|------|
| Plan 참조 | `docs/01-plan/mtus/MTU-N267-regulation-interpreter.plan.md` |
| 아키텍처 | Pragmatic Balance — 법령 파서 + 의미 분석 + 해석 생성 |
| 구현 파일 | `platform/services/ai-service/src/lib/regulation-interpreter.ts` |

## §1 법령 구조화 파싱 (FR-N267.1)
- 조(Article) > 항(Paragraph) > 호(Subparagraph) > 목(Item) 계층 구조
- 정규식 + 규칙 기반 파서

## §2 조문 참조 추출 (FR-N267.2)
- 내부/외부 법령 참조 자동 추출
- 그래프 구조 참조 관계 구축

## §3 관련 조문 검색 (FR-N267.3)
- 자연어 질의 → 관련 조문 의미 검색
- TF-IDF + 코사인 유사도

## §4 AI 해석 생성 (FR-N267.4)
- 조문 해석, 적용 가이드, 예시 자동 생성
- 면책 조항 필수 포함

## §5 개정 영향 분석 (FR-N267.5)
- 신구 조문 비교 (diff)
- 영향 받는 시스템/프로세스 식별

## §6 감사 로그 (FR-N267.6)
- 모든 해석 활동 기록

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-12 | 초기 Design | PM Lead |
