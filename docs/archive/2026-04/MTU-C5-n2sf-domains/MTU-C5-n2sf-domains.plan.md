# MTU-C5 Plan: N2SF 6개 영역 통제 구현 가이드

> **MTU ID**: MTU-C5
> **Phase**: Phase 2 Core Security
> **의존 MTU**: MTU-C4 (N2SF 등급 분류 + CSAP 매핑)
> **작성일**: 2026-04-05
> **작성자**: PM Lead Agent

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 문제 | N2SF 6개 보안 영역(N01~N06) 구현 가이드 부재 — C/S/O 등급별 통제 요건 미문서화 |
| 솔루션 | N01~N06 전수 구현 가이드 6개 파일 생성, 등급별 비교 테이블 + CSAP 역참조 완비 |
| 기능/UX | 보안 담당자가 등급별 통제 요건 5분 이내 확인 가능 |
| 핵심 가치 | CSAP + N2SF 이중 규제 동시 충족 증거 완비 |

---

## Context Anchor

### WHY
- N2SF 가이드라인 1.0 발표(2025) 이후 시행 초기 — 선제 대응 필수
- MTU-C4 등급 매핑만으로는 구현 방법 부재

### WHO
| 역할 | 관심사 |
|------|--------|
| 보안 담당자 | 등급별 통제 요건 구현 |
| 감리관 | CSAP-N2SF 역참조 추적성 |

### SUCCESS
| ID | 기준 |
|----|------|
| SC-C5-01 | N01~N06 6개 영역 전수 구현 가이드 파일 생성 |
| SC-C5-02 | 각 파일에 C/S/O 3등급 비교 테이블 포함 |
| SC-C5-03 | N03 격리: C등급 물리 격리 + MLS 전환 로드맵 |
| SC-C5-04 | CSAP 통제항목 역참조 완비 |
| SC-C5-05 | N03 k8s NetworkPolicy YAML 예시 |

---

## 산출물 목록

| 산출물 | 경로 | FR ID |
|--------|------|-------|
| N01 관리적 보안 | `docs/framework/03-n2sf/domains/N01-management-security.md` | FR-C5.1 |
| N02 인증 | `docs/framework/03-n2sf/domains/N02-authentication.md` | FR-C5.2 |
| N03 격리 | `docs/framework/03-n2sf/domains/N03-isolation.md` | FR-C5.3 |
| N04 암호화 | `docs/framework/03-n2sf/domains/N04-encryption.md` | FR-C5.4 |
| N05 데이터 | `docs/framework/03-n2sf/domains/N05-data.md` | FR-C5.5 |
| N06 운영 | `docs/framework/03-n2sf/domains/N06-operations.md` | FR-C5.6 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 | PM Lead Agent |
| 1.0.1 | 2026-04-07 | 아카이브 동기화 시 재작성 | PM Lead Agent |
