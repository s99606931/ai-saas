# MTU-N452 — ESG 리포팅 자동화 (GRI/SASB/TCFD)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 국제 ESG 표준 3종 자동 생성, 연간 보고서 작성 시간 90% 단축 |
| 기술 | 템플릿 엔진 + 데이터 수집기 + AI 요약 |
| 규제 | GRI Standards 2021, SASB, TCFD, K-ESG |
| 품질 | 템플릿 커버리지 100%, 자동 검증 |

## Context Anchor
- **WHY**: ESG 보고 표준 3종(GRI/SASB/TCFD) 통합 보고서 자동 생성
- **WHO**: ESG 담당자, 지속가능경영 팀, 이사회
- **RISK**: 표준 간 지표 불일치, 미공개 필수 항목 누락
- **SUCCESS**: 3대 표준 100% 항목 커버, AI 품질 점검 통과
- **SCOPE**: `packages/esg-reporting/`

## 기능 요구사항
- **FR-ESG.1**: GRI Universal Standards 2021 템플릿 (100+ 지표)
- **FR-ESG.2**: SASB 산업별 표준 매핑 (77 산업)
- **FR-ESG.3**: TCFD 4대 영역 (거버넌스/전략/위험/지표)
- **FR-ESG.4**: 지표 자동 수집 (Carbon Tracking 연동)
- **FR-ESG.5**: AI 자연어 요약 + 품질 점검

## 추적성 매트릭스
| FR | 구현 | 테스트 | CSAP |
|----|------|--------|------|
| FR-ESG.1~5 | esg-reporter.ts | test §esg | D-12 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 초안 | PM Lead |
