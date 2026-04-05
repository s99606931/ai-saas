# MTU-A4: OSCAL 호환성 레이어 — 설계 문서

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-A4 |
| Phase | Phase 4 Advanced |
| 문서 유형 | Design |
| 버전 | 1.0.0 |
| 작성일 | 2026-04-05 |
| Plan 참조 | `docs/01-plan/mtus/MTU-A4-oscal-mapping.plan.md` |
| FR 매핑 | FR-7.1 |

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| WHY | FedRAMP OSCAL 의무화 2026-09, EU CRA 2027 — 기계가독형 규제 준수 문서 없이 글로벌 인증 불가 |
| WHO | 보안 아키텍트 (OSCAL 프로파일), CI/CD 담당 (oscal-cli 검증) |
| RISK | OSCAL 스키마 오류 시 FedRAMP 제출 불가 |
| SUCCESS | CSAP 79항목 + N2SF 6영역 OSCAL 매핑 + oscal-cli 검증 통과 |

---

## 1. 아키텍처 옵션 평가

### Option A: OSCAL Profile만 생성
- 장점: 최소 구현
- 단점: SSP 구조 미포함 → FedRAMP 제출 불가

### Option B: Profile + 매핑 가이드 (선택)
- 장점: 프로파일 JSON + 한국어 매핑 가이드로 실무자 접근성 확보
- 단점: 완전한 SSP는 별도 작업 필요
- **선택 근거**: 1세션 내 달성 가능 범위, SSP 확장은 추후

### Option C: 완전 OSCAL SSP
- 장점: FedRAMP 즉시 제출 가능
- 단점: 2+세션 필요, 시스템 구성요소 정보 필요

**최종 선택: Option B (Profile + 매핑 가이드)**

---

## 2. 산출물 구조

| 파일 | 형식 | 핵심 내용 |
|------|------|---------|
| `99-references/oscal/csap-profile.json` | OSCAL JSON | CSAP 79항목 control.id 매핑 |
| `99-references/oscal/oscal-mapping-guide.md` | 마크다운 | OSCAL 구조 + ID 변환 규칙 + oscal-cli 사용법 |

---

## 3. OSCAL ID 변환 체계

```
CSAP-D{분야}-{항목} → csap-d{분야}.{항목}
N2SF-N{영역}        → n2sf-n{영역}

예시:
  CSAP-D08-03 → csap-d08.03
  N2SF-N01    → n2sf-n01
```

---

## 4. Design Anchor

- Plan SC: FR-7.1 (OSCAL 호환성)
- Design Ref: NIST OSCAL 1.1.2 스키마
- Design Ref: FedRAMP OSCAL SSP 요구사항

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — Option B Profile + 매핑 가이드 선택 | Claude Code |
