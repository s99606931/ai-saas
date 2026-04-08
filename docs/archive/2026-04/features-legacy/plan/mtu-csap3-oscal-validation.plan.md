# MTU-CSAP3 Plan: OSCAL 검증 준비

> **버전**: 1.0.0 | **일자**: 2026-04-06 | **작성자**: PM Agent
> **Phase**: CSAP (인증 준비) | **복잡도**: MED
> **참조**: docs/framework/02-csap/standard-grade/checklist-master.md, NIST OSCAL v1.1.3

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **비즈니스** | CSAP 79항목을 OSCAL 국제 표준 형식으로 기계 판독 가능하게 변환 |
| **기술** | OSCAL Component Definition JSON + oscal-cli 검증 스크립트 작성 |
| **보안** | 통제항목의 기계가독형 정의로 자동 준수 검증 기반 마련 |
| **감리** | 행안부 정보시스템 감리기준 T07 자가진단 자동화 지원 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | CSAP 심사 대응 시 수작업 체크리스트 의존도를 줄이고, 국제 표준 OSCAL 형식으로 자동 검증 체계 구축 |
| **WHO** | 보안 담당자, CISO, KISA 심사관, 감리관 |
| **RISK** | OSCAL 스키마 버전 변경 시 호환성 이슈 발생 가능 → v1.1.3 고정 |
| **SUCCESS** | OSCAL JSON 파일 구조 완비 + oscal-cli validate Pass + 실행 가이드 문서 완비 |
| **SCOPE** | OSCAL 컴포넌트 정의 문서 + 검증 스크립트 + 실행 가이드 |

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 | 검증 방법 |
|----|---------|---------|---------|
| FR-CSAP3.1 | OSCAL Component Definition JSON 파일 작성 (CSAP 79항목 매핑) | MUST | JSON 스키마 유효성 검증 |
| FR-CSAP3.2 | oscal-cli 설치 및 검증 실행 가이드 작성 | MUST | 가이드 절차 수행 가능성 확인 |
| FR-CSAP3.3 | 검증 자동화 스크립트 (scripts/oscal-validate.sh) | MUST | 스크립트 실행 시 검증 결과 출력 |
| FR-CSAP3.4 | CSAP ID ↔ OSCAL control.id 매핑 테이블 | SHOULD | 79항목 전수 매핑 확인 |
| FR-CSAP3.5 | CI/CD 연동 가이드 (Gitea Actions 통합) | SHOULD | 파이프라인 YAML 예시 포함 |

---

## 산출물

| 산출물 | 경로 | 설명 |
|--------|------|------|
| OSCAL 컴포넌트 정의 | `docs/framework/02-csap/oscal/component-definition.json` | CSAP 79항목 OSCAL 형식 |
| OSCAL 검증 가이드 | `docs/framework/02-csap/oscal/validation-guide.md` | oscal-cli 설치/실행 가이드 |
| 검증 스크립트 | `scripts/oscal-validate.sh` | 자동 검증 실행 스크립트 |
| CSAP-OSCAL 매핑 | `docs/framework/02-csap/oscal/csap-oscal-mapping.md` | ID 매핑 테이블 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 최초 작성 | PM Agent |
