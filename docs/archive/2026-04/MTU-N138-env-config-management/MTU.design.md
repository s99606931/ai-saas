# MTU-N138: 환경별 구성 관리 — Design

> 버전: 1.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Design Anchor

| 항목 | 내용 |
|------|------|
| Plan 참조 | docs/01-plan/mtus/MTU-N138.plan.md |
| 아키텍처 선택 | Pragmatic Balance — 프로젝트 구조 기반 정적 분석 |
| 핵심 결정 | 환경별 파일 패턴 인식 + 시크릿 분리 검증 |

## 1. 환경 구성 분석 모델

### 1.1 환경 감지 패턴

```
infra/environments/{env}/     → 환경별 오버레이
infra/k3s/{env}/              → K3s 환경별 설정
*.{env}.yaml                  → 환경별 설정 파일
values-{env}.yaml             → Helm 환경별 values
```

### 1.2 검증 항목

| 항목 | 검증 방법 |
|------|---------|
| 리소스 제한 | dev < stg < prod 순서 검증 |
| 시크릿 참조 | .env 파일 내 환경 변수 일관성 |
| 이미지 태그 | dev: latest, stg: rc-*, prod: v*.*.* |
| 레플리카 수 | dev: 1, stg: 2, prod: 3+ |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 초기 설계 | PM Lead |
