# MTU-N140: 의존성 보안 감사 — Design

> 버전: 1.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Design Anchor

| 항목 | 내용 |
|------|------|
| Plan 참조 | docs/01-plan/mtus/MTU-N140.plan.md |
| 아키텍처 선택 | Pragmatic Balance — pnpm audit + 정적 분석 |
| 핵심 결정 | npm audit 래핑 + 라이선스 검증 + S2C2F 매핑 |

## 1. 감사 영역

### 1.1 취약점 분류

| 심각도 | 조치 기한 | 차단 여부 |
|--------|----------|----------|
| critical | 24시간 이내 | CI 차단 |
| high | 7일 이내 | 경고 |
| moderate | 30일 이내 | 보고 |
| low | 분기 내 | 보고 |

### 1.2 금지 라이선스

- GPL-3.0 (상용 서비스 제약)
- AGPL-3.0 (SaaS 제약)
- SSPL (MongoDB 라이선스)

### 1.3 허용 라이선스

- MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 초기 설계 | PM Lead |
