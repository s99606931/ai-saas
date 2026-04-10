# MTU-N92: 불변 인프라 + 프로덕션 준비 체크리스트 자동화 — Design

> **MTU ID**: MTU-N92
> **Plan 참조**: docs/01-plan/mtus/MTU-N92-immutable-infra-prodready.plan.md
> **작성일**: 2026-04-10

---

## Design Anchor

| 항목 | 내용 |
|------|------|
| 목표 | 불변 인프라 정책 + 100항목 프로덕션 체크리스트 자동화 |
| 제약 | k3s WSL2 환경, Kyverno Enforce 모드 활용 |
| 기술 스택 | Kyverno, Bash, Gitea Actions |

## 1. 프로덕션 준비 100항목 체크리스트

### 카테고리별 분류

| 카테고리 | 항목 수 | CSAP 매핑 |
|---------|--------|----------|
| 보안 | 25 | D-08~D-13 |
| 관측성 | 15 | D-06 |
| 안정성 | 15 | D-07, D-11 |
| 성능 | 10 | D-11 |
| 네트워크 | 10 | D-10 |
| 배포 | 10 | D-12 |
| 데이터 | 10 | D-05, D-09 |
| 문서/감리 | 5 | D-01 |

## 2. 불변 인프라 정책

- readOnlyRootFilesystem: true (모든 Pod)
- 런타임 패키지 설치 금지 (apt/yum/apk 차단)
- 이미지 태그: latest 금지, SHA digest 필수
- ConfigMap/Secret 변경 시 Pod 재시작 (불변 원칙)

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 설계 | PM Agent |
