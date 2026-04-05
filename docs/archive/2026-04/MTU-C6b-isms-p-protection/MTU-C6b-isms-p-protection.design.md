# MTU-C6b: ISMS-P 보호 분야 + 개인정보 처리단계별 보호조치 — 설계 문서

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-C6b |
| Phase | Phase 3 Infrastructure |
| 문서 유형 | Design |
| 버전 | 1.0.0 |
| 작성일 | 2026-04-05 |
| Plan 참조 | `docs/01-plan/mtus/MTU-C6b-isms-p-protection.plan.md` |
| FR 매핑 | FR-2.4-P, FR-2.4-I, FR-2.4-Pa, FR-2.4-Pb, FR-2.4-Pc |

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| WHY | ISMS-P 2027-07 의무화 대응 — 보호 분야 64항목 + 개인정보 21항목 구현 가이드 미비 시 심사 불합격 |
| WHO | 보안 담당자 (보호대책 구현), 개인정보 책임자 (개인정보 통제), 개발자 (코드 패턴 적용) |
| RISK | 85항목 중 1개라도 누락 시 ISMS-P 심사 결함 → 인증 불가 |
| SUCCESS | 85항목 전수 구현 가이드 + Gitea Actions 자동 증적 수집 + CSAP 교차 참조 완비 |

---

## 1. 아키텍처 옵션 평가

### Option A: 단일 통합 문서
- 장점: 파일 1개로 관리 용이
- 단점: 85항목 단일 파일 시 10,000줄 이상, 탐색 불가

### Option B: 분야별 분할 (선택)
- 장점: 접근통제(P1-14), 암호화(P15-29), 네트워크(P30-44), 운영(P45-64), 개인정보 3파일 — 역할별 참조 용이
- 단점: 파일 수 8개로 관리 복잡도 증가
- **선택 근거**: CTO R-03 분할 결정 반영, 역할별 독립 검토 가능

### Option C: 항목별 개별 파일
- 장점: 최대 유연성
- 단점: 85개 파일 → 관리 비용 과다

**최종 선택: Option B (분야별 분할)**

---

## 2. 산출물 구조

### 2.1 보호 분야 (64항목, 4개 파일)

| 파일 | ISMS-P 항목 | 항목 수 |
|------|-----------|--------|
| `07-isms-p/protection-controls/P01-P14-access.md` | P-01~P-14 | 14 |
| `07-isms-p/protection-controls/P15-P29-crypto.md` | P-15~P-29 | 15 |
| `07-isms-p/protection-controls/P30-P44-network.md` | P-30~P-44 | 15 |
| `07-isms-p/protection-controls/P45-P64-operation.md` | P-45~P-64 | 20 |

### 2.2 개인정보 처리단계별 보호조치 (21항목, 3개 파일)

| 파일 | ISMS-P 항목 | 항목 수 | 처리 단계 |
|------|-----------|--------|---------|
| `07-isms-p/privacy-controls/I01-I07-collection.md` | I-01~I-07 | 7 | 수집 |
| `07-isms-p/privacy-controls/I08-I14-processing.md` | I-08~I-14 | 7 | 처리 |
| `07-isms-p/privacy-controls/I15-I21-disposal.md` | I-15~I-21 | 7 | 보유/파기/권리보장 |

### 2.3 자동 증적 수집 (1개 파일)

| 파일 | 내용 |
|------|------|
| `07-isms-p/evidence-automation-guide.md` | Gitea Actions YAML + audit.jsonl 스키마 + 월간 리포트 |

---

## 3. 항목별 구현 가이드 표준 형식

각 항목은 다음 형식을 따릅니다:

```markdown
### ISMS-P-P-XX: {항목명}

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-P-XX |
| 요구사항 | {요구사항 설명} |
| 핵심 요건 | {구체적 요건} |
| CSAP 중첩 | {CSAP-DXX-YY 교차 참조} |
| 구현 패턴 | {기술적 구현 방법} |

**구현 예시**:
{TypeScript/YAML/Bash 코드 예시}

**증적 자료**: {audit.jsonl 자동 수집 항목}
```

---

## 4. CSAP 교차 참조 매트릭스

| CSAP 분야 | ISMS-P 중첩 항목 | 중복 수 |
|----------|----------------|--------|
| D-08 접근 통제 | P-01~P-14 | 12 |
| D-09 암호화 | P-15~P-29 | 8 |
| D-10 네트워크 보안 | P-30~P-44 | 6 |
| D-12 시스템 개발 보안 | P-33~P-38 | 5 |
| D-06 침해사고 관리 | P-55~P-60 | 4 |
| **합계** | — | **약 30개 중복** |

---

## 5. Session Guide

### Session 1: 보호 분야 64항목
1. P01-P14 접근 통제 (14항목)
2. P15-P29 암호화 (15항목)
3. P30-P44 네트워크/개발/취약점 (15항목)
4. P45-P64 운영/사고/연속성 (20항목)

### Session 2: 개인정보 + 자동 증적
1. I01-I07 수집 (7항목)
2. I08-I14 처리 (7항목)
3. I15-I21 보유/파기/권리보장 (7항목)
4. evidence-automation-guide.md 완성

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — Option B 분야별 분할 선택 | Claude Code |
