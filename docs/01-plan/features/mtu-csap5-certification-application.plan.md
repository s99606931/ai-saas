# MTU-CSAP5 Plan: CSAP 심사 신청 준비

> **버전**: 1.0.0 | **일자**: 2026-04-06 | **작성자**: PM Agent
> **Phase**: CSAP (인증 준비) | **복잡도**: MED
> **참조**: KISA CSAP 인증제도 안내, CSAP 표준등급 79항목

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **비즈니스** | CSAP 표준등급 인증 취득을 위한 심사 신청서 및 현장 심사 대응 준비 |
| **기술** | 79항목 자가진단 완료 + 증적 패키지 구성 + 현장 심사 시연 준비 |
| **보안** | 기술적 통제 항목 (D08~D13) 실동작 시연 준비 |
| **감리** | 감리기준 T01~T07 최종 패키지 + KISA 심사 신청서 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | CSAP 표준등급 인증이 공공기관 SaaS 서비스 공급의 법적 필수 요건 |
| **WHO** | CISO, 보안 담당자, KISA 심사관, 경영진 |
| **RISK** | 신청서 미비 → 심사 반려, 현장 심사 대응 미흡 → 결함 판정 |
| **SUCCESS** | 신청 준비 체크리스트 100% + 신청서 템플릿 + 현장 심사 대응 가이드 완비 |
| **SCOPE** | 신청 체크리스트 + 신청서 템플릿 + 현장 심사 가이드 + 증적 패키지 구성 안내 |

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 | 검증 방법 |
|----|---------|---------|---------|
| FR-CSAP5.1 | CSAP 표준등급 신청 준비 체크리스트 | MUST | 체크리스트 전수 항목 확인 |
| FR-CSAP5.2 | CSAP 신청서 템플릿 (KISA 양식 기반) | MUST | 템플릿 완비 확인 |
| FR-CSAP5.3 | 현장 심사 대응 가이드 | MUST | 가이드 시나리오 완비 |
| FR-CSAP5.4 | 증적 패키지 구성 안내 (D01~D13 분야별) | MUST | 13분야 증적 목록 전수 |
| FR-CSAP5.5 | 심사 일정 타임라인 템플릿 | SHOULD | 타임라인 양식 완비 |
| FR-CSAP5.6 | 결함 조치 대응 절차서 | SHOULD | 절차서 완비 확인 |

---

## 산출물

| 산출물 | 경로 | 설명 |
|--------|------|------|
| 신청 준비 체크리스트 | `docs/framework/02-csap/certification/application-checklist.md` | 심사 신청 전 전수 확인 |
| 신청서 템플릿 | `docs/framework/02-csap/certification/application-template.md` | KISA 양식 기반 |
| 현장 심사 가이드 | `docs/framework/02-csap/certification/onsite-audit-guide.md` | 심사 시나리오별 대응 |
| 증적 패키지 구성 | `docs/framework/02-csap/certification/evidence-package.md` | D01~D13 증적 매핑 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 최초 작성 | PM Agent |
