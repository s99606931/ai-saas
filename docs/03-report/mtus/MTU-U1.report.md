# MTU-U1: 공공기관 SaaS UI/UX 디자인 시스템 -- PDCA 완료 보고서

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-U1 |
| MTU명 | 공공기관 SaaS UI/UX 디자인 시스템 |
| Phase | Phase U (UI/UX 확장) |
| 완료일 | 2026-04-05 |
| Match Rate | 100% (10/10 수용 기준 통과) |
| 상태 | **COMPLETED** |

---

## 1. Executive Summary (4관점 테이블)

| 관점 | 목표 | 실제 달성 | 달성률 |
|------|------|---------|--------|
| **사용자** | KWCAG 2.2 AA 접근성, 다크모드, AI 어시스턴트 | 33검사항목 전수 대응, 3모드 다크모드, AI 사이드패널+명령팔레트+인라인제안 설계 | 100% |
| **관리자** | 테넌트별 테마 커스터마이제이션 | CSS Variable override, 색상 피커, 로고 업로드, 실시간 미리보기, 화이트라벨 설계 | 100% |
| **개발자** | 디자인 토큰 체계, 컴포넌트 카탈로그 | 3계층 토큰 80개+, Atomic Design 4계층 41개 컴포넌트, Storybook 8 설정 가이드 | 100% |
| **규제** | KWCAG 2.2, KRDS 참조, N2SF 데이터 등급 | 33항목 매트릭스, KRDS 14개 매핑, N2SF C/S등급 AI 전송 차단 UI 설계 | 100% |

---

## 2. PDCA 사이클 이력

| 단계 | 상태 | 산출물 | 비고 |
|------|------|--------|------|
| PM 분석 | 완료 | 웹검색 8건 수행 | Next.js 15, Tailwind v4, shadcn/ui CLI v4, AI SDK 5, KWCAG 2.2, KRDS, AI UI 트렌드, dnd-kit, Motion v12, Zustand v5, Storybook 8 조사 |
| Plan | 완료 | `docs/01-plan/mtus/MTU-U1-ui-design-system.plan.md` | FR-U.1~15, NFR-U.1~8 정의, 10개 수용 기준 |
| Design | 완료 | `docs/02-design/mtus/MTU-U1-ui-design-system.design.md` | A~I 9개 섹션, 전체 아키텍처 설계 |
| Do | 완료 | Design 문서 = 산출물 (설계 문서 MTU) | 코드 구현 아닌 설계 문서가 산출물 |
| Check | **PASS** | Match Rate 100% | 10/10 수용 기준 전수 통과 |
| Report | 완료 | 본 문서 | 완료 보고서 |

---

## 3. 산출물 목록

| 파일 | 위치 | 설명 |
|------|------|------|
| Plan 문서 | `docs/01-plan/mtus/MTU-U1-ui-design-system.plan.md` | 요구사항 23개 (FR 15 + NFR 8), 수용 기준 10개, 추적성 매트릭스 |
| Design 문서 | `docs/02-design/mtus/MTU-U1-ui-design-system.design.md` | 9개 섹션 (A~I), 전체 아키텍처 설계 |
| Report 문서 | `docs/03-report/mtus/MTU-U1.report.md` | 본 문서 |

---

## 4. 수용 기준 검증 결과

| # | 수용 기준 (SC-ID) | 결과 | 근거 |
|---|---------|------|------|
| 1 | SC-U1: 디자인 토큰 체계 정의 (80개+) | PASS | Design B.2: 원시 토큰 (색상 10스케일x4 + 폰트 8 + 간격 12 + 반경 7 + 그림자 4 + 전환 6 + z-index 8 = 95개+), B.3: 의미 토큰 30개+ |
| 2 | SC-U2: 기본 테마 5종 | PASS | Design B.4: 공공 블루, 공공 그린, 다크 오피셜, 클래식 그레이, 고대비 5종 CSS 정의 |
| 3 | SC-U3: 다크모드 3모드 지원 | PASS | Design B.5: light/dark/system 3모드, Zustand persist + DB 동기화, FOUC 방지 스크립트 |
| 4 | SC-U4: 반응형 4단계 | PASS | Design C.1: 320px(모바일)/768px(태블릿)/1280px(데스크탑)/1920px(대형) + 컨테이너 쿼리 |
| 5 | SC-U5: AI 어시스턴트 3종 | PASS | Design E.1(사이드패널), E.4(인라인제안), E.6(명령팔레트) 3종 상세 설계 |
| 6 | SC-U6: KWCAG 2.2 AA 적합 | PASS | Design G.1: 4원칙 14지침 33검사항목 전수 대응 매트릭스 + G.2 포커스 관리 + G.3 모션 감소 |
| 7 | SC-U7: 컴포넌트 카탈로그 40개+ | PASS | Design H.1: 원자 14개 + 분자 12개 + 유기체 10개 + 템플릿 5개 = 41개 컴포넌트 |
| 8 | SC-U8: 테넌트 커스터마이제이션 설계 | PASS | Design D.1~D.5: DB 스키마, CSS 생성기, 관리자 UI, 화이트라벨 도메인 매핑 |
| 9 | SC-U9: 동적 레이아웃 커스터마이제이션 | PASS | Design F.1(D&D 대시보드), F.2(사이드바 3모드), F.3(테이블 커스텀), F.4(즐겨찾기) |
| 10 | SC-U10: Storybook 8 설정 가이드 | PASS | Design I.1: 설정 + 전역 데코레이터 + 접근성 설정, I.2: 스토리 작성 규칙 + 인터랙션 테스트 |

---

## 5. 주요 의사결정 체인 (PRD -> Plan -> Design)

### 5.1 기술 스택 선정

| 결정 | 선택지 | 결정 | 근거 |
|------|--------|------|------|
| UI 프레임워크 | A) React + Vite B) Next.js 15 C) Remix | B) Next.js 15 | RSC 지원, k3s standalone 배포, 15.2.4 안정 릴리스 |
| CSS 프레임워크 | A) CSS Modules B) Tailwind v3 C) Tailwind v4 | C) Tailwind v4 | Oxide 엔진 100x 빌드, @theme CSS-first, oklch 네이티브 |
| 컴포넌트 라이브러리 | A) MUI B) Ant Design C) shadcn/ui | C) shadcn/ui | CLI v4 프리셋, Radix 접근성, 소유권 (코드 복사 방식) |
| 상태 관리 | A) Redux B) Zustand C) Jotai | B) Zustand | 3KB, 단순 API, persist 미들웨어, 2026 최대 채택률 |
| AI UI | A) 직접 구현 B) AI SDK 5 C) LangChain.js | B) AI SDK 5 | SSE 네이티브, useChat, 다중 프레임워크, 타입 안전 |
| 드래그앤드롭 | A) React DnD B) dnd-kit C) Gridstack | B) dnd-kit | 접근성 내장, React 최적화, 12M+ weekly downloads |
| 애니메이션 | A) CSS only B) Motion v12 C) GSAP | B) Motion v12 | Web Animations API 120fps, oklch 애니메이션, 접근성 훅 |

### 5.2 아키텍처 결정

| 결정 | 내용 | 근거 |
|------|------|------|
| Option B 선택 | shadcn/ui + Tailwind v4 + 디자인 토큰 | 접근성 내장 + 테넌트 유연성 + 커뮤니티 지원 균형 |
| 3계층 토큰 | Primitive -> Semantic -> Component | KRDS 스타일 참조, 테넌트 오버라이드 용이, 유지보수성 |
| CSS Cascade Layers | base/tokens/tenant/components/utilities | 테넌트 CSS 우선순위 안전 관리, 스타일 충돌 방지 |
| oklch 색공간 | Tailwind v4 네이티브 지원 | 인지적 균일성, color-mix() 연산, 접근성 대비 계산 용이 |
| 데이터 등급 이중 검증 | 클라이언트 UI + 서버 API 이중 차단 | N2SF N-05 준수, C/S등급 데이터 AI 전송 절대 방지 |

---

## 6. 웹검색 기반 시장조사 결과 반영

| 조사 항목 | 핵심 발견 | 설계 반영 |
|----------|---------|---------|
| Next.js 15.2.4 | Turbopack 안정화, React 19 정식 지원 | A.2 프레임워크 결정 |
| Tailwind CSS v4.2 | Oxide 엔진, @theme, 논리 속성, 4종 신규 색상 | A.2 + B.2 토큰 체계 |
| shadcn/ui CLI v4 | 디자인 프리셋, AI skills, Radix 통합 패키지 | A.2 + H.1 카탈로그 |
| AI UI 트렌드 2026 | contextual AI sidebar, invisible AI, copilot 패턴 | E.1~E.6 AI UI 전체 |
| KWCAG 2.2 | 4원칙 14지침 33검사항목, 장애인차별금지법 | G.1 전수 매트릭스 |
| KRDS | 범정부 디자인 시스템, WCAG AA, Figma 제공 | I.4 KRDS 매핑 |
| AI SDK 5 | SSE 표준, useChat, 타입 안전 메타데이터 | E.2 SSE 스트리밍 |
| CSS 테마 시스템 | CSS Custom Properties, prefers-color-scheme, oklch | B.3~B.5 전체 테마 |
| dnd-kit | 접근성 내장, 키보드 공지, 12M+ 다운로드 | F.1 대시보드 |
| Motion v12 | Web Animations API, oklch 애니메이션, useReducedMotion | G.3 모션 접근성 |
| Zustand v5 | 3KB, TanStack Query 조합, 최대 채택률 | B.5 테마 상태 |
| Storybook 8 | Vitest 통합, 30M+ 다운로드, Chromatic | I.1 설정 가이드 |

---

## 7. Q-Gate 검증 결과

| Gate | 항목 | 결과 | 비고 |
|------|------|------|------|
| G1 | 요구사항 FR ID 전수 | PASS | FR-U.1~15 + NFR-U.1~8 = 23개 전수 정의 |
| G2 | 설계 완전성 | PASS | A~I 9개 섹션 전수 작성, 추적성 매트릭스 포함 |
| G3 | 코드 품질 | N/A | 설계 문서 MTU (코드 구현 없음) |
| G4 | 테스트 커버리지 | N/A | 설계 문서 MTU (테스트 전략은 I.3에 포함) |
| G5 | OWASP Top10 | PASS | E.1~E.2 AI 데이터 등급 검증, D.2 SQL 매개변수화 |
| G6 | CSAP 해당 Phase | PASS | KWCAG 2.2 + N2SF 데이터 등급 UI + KRDS 참조 |
| G7 | audit.jsonl 완비 | PASS | 감사 로그 기록 |

---

## 8. 설계 문서 주요 섹션 요약

| 섹션 | 내용 | 핵심 산출 |
|------|------|---------|
| A. 기술 스택 | Next.js 15 + React 19 + Tailwind v4 + shadcn/ui + Zustand + AI SDK 5 | 전체 스택 다이어그램 |
| B. 디자인 토큰 | 3계층 토큰 (Primitive/Semantic/Component), 5종 테마, 다크모드 | 95개+ 원시 토큰, 30개+ 의미 토큰 |
| C. 반응형 레이아웃 | 4단계 브레이크포인트, 3종 레이아웃 패턴, 터치 최적화, 컨테이너 쿼리 | 320~1920px+ 대응 |
| D. 테넌트 커스터마이제이션 | CSS Variable override, DB 스키마, CSS 생성기, 관리자 UI, 화이트라벨 | 도메인별 테마 매핑 |
| E. AI Assistant UI | 사이드패널, SSE 채팅, 인라인 제안, 자동화 트리거, 명령 팔레트, 데이터 등급 표시 | 6종 AI UI 컴포넌트 |
| F. 동적 레이아웃 | D&D 대시보드, 사이드바 3모드, 테이블 커스텀, 즐겨찾기 | dnd-kit 위젯 시스템 |
| G. 접근성 | KWCAG 2.2 33항목, 포커스 관리, 모션 감소, 색각 이상 대응 | 전수 대응 매트릭스 |
| H. 컴포넌트 카탈로그 | Atomic Design 4계층 41개, 네이밍 규칙, 파일 구조 | 원자~템플릿 전체 목록 |
| I. 구현 가이드라인 | Storybook 8 설정, 스토리 작성 규칙, Playwright 접근성 테스트, KRDS 매핑 | 14개 KRDS 매핑 |

---

## 9. 후속 영향 및 연계 MTU

| MTU | 연계 내용 |
|-----|---------|
| MTU-E2 (멀티테넌시) | D섹션 테넌트 커스터마이제이션이 E2 테넌트 격리 아키텍처와 직접 연계 |
| MTU-A1 (AI 게이트웨이) | E섹션 AI UI가 A1의 데이터 등급 검증 + LM Studio 연동과 연계 |
| MTU-A5 (Docusaurus 포털) | H섹션 컴포넌트 카탈로그가 문서 포털 UI에 적용 가능 |
| MTU-A6 (준수 현황 대시보드) | F.1 대시보드 위젯 시스템이 Grafana 대시보드 UI와 연계 |
| MTU-I1 (k3s) | A.2 standalone 출력이 k3s 컨테이너 배포와 연계 |

---

## 10. 발견된 이슈 및 해결 방법

| # | 이슈 | 심각도 | 해결 방법 |
|---|------|--------|---------|
| 1 | Tailwind v4의 @theme 디렉티브가 기존 JS 설정과 호환 불가 | LOW | CSS-first 설정으로 완전 전환, 마이그레이션 불필요 (신규 프로젝트) |
| 2 | shadcn/ui 테마와 테넌트 커스텀 CSS 우선순위 충돌 가능성 | MEDIUM | CSS Cascade Layers (base/tokens/tenant/components/utilities)로 우선순위 명시적 관리 |
| 3 | AI SDK 5의 SSE가 프록시 환경에서 버퍼링될 수 있음 | LOW | 응답 헤더 X-Accel-Buffering: no 설정 가이드 포함 |
| 4 | KWCAG 2.2 자동 테스트의 한계 (33항목 중 일부 수동 필요) | MEDIUM | Playwright axe-core로 자동화 가능 항목 + 수동 테스트 체크리스트 병행 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — PDCA 완료 보고서 | Claude Code (PM) |
