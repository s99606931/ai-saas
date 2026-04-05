# MTU-F4: CSAP 일반등급 빠른 시작 가이드 Design 문서

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-F4 |
| Phase | Phase 1 Foundation |
| 버전 | 0.1.0 |
| 상태 | Draft |
| 작성일 | 2026-04-05 |
| 작성자 | PM Lead Agent (Claude Code) |
| 관련 Plan | docs/01-plan/mtus/MTU-F4-csap-simple.plan.md |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | CSAP 인증 준비 진입 장벽 해소. PM이 기술 배경 없이 일반등급 자가진단 3일 완료 가능해야 함 |
| **WHO** | 공공 SaaS 사업자의 PM/기획자, 보안 담당자 |
| **RISK** | CSAP 등급 오해(일반 vs 표준 혼동), 체크리스트 항목 누락, 업그레이드 경로 불명확 |
| **SUCCESS** | 3등급 비교표 완비, 30항목 전수 체크리스트, 표준등급 업그레이드 경로 명시 |
| **SCOPE** | `02-csap/simple-grade/` 디렉토리 2개 파일 (checklist-simple.md, quick-start-guide.md) |

---

## 1. 설계 개요

### 1.1 설계 목적

CSAP 일반등급(간편등급) 인증 준비를 위한 최소 요건 체크리스트와 등급별 비교/업그레이드 가이드를 작성합니다. 비기술 PM이 3일 이내 자가진단을 완료할 수 있는 수준을 목표로 합니다.

### 1.2 CSAP 등급 체계 정리

| 항목 | 일반등급 | 표준등급 | 중요등급 |
|------|---------|---------|---------|
| 통제 항목 | 30개 | 79개 | 79개 + 추가 10개 |
| 심사 유형 | 서류 심사 중심 | 현장 심사 포함 | 전면 현장 심사 |
| 프레임워크 MTU | MTU-F4 | MTU-C1~C3 | MTU-A5 |

---

## 2. 파일별 설계

### 2.1 checklist-simple.md

**문서 유형**: 체크리스트형
**구조**: 7개 영역 (A~G), 30개 항목
**항목 형식**: CSAP-DXX-YY ID, 확인 방법, 증거 자료

### 2.2 quick-start-guide.md

**문서 유형**: 구현 가이드형
**구조**: 4개 섹션 (인증 로드맵, 등급 비교, 3일 계획, 업그레이드 경로)

---

## 3. 구현 순서

1. `02-csap/simple-grade/quick-start-guide.md` -- 등급 비교표 + 로드맵 + 업그레이드 경로
2. `02-csap/simple-grade/checklist-simple.md` -- 30항목 체크리스트

---

## 4. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.1 | 2026-04-05 | F4-GAP-1 품질 검토 확인 — 산출물 경로 `02-csap/simple-grade/` 사용 확인 (기 정상) | Implementer Agent |
| 0.1.0 | 2026-04-05 | 최초 작성 -- 2개 파일 설계, 7영역 30항목 구조 | PM Lead Agent |
