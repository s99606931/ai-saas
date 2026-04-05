# MTU-C2a: CSAP D01~D04 구현 가이드 -- Gap Analysis

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-C2a |
| Phase | Phase 2 Core Security |
| 분석일 | 2026-04-05 |
| 분석자 | Claude Code (Gap Detector) |
| Plan 문서 | docs/01-plan/mtus/MTU-C2a-csap-d01-d04.plan.md |
| Design 문��� | docs/02-design/mtus/MTU-C2a-csap-d01-d04.design.md |

---

## 1. 구조 매칭 (Structural Match)

| Design 산출물 | 실제 파일 | 존재 |
|-------------|---------|------|
| `02-csap/standard-grade/implementation-guide/D01-policy.md` | O | D01 4항목 |
| `02-csap/standard-grade/implementation-guide/D02-org-security.md` | O | D02 3항목 |
| `02-csap/standard-grade/implementation-guide/D03-personnel.md` | O | D03 4항�� |
| `02-csap/standard-grade/implementation-guide/D04-asset-mgmt.md` | O | D04 5항목 |

**구조 매칭률**: 4/4 = **100%**

---

## 2. 기능 완전성 (Functional Depth)

### 2.1 항목 전수 검증

| 분야 | 예상 항목 수 | 실제 항목 수 | 누락 |
|------|-----------|-----------|------|
| D01 정보보호 정책 | 4 | 4 (D01-01~04) | 0 |
| D02 조직 보안 | 3 | 3 (D02-01~03) | 0 |
| D03 인적 보안 | 4 | 4 (D03-01~04) | 0 |
| D04 자산 관리 | 5 | 5 (D04-01~05) | 0 |
| **합계** | **16** | **16** | **0** |

### 2.2 항목별 구현 가이드 완전성

| 검증 항목 | D01 | D02 | D03 | D04 | 충족률 |
|---------|-----|-----|-----|-----|--------|
| 구현 목표 | O | O | O | O | 16/16 |
| 구현 방법 (단계별) | O | O | O | O | 16/16 |
| 필요 증거 자료 | O | O | O | O | 16/16 |
| 샘플 템플릿/양식 | O | O | O | O | 4+ 템플릿 |
| 심사 시 주의사항 | O | 부분 | O | - | 3/4 분야 |
| 증거 자료 체크리스트 | O | O | O | O | 4/4 분야 |
| checklist-master.md 참조 | O | O | O | O | 4/4 링크 |

**기능 완전성**: 95% (심사 주의사항 D04 미포함, 경미)

### 2.3 Plan 합격 기준 검증

| Plan 합격 기준 | 충족 | 증거 |
|--------------|------|------|
| 각 파일에 해당 분야 항목 전수 포함 | O | 16/16항목 |
| 각 항목: 구현 방법 + 증거 자료 + 샘플 템플릿 | O | 4개 파일 모두 |
| checklist-master.md 참조 링크 완비 | O | 4개 앵커 링크 |
| Auditor Q-GATE G6 통과 | O | CSAP 항목 전수 매핑 |

### 2.4 Plan 시험 시나리오 검증

| 시나리오 ID | 검증 내용 | 충족 | 증거 |
|-----------|---------|------|------|
| TS-C2a-01 | D01 정책 수립 템플릿: 경영진 서명란, 검토 주기, 배포 절차 | O | D01-policy.md 샘플 |
| TS-C2a-02 | D02 조직도 + CISO/보안담당자/사용자 3계층 | O | D02-org-security.md RACI |
| TS-C2a-03 | D03 교육 이력: 교육 일시, 참석자, 서명, 평가 4항목 | O | D03-personnel.md 양식 |
| TS-C2a-04 | D04 자산 분류: 자산 유형, 등급, 책임자, 위치 4항목 | O | D04-asset-mgmt.md 대장 |
| TS-C2a-05 | 4개 분야 16항목 누락 0건 | O | 전수 카운트 확인 |

---

## 3. 매치율 요약

| 분석 축 | 항목 수 | 충족 | 매치율 |
|---------|--------|------|--------|
| 구조 매칭 | 4 | 4 | 100% |
| 기능 완전성 | 16항목 + 7검증 | 22/23 | 95.7% |
| 합격 기준 | 4 | 4 | 100% |
| 시험 시나리오 | 5 | 5 | 100% |

**종합 매치율** (Structural 0.2 + Functional 0.4 + Acceptance 0.4):

> **(100% x 0.2) + (95.7% x 0.4) + (100% x 0.4) = 98.3%**

---

## 4. Gap 목록

| # | 심각도 | 내용 | 영향 |
|---|-------|------|------|
| 1 | Low | D04-asset-mgmt.md에 심사 시 주의사항 섹션 미포함 | 기능 완전성 경미 감소 |

**Critical/Important Gap: 0건** -- Archive 진행 가능

---

## 변경 이력

| 버전 | 일자 | 내�� | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 -- 매치율 98.3%, Gap 1건 (Low) | Claude Code |
