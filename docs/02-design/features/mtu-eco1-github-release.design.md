# MTU-ECO1 — GitHub 공개 배포 준비 설계

> **문서 ID**: MTU-ECO1-DESIGN
> **버전**: 1.0.0 | **일자**: 2026-04-06 | **작성자**: PM Agent
> **Plan SC**: FR-ECO1.1~FR-ECO1.5
> **참조**: docs/01-plan/features/mtu-eco1-github-release.plan.md

---

## 1. 아키텍처 선택

**선택안**: Pragmatic Balance
- README 국문 우선 + 영문 병기 (국문이 정본)
- MIT 라이선스 (공공기관 재사용 최대화)
- CONTRIBUTING.md (Conventional Commits + PDCA 워크플로우)

## 2. 산출물 설계

### 2.1 README.md (FR-ECO1.1)

```
README.md
├── [한국어]
│   ├── 프로젝트 개요 (공공기관 SaaS 프레임워크)
│   ├── 주요 특징 (CSAP 인증 지원, ISMS-P 대응, 멀티테넌시)
│   ├── 기술 스택 (k3s, PostgreSQL, Redis, Next.js, Hono)
│   ├── 빠른 시작 (5분 설치 가이드)
│   │   ├── 사전 요구사항
│   │   ├── 설치 및 실행
│   │   └── 데모 접속
│   ├── 프로젝트 구조
│   ├── 인증 지원 현황 (CSAP 79항목 / ISMS-P 101항목)
│   ├── 문서 (링크)
│   ├── 기여 방법 (CONTRIBUTING.md 링크)
│   ├── 라이선스 (MIT)
│   └── 감사의 글
├── [English]
│   ├── Overview
│   ├── Key Features
│   ├── Quick Start
│   ├── Documentation
│   ├── Contributing
│   └── License
```

### 2.2 LICENSE (FR-ECO1.2)

```
MIT License

Copyright (c) 2026 Public SaaS Framework Contributors

Permission is hereby granted, free of charge, ...
```

### 2.3 CONTRIBUTING.md (FR-ECO1.3)

```
CONTRIBUTING.md
├── 1. 기여 방법
│   ├── 이슈 등록 (버그/기능 요청)
│   ├── PR 제출 절차
│   └── 코드 리뷰 프로세스
├── 2. 개발 환경 설정
│   ├── 필수 도구 (Node.js 20+, pnpm, Docker)
│   ├── 저장소 클론 및 설치
│   └── 로컬 실행 확인
├── 3. 커밋 컨벤션
│   ├── Conventional Commits 형식 필수
│   ├── feat/fix/docs/refactor 접두사
│   └── 커밋 메시지 예시
├── 4. PDCA 워크플로우 준수
│   ├── 기능 추가 시: Plan -> Design -> Do -> Check
│   ├── 문서 필수 (Plan + Design 없이 PR 불허)
│   └── Q-Gate 통과 기준
├── 5. 코드 스타일
│   ├── TypeScript/JavaScript: 2칸 들여쓰기
│   ├── 함수 80줄 이하
│   └── ESLint + Prettier 설정 준수
└── 6. 보안 취약점 보고
    ├── 비공개 보고 절차
    └── 보안 정책 (SECURITY.md)
```

## 3. 추적성 매트릭스

| FR ID | 설계 섹션 | 산출물 | 검증 |
|-------|---------|--------|------|
| FR-ECO1.1 | 2.1 | README.md | 국영문 섹션 존재 |
| FR-ECO1.2 | 2.2 | LICENSE | MIT 텍스트 정확 |
| FR-ECO1.3 | 2.3 | CONTRIBUTING.md | PR 규칙 포함 |
| FR-ECO1.4 | - | FORK-GUIDE.md 검토 | ECO4에서 처리 |
| FR-ECO1.5 | - | .gitignore 검토 | 기존 파일 확인 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 최초 작성 | PM Agent |
