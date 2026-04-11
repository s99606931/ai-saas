# MTU-N266: NL->Visualization — Design

> **버전**: 1.0 | **작성일**: 2026-04-12 | **작성자**: PM Lead

## Design Anchor

| 항목 | 내용 |
|------|------|
| Plan 참조 | `docs/01-plan/mtus/MTU-N266-nl-visualization.plan.md` |
| 아키텍처 | Pragmatic Balance — NL 파서 + 차트 추천 + 스펙 생성 |
| 구현 파일 | `platform/services/ai-service/src/lib/nl-visualization.ts` |

## §1 자연어 질의 파싱 (FR-N266.1)
- NL 입력 → 의도(intent) + 엔티티(entity) 추출
- 시각화 의도 유형: trend, comparison, distribution, composition, relationship

## §2 데이터 소스 매핑 (FR-N266.2)
- 엔티티 → 데이터 소스/필드 자동 매핑
- 메타데이터 카탈로그 기반 매칭

## §3 차트 타입 추천 (FR-N266.3)
- 데이터 특성 + 의도 조합으로 최적 차트 추천
- 규칙 기반 + AI 보조 하이브리드

## §4 시각화 스펙 생성 (FR-N266.4)
- Vega-Lite JSON 스펙 자동 생성
- 공공기관 디자인 가이드 적용

## §5 대시보드 레이아웃 (FR-N266.5)
- 다중 차트 그리드 배치 자동화

## §6 감사 로그 (FR-N266.6)
- 모든 시각화 생성 이벤트 기록

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-12 | 초기 Design | PM Lead |
