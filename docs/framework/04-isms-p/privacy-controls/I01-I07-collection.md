# ISMS-P 개인정보 처리단계별 보호조치: I-01~I-07 수집 단계

> MTU-C6b | FR-2.4-I | 적용 기준일: 2026-04-05
> 참조: 개인정보 보호법 제15조~제22조

---

## 개요

ISMS-P 개인정보 생명주기 중 수집 단계 7개 항목입니다.
공공기관 SaaS에서 개인정보 수집 동의, 최소 수집, 목적 외 이용 금지 등을 구현합니다.

---

## 항목별 구현 가이드

### ISMS-P-I-01: 개인정보 수집 동의

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-I-01 |
| 요구사항 | 개인정보 수집 시 정보주체 동의 확보 |
| 핵심 요건 | 수집 목적·항목·보유기간 고지, 명시적 동의 (체크박스 미사전선택), 동의 이력 기록 |
| CSAP 중첩 | 해당 없음 (개인정보 고유) |

**구현 예시**:
```typescript
interface ConsentRecord {
  userId: string
  consentType: 'COLLECTION' | 'THIRD_PARTY' | 'MARKETING'
  purpose: string
  items: string[]        // 수집 항목 목록
  retentionPeriod: string // 보유 기간
  consentedAt: string
  method: 'WEB_CHECKBOX' | 'MOBILE_TOGGLE' | 'WRITTEN'
  version: string        // 동의서 버전
}

async function recordConsent(consent: ConsentRecord): Promise<void> {
  await db.consents.create({ data: consent })
  await auditLog({
    actor: consent.userId,
    action: 'PERSONAL_DATA_CONSENT',
    details: { type: consent.consentType, items: consent.items },
    ismsPIControls: ['ISMS-P-I-01'],
  })
}
```

---

### ISMS-P-I-02: 최소 수집 원칙

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-I-02 |
| 요구사항 | 서비스에 필요한 최소한의 개인정보만 수집 |
| 핵심 요건 | 필수·선택 항목 분리, 선택 항목 미동의 시에도 서비스 제공, 수집 항목 정기 검토 |

---

### ISMS-P-I-03: 수집 제한

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-I-03 |
| 요구사항 | 법적 근거 없는 개인정보 수집 금지 |
| 핵심 요건 | 수집 법적 근거 명시 (동의/법률/계약/공공 이익), 근거 없는 수집 시스템 차단 |

---

### ISMS-P-I-04: 목적 외 이용 금지

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-I-04 |
| 요구사항 | 수집 목적 외 이용·제공 금지 |
| 핵심 요건 | 목적 외 이용 시 별도 동의, 이용 이력 기록, 목적 달성 후 파기 |

**구현 예시**:
```typescript
async function accessPersonalData(
  accessor: User, dataSubjectId: string, purpose: string
): Promise<PersonalData> {
  // 접근 목적 검증
  const consent = await db.consents.findFirst({
    where: { userId: dataSubjectId, purpose, revokedAt: null }
  })
  if (!consent) {
    throw new Error('ISMS-P-I-04: 목적 외 개인정보 접근 차단')
  }

  await auditLog({
    actor: accessor.id,
    action: 'PERSONAL_DATA_ACCESS',
    target: dataSubjectId,
    details: { purpose },
    ismsPIControls: ['ISMS-P-I-04', 'ISMS-P-I-08'],
  })

  return db.personalData.findUnique({ where: { userId: dataSubjectId } })
}
```

---

### ISMS-P-I-05: 개인정보 처리 방침

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-I-05 |
| 요구사항 | 개인정보 처리 방침 공개 |
| 핵심 요건 | 웹사이트 메인 하단 링크 노출, 변경 7일 전 사전 고지, 이전 버전 열람 가능 |

---

### ISMS-P-I-06: 제3자 제공 동의

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-I-06 |
| 요구사항 | 개인정보 제3자 제공 시 별도 동의 |
| 핵심 요건 | 제공받는 자·목적·항목·보유기간 고지, 별도 동의 확보, 제공 이력 기록 |
| CSAP 중첩 | 해당 없음 (개인정보 고유) |

---

### ISMS-P-I-07: 민감 정보 처리 제한

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-I-07 |
| 요구사항 | 사상·신념·건강·유전 등 민감 정보 별도 관리 |
| 핵심 요건 | 민감 정보 수집 시 별도 동의, 암호화 저장 필수, 접근 로그 강화 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | MTU-C6b Do — 개인정보 수집 단계 7항목 전수 작성 | Implementer Agent |
