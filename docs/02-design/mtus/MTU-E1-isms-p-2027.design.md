# MTU-E1: ISMS-P 2027년 의무화 대응 완성 가이드 — 설계 문서

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-E1 |
| Phase | Phase 5 Ecosystem |
| 문서 유형 | Design |
| 버전 | 1.0.0 |
| 작성일 | 2026-04-05 |
| Plan 참조 | `docs/01-plan/mtus/MTU-E1-isms-p-2027.plan.md` |
| FR 매핑 | FR-8.4 |

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| WHY | 2027-07 ISMS-P 의무화 — 미준비 시 서비스 운영 제한 |
| WHO | CISO (심사 총괄), 보안 담당 (증적 관리), 개발팀 (자동화 구현) |
| RISK | 심사 불합격 시 서비스 중단 + 재심사 비용 |
| SUCCESS | 심사 4단계 체크리스트 + 자동 증적 수집 + CSAP 중복 30개 매핑 |

---

## 1. 아키텍처 옵션 평가

### Option A: CSAP 증적 수동 재활용
- 장점: 즉시 시작
- 단점: 수동 매핑 오류 위험, 101항목 수동 대조

### Option B: 자동 매핑 + 증적 파이프라인 (선택)
- 장점: CSAP 증적 자동 재활용, 증적 수집 80% 자동화
- 단점: 파이프라인 초기 설정 필요
- **선택 근거**: MTU-C6b 자동 증적 인프라 기반 확장

### Option C: 외부 ISMS-P 컨설팅 위탁
- 장점: 전문가 투입
- 단점: CLAUDE.md 외부 서비스 금지 제약

**최종 선택: Option B (자동 매핑 + 증적 파이프라인)**

---

## 2. 산출물 구조

| 파일 | 문서 유형 | 핵심 내용 |
|------|---------|---------|
| `07-isms-p/certification-guide.md` | 절차서 | 심사 4단계 체크리스트 + 2027 타임라인 |
| `07-isms-p/auto-evidence-collection.md` | 구현 가이드 | audit.jsonl → ISMS-P 보고서 자동 생성 |

---

## 3. Design Anchor

- Plan SC: FR-8.4 (ISMS-P 의무화 대응)
- Design Ref: MTU-C6a ISMS-P 101항목 체크리스트
- Design Ref: MTU-C6b 자동 증적 수집 인프라

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — Option B 자동 매핑 선택 | Claude Code |
