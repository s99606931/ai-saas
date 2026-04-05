# N2SF 데이터 등급 분류 및 AI API 연동 가이드

| 항목 | 내용 |
|------|------|
| 문서 ID | N2SF-GRADE-001 |
| 버전 | 1.0.0 |
| 최종 수정일 | 2026-04-05 |
| 대상 | 개발자, 보안 담당자, AI 연동 담당자 |
| FR 매핑 | FR-3.2, FR-3.2a, FR-3.2b |
| N2SF 근거 | 국가사이버안전관리규정 N-05 (데이터 보호) |
| CSAP 연계 | CSAP-D13-03 (N2SF 데이터 등급 분류) |

<!-- Design Ref: MTU-C4 Plan -- 데이터 등급 분류 -->
<!-- Plan SC: C/S/O 등급별 AI API 전송 허용 여부 + TypeScript 구현 패턴 -->

---

## 목적

N2SF(국가사이버안전관리규정)에 따라 공공기관 SaaS에서 처리하는 데이터를 **C(기밀)/S(민감)/O(공개)** 등급으로 분류하고, 등급별 처리 기준과 AI API 연동 판단 기준을 제공합니다.

이 가이드는 개발자가 **데이터 등급만 확인하면 AI API 전송 가능 여부를 5분 이내에 판단**할 수 있도록 설계되었습니다.

---

## 데이터 등급 정의

### 3등급 체계

| 등급 | 명칭 | 영문 | 설명 | 예시 |
|------|------|------|------|------|
| **C** | 기밀 | Classified | 유출 시 국가 안보 또는 개인 권익에 심각한 피해 | 주민등록번호, 의료 기록, 국가 안보 정보 |
| **S** | 민감 | Sensitive | 유출 시 조직 운영에 상당한 피해 | 인사 정보, 예산 정보, 내부 업무 문서, 계약 정보 |
| **O** | 공개 | Open | 공개 가능한 일반 정보 | 공고문, 서비스 안내, 공개 통계 |

### 등급별 보호 요건

| 보호 항목 | C (기밀) | S (민감) | O (공개) |
|---------|---------|---------|---------|
| **저장 암호화** | AES-256 필수 | AES-256 필수 | 권장 |
| **전송 암호화** | mTLS 필수 | TLS 1.3 필수 | TLS 1.3 필수 |
| **접근 통제** | 별도 승인 + MFA | RBAC + MFA (관리자) | RBAC |
| **감사 로그** | 전수 기록 (실시간) | 전수 기록 | 주요 이벤트 기록 |
| **백업 암호화** | 암호화 필수 | 암호화 필수 | 권장 |
| **AI API 전송** | **절대 금지** | **절대 금지** | PII 마스킹 후 허용 |
| **외부 공유** | 금지 | 승인 필수 + 암호화 | 가능 |
| **보관 기간** | 법령 기준 | 업무 기준 | 필요 시 |
| **폐기** | 복구 불가 삭제 | 안전 삭제 | 일반 삭제 |

---

## 데이터 분류 기준

### 분류 프로세스

```
데이터 식별
    │
    ▼
분류 기준 적용
    │
    ├── 개인정보 (주민등록번호, 건강정보, 금융정보) ──→ C (기밀)
    │
    ├── 국가 안보/외교 관련 정보 ──→ C (기밀)
    │
    ├── 내부 업무 정보 (인사/예산/계약) ──→ S (민감)
    │
    ├── 개인정보 (이름, 이메일, 전화번호) ──→ S (민감)
    │
    ├── 일반 개인 식별 정보 ──→ S (민감)
    │
    └── 공개 가능 정보 ──→ O (공개)
    │
    ▼
등급 확정 및 레이블 부여
```

### 상세 분류 기준표

| 데이터 유형 | 등급 | 분류 근거 |
|---------|------|---------|
| 주민등록번호 | C | 개인정보보호법 제24조 (고유식별정보) |
| 여권번호, 운전면허번호 | C | 개인정보보호법 제24조 |
| 건강/의료 정보 | C | 개인정보보호법 제23조 (민감정보) |
| 금융 계좌/카드 정보 | C | 신용정보법 |
| 생체 인식 정보 | C | 개인정보보호법 제23조 |
| 비밀번호 (해시 전) | C | CSAP-D09-04 |
| 인사 정보 (급여, 평가) | S | 내부 업무 정보 |
| 예산/결산 정보 | S | 내부 업무 정보 |
| 계약 정보 | S | 영업 비밀 |
| 이름, 이메일, 전화번호 | S | 일반 개인정보 |
| 직위, 소속 부서 | S | 일반 개인정보 |
| 시스템 설정/로그 | S | 내부 운영 정보 |
| 공고문, 보도자료 | O | 공개 정보 |
| 서비스 안내, FAQ | O | 공개 정보 |
| 공개 통계 데이터 | O | 공개 정보 |
| 법령/규정 텍스트 | O | 공개 정보 |

---

## AI API 연동 판단 기준

### 판단 흐름도

```
AI API 연동 요청
    │
    ▼
데이터 등급 확인 (DataGrade)
    │
    ├── C (기밀) ──→ AI API 전송 금지
    │                └─ 대안: 온프레미스 LLM (MTU-A2 LM Studio)
    │
    ├── S (민감) ──→ AI API 전송 금지
    │                └─ 대안: 온프레미스 LLM (MTU-A2 LM Studio)
    │
    └── O (공개) ──→ PII 마스킹 처리
                      │
                      ▼
                    마스킹 검증
                      │
                      ├── PII 잔존 ──→ 재마스킹
                      │
                      └── PII 제거 완료 ──→ AI API 전송 허용
                                            └─ MTU-A1 게이트웨이 경유
```

### TypeScript 구현 패턴

```typescript
// N2SF 데이터 등급 타입 (FR-3.2a)
enum DataGrade {
  C = 'C',  // 기밀 (Classified)
  S = 'S',  // 민감 (Sensitive)
  O = 'O',  // 공개 (Open)
}

// AI API 전송 통제 함수
async function sendToAI(data: unknown, grade: DataGrade): Promise<AIResponse> {
  // C, S 등급: AI API 전송 절대 금지 (N2SF N-05)
  if (grade === DataGrade.C || grade === DataGrade.S) {
    await auditLog({
      action: 'AI_API_BLOCKED',
      target: 'external_llm',
      result: 'failure',
      metadata: {
        grade,
        reason: `N2SF N-05: ${grade}등급 데이터 AI API 전송 금지`,
      },
    })
    throw new DataGradeError(
      `BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`,
      grade
    )
  }

  // O 등급: PII 마스킹 후 전송 (FR-3.2b)
  const masked = await maskPII(data)
  const validation = validateNoRemainingPII(masked)
  if (!validation.clean) {
    throw new PIIMaskingError(`PII 마스킹 불완전: ${validation.issues.join(', ')}`)
  }

  await auditLog({
    action: 'AI_API_SENT',
    target: 'external_llm',
    result: 'success',
    metadata: {
      grade: DataGrade.O,
      maskedFields: masked.maskedFieldCount,
    },
  })

  // MTU-A1 AI 보안 게이트웨이 경유
  return aiGateway.send(masked.data)
}
```

### PII 마스킹 패턴 (FR-3.2b)

```typescript
// PII 마스킹 함수
interface MaskingResult {
  data: unknown
  maskedFieldCount: number
  maskedFields: string[]
}

async function maskPII(data: unknown): Promise<MaskingResult> {
  const maskedFields: string[] = []

  function maskValue(key: string, value: unknown): unknown {
    if (typeof value !== 'string') return value

    // 주민등록번호 마스킹 (C등급이지만 혼입 방지)
    if (/\d{6}-?\d{7}/.test(value)) {
      maskedFields.push(key)
      return value.replace(/(\d{6})-?(\d{7})/, '$1-*******')
    }

    // 이메일 마스킹
    if (/\S+@\S+\.\S+/.test(value)) {
      maskedFields.push(key)
      return value.replace(/(\S{2})\S+(@\S+)/, '$1***$2')
    }

    // 전화번호 마스킹
    if (/01[016789]-?\d{3,4}-?\d{4}/.test(value)) {
      maskedFields.push(key)
      return value.replace(/(01\d)-?(\d{3,4})-?(\d{4})/, '$1-****-$3')
    }

    // 이름 마스킹 (2자 이상 한글)
    if (/^[가-힣]{2,5}$/.test(value)) {
      maskedFields.push(key)
      return value[0] + '*'.repeat(value.length - 1)
    }

    return value
  }

  const masked = JSON.parse(JSON.stringify(data), (key, value) => maskValue(key, value))

  return {
    data: masked,
    maskedFieldCount: maskedFields.length,
    maskedFields,
  }
}

// PII 잔존 검증
function validateNoRemainingPII(result: MaskingResult): { clean: boolean; issues: string[] } {
  const issues: string[] = []
  const jsonStr = JSON.stringify(result.data)

  // 주민등록번호 패턴 (마스킹 안 된 것)
  if (/\d{6}-\d{7}/.test(jsonStr)) issues.push('주민등록번호 잔존')
  // 완전 이메일 패턴
  if (/[a-zA-Z0-9._%+-]{3,}@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(jsonStr)) issues.push('이메일 잔존')

  return { clean: issues.length === 0, issues }
}
```

### 데이터 등급 자동 분류 헬퍼

```typescript
// 데이터 유형별 등급 자동 분류
const DATA_TYPE_GRADES: Record<string, DataGrade> = {
  // C등급 (기밀)
  'ssn': DataGrade.C,                // 주민등록번호
  'passport_number': DataGrade.C,    // 여권번호
  'health_record': DataGrade.C,      // 건강정보
  'financial_account': DataGrade.C,  // 금융계좌
  'biometric': DataGrade.C,          // 생체정보
  'plaintext_password': DataGrade.C, // 평문 비밀번호

  // S등급 (민감)
  'hr_data': DataGrade.S,            // 인사정보
  'budget_data': DataGrade.S,        // 예산정보
  'contract_data': DataGrade.S,      // 계약정보
  'personal_name': DataGrade.S,      // 이름
  'personal_email': DataGrade.S,     // 이메일
  'personal_phone': DataGrade.S,     // 전화번호
  'system_config': DataGrade.S,      // 시스템 설정
  'audit_log': DataGrade.S,          // 감사 로그

  // O등급 (공개)
  'public_notice': DataGrade.O,      // 공고문
  'service_guide': DataGrade.O,      // 서비스 안내
  'public_statistics': DataGrade.O,  // 공개 통계
  'law_regulation': DataGrade.O,     // 법령/규정
}

function classifyData(dataType: string): DataGrade {
  const grade = DATA_TYPE_GRADES[dataType]
  if (!grade) {
    // 미분류 데이터는 안전하게 S(민감) 처리
    console.warn(`미분류 데이터 유형: ${dataType} -> S(민감) 기본 적용`)
    return DataGrade.S
  }
  return grade
}
```

---

## 등급별 처리 요약 매트릭스

| 처리 행위 | C (기밀) | S (민감) | O (공개) |
|---------|---------|---------|---------|
| DB 저장 | AES-256 암호화 필수 | AES-256 암호화 필수 | 평문 가능 (권장 암호화) |
| API 전송 | mTLS + 암호화 | TLS 1.3 | TLS 1.3 |
| AI API 전송 | **금지** | **금지** | 마스킹 후 허용 |
| 화면 표시 | 마스킹 기본 | 마스킹 기본 (관리자 해제 가능) | 그대로 표시 |
| 로그 기록 | 접근 전수 기록 | 접근 전수 기록 | 주요 이벤트 |
| 내보내기 | 금지 (특별 승인 시만) | 승인 필수 | 가능 |
| 백업 | 암호화 필수 | 암호화 필수 | 권장 |
| 복제/이전 | 금지 | 승인 필수 | 가능 |
| 외부 공유 | 금지 | 승인 + 암호화 | 가능 |

---

## 연계 MTU

| MTU | 연계 내용 |
|------|---------|
| MTU-A1 AI 보안 게이트웨이 | O등급 데이터 AI API 전송 시 게이트웨이 경유 |
| MTU-A2 LM Studio 가이드 | C/S등급 데이터 온프레미스 LLM 처리 |
| MTU-C5 N2SF 6개 영역 통제 | N2SF 영역별 상세 통제 정책 |
| MTU-C8 공급망 보안 | 데이터 포함 이미지/SBOM 관리 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 -- C/S/O 3등급 체계 + AI API 판단 흐름 + TypeScript 구현 패턴 (DataGrade enum + maskPII) | Claude Code |
