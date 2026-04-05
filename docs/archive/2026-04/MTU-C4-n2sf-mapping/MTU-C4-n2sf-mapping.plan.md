# MTU-C4: N2SF 등급 분류 + CSAP 매핑

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-C4 |
| Phase | Phase 2 Core Security |
| 상태 | Draft |
| 작성일 | 2026-04-05 |
| FR 매핑 | FR-3.1, FR-3.2 |
| 의존 MTU | MTU-C1, MTU-C3 |
| 예상 세션 | 1 세션 |

---

## 목적

CSAP 79개 통제항목과 N2SF(국가사이버안전관리규정) 6개 보안 영역(N01~N06) 간 전수 매핑 테이블을 생성합니다.
데이터 등급(C·S·O)별 통제 요건을 명시하여 AI API 연동 시 데이터 분류 판단 기준을 제공합니다.

**N2SF 배경**:
- N2SF(국가 사이버안전 프레임워크): 국정원 고시 기반, 공공기관 필수 적용
- CSAP와 N2SF는 상호 보완 관계 — CSAP는 클라우드 서비스 기술 통제, N2SF는 조직·운영 통제 강조
- 데이터 등급 분류: C(기밀), S(민감), O(공개) — C/S 등급 데이터는 외부 AI API 전송 금지

---

## 산출물 파일 (2개)

| 파일 | 문서 유형 | 핵심 내용 |
|------|---------|---------|
| `03-n2sf/csap-n2sf-mapping.md` | 매핑 테이블형 | CSAP 79항목 × N2SF 6개 영역 전수 매핑 |
| `03-n2sf/data-grade-classification.md` | 구현 가이드형 | C/S/O 등급별 통제 요건 + AI API 연동 판단 기준 |

---

## N2SF 6개 보안 영역 정의

| 영역 코드 | 영역명 | 설명 | 대응 CSAP 분야 |
|---------|--------|------|-------------|
| N01 | 관리적 보안 | 정보보호 정책·조직·교육 | D01, D02, D03 |
| N02 | 인증 | 사용자 식별·인증·접근 통제 | D08 |
| N03 | 격리 | 네트워크 분리·시스템 격리 | D10 (물리) |
| N04 | 암호화 | 데이터 암호화·키 관리 | D09 |
| N05 | 데이터 | 데이터 분류·처리·폐기 | D04, D13 |
| N06 | 운영 | 취약점 관리·감사·복구 | D06, D07, D12 |

---

## 데이터 등급 분류 체계

### 등급 정의

| 등급 | 명칭 | 설명 | AI API 전송 |
|------|------|------|-----------|
| **C** | 기밀 (Classified) | 국가 안보·개인정보·영업 비밀 | **금지** (N2SF N-05 위반) |
| **S** | 민감 (Sensitive) | 내부 업무·인사·예산 정보 | **금지** (N2SF N-05 위반) |
| **O** | 공개 (Open) | 공개 가능 일반 정보 | 허용 (PII 마스킹 필수) |

### AI API 연동 판단 흐름

```
데이터 요청
    │
    ▼
데이터 등급 확인
    │
    ├── C (기밀) ──→ AI API 전송 금지 → 온프레미스 LLM 처리 (MTU-A2)
    │
    ├── S (민감) ──→ AI API 전송 금지 → 온프레미스 LLM 처리 (MTU-A2)
    │
    └── O (공개) ──→ PII 마스킹 처리 → AI API 전송 허용 (MTU-A1 게이트웨이 경유)
```

### 구현 패턴 (TypeScript)

```typescript
// N2SF N-05 AI API 데이터 등급 통제 (CSAP-D08-02, D09-01 연계)
enum DataGrade { C = 'C', S = 'S', O = 'O' }

async function sendToAI(data: unknown, grade: DataGrade): Promise<AIResponse> {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    await auditLog({
      action: 'AI_BLOCKED',
      reason: `N2SF N-05: ${grade}등급 데이터 AI API 전송 금지`,
      grade,
    })
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
  }
  // O 등급: PII 마스킹 후 전송
  const masked = await maskPII(data)
  return aiGateway.send(masked)
}
```

---

## CSAP ↔ N2SF 매핑 구조 (요약)

| CSAP 분야 | 항목 수 | 주요 N2SF 영역 | 매핑 형태 |
|---------|---------|-------------|---------|
| D01 정보보호 정책 | 4 | N01 | 1:1 직접 매핑 |
| D02 조직 보안 | 3 | N01 | 1:1 직접 매핑 |
| D03 인적 보안 | 4 | N01 | 1:1 직접 매핑 |
| D04 자산 관리 | 5 | N05 | 데이터 분류 연계 |
| D05 공급망 관리 | 4 | N06 | 운영 통제 연계 |
| D06 침해사고 관리 | 5 | N06 | 운영 통제 연계 |
| D07 재해 복구 | 3 | N06 | 운영 통제 연계 |
| D08 접근 통제 | 12 | N02 | 1:1 직접 매핑 |
| D09 암호화 | 4 | N04 | 1:1 직접 매핑 |
| D10 물리 보안 | 3 | N03 | 격리 통제 연계 |
| D11 시스템개발보안 | 10 | N05, N06 | 다중 매핑 |
| D12 운영 보안 | 8 | N06 | 1:1 직접 매핑 |
| D13 배포 보안 | 4 | N05, N06 | 다중 매핑 |
| **합계** | **79** | **N01~N06 전수** | — |

---

## 기능 요구사항

| ID | 요구사항 | 수용 기준 |
|----|---------|---------|
| FR-3.1 | CSAP 79항목 전수 N2SF 매핑 | 79행 × (CSAP ID + N2SF 영역 + 매핑 근거) |
| FR-3.2 | 데이터 등급별 통제 요건 | C/S/O 각 등급 AI 연동 판단 기준 명시 |
| FR-3.2a | AI API 차단 구현 패턴 | TypeScript `DataGrade` enum + 차단 로직 예시 |
| FR-3.2b | PII 마스킹 패턴 | O 등급 데이터 마스킹 처리 예시 |

---

## 합격 기준

1. `csap-n2sf-mapping.md`: CSAP 79항목 전수 N2SF 영역 매핑 (누락 항목 0개)
2. 각 매핑 행에 N2SF 영역 코드(N01~N06) + 매핑 근거 설명 포함
3. `data-grade-classification.md`: C/S/O 등급별 AI API 전송 허용 여부 명시
4. DataGrade enum 기반 TypeScript 구현 패턴 포함
5. MTU-C5 (`N2SF 6개 영역 통제`) 참조 링크 완비
6. MTU-A1 (AI 보안 게이트웨이) 연계 설명 포함
7. Auditor 에이전트 Q-GATE G6 통과

---

## 테스트 시나리오

**TS-C4-01**: 기술 PM이 `csap-n2sf-mapping.md`에서 임의 CSAP 항목 10개 조회 시 N2SF 매핑 전수 확인 가능
**TS-C4-02**: 개발자가 `data-grade-classification.md`만으로 데이터 등급 판단 → AI API 전송 가능 여부 5분 이내 결정

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 최초 작성 — CSAP×N2SF 매핑 + 데이터 등급 분류 체계 설계 | Claude Code |
