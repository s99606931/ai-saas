# MTU-N117: 자동 포스트모템 생성 -- 완료 보고서

> 작성일: 2026-04-10 | matchRate: 100% | 테스트: 57/57

## Executive Summary

| 관점 | 목표 | 달성 |
|------|------|------|
| 비즈니스 | 인시던트 해소 후 포스트모템 자동 생성 | 100% |
| 기술 | 6개 카테고리별 포스트모템 + 5 Whys + 개선 조치 | 100% |
| 보안 | CSAP D-06 감사 추적 준수 | 100% |
| 운영 | PrometheusRule 트리거 + E2E 테스트 57항목 | 100% |

## 산출물

| FR ID | 산출물 | 경로 | 상태 |
|-------|--------|------|------|
| FR-N117.1 | 포스트모템 템플릿 | `docs/operations/postmortem-template.md` | 완료 |
| FR-N117.2 | 타임라인 자동 추출 스크립트 | `scripts/generate-postmortem.sh` | 완료 |
| FR-N117.3 | 5 Whys 근본 원인 분석 가이드 | `docs/operations/five-whys-guide.md` | 완료 |
| FR-N117.4 | 개선 조치 추적 체크리스트 | `docs/operations/postmortem-action-tracker.md` | 완료 |
| FR-N117.5 | 인시던트 분류 체계 + PrometheusRule | `docs/operations/incident-severity-matrix.md`, `infra/monitoring/postmortem-trigger-rules.yaml` | 완료 |
| FR-N117.6 | E2E 테스트 | `scripts/test-auto-postmortem.sh` | 57/57 통과 |

## 검증 결과

- matchRate: 100%
- E2E 테스트: 15개 테스트 그룹, 57개 검증 항목 전체 통과
- CSAP D-06 준수: 감사 로그 기록, 인시던트 분류, 포스트모템 트리거 규칙
- Q-Gate: G1~G7 통과

## 주요 구현 내용

1. **포스트모템 자동 생성 스크립트**: 6개 카테고리(보안/가용성/성능/인프라/배포/데이터)별 커스터마이즈된 포스트모템 자동 생성
2. **5 Whys 프레임워크**: 카테고리별 사전 정의 질문으로 근본 원인 분석 가이드
3. **PrometheusRule 트리거**: P1 해소, P2 장기 지속 해소, 반복 인시던트 3회, MTTR 초과 자동 감지
4. **개선 조치 자동 생성**: 심각도/카테고리에 따른 단기/중기/장기 조치 항목 자동 제안
5. **입력 검증**: CSAP D-12 준수 -- 심각도(P1~P4), 카테고리, 시각 형식 검증
