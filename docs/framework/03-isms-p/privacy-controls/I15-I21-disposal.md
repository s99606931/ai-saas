# ISMS-P 개인정보 처리단계별 보호조치: I-15~I-21 보유/파기 및 권리 보장

> MTU-C6b | FR-2.4-I | 적용 기준일: 2026-04-05
> 참조: 개인정보 보호법 제21조, 제35조~제37조

---

## 개요

ISMS-P 개인정보 생명주기 중 보유/파기 단계(4항목)와 정보주체 권리 보장(3항목) 총 7개 항목입니다.

---

## 항목별 구현 가이드

### ISMS-P-I-15: 보유 기간 설정

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-I-15 |
| 요구사항 | 개인정보 보유 기간 명시적 설정 |
| 핵심 요건 | 수집 시 보유 기간 고지, 법정 보존 기간 준수, 보유 기간 만료 자동 알림 |

**법정 보존 기간**:
| 법률 | 보존 대상 | 보존 기간 |
|------|---------|---------|
| 전자상거래법 | 계약·청약철회 기록 | 5년 |
| 전자상거래법 | 대금결제 기록 | 5년 |
| 전자상거래법 | 소비자 불만 처리 | 3년 |
| 통신비밀보호법 | 접속 로그 | 3개월 |
| 개인정보 보호법 | 표시·광고 기록 | 6개월 |

---

### ISMS-P-I-16: 보유 기간 만료 처리

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-I-16 |
| 요구사항 | 보유 기간 만료 시 즉시 파기 |
| 핵심 요건 | 만료일 D-30 알림, 만료일 자동 파기 스케줄러, 법정 보존 필요 시 분리 보관 |

**구현 예시**:
```typescript
// 보유 기간 만료 자동 파기 스케줄러
async function autoDeleteExpiredData(): Promise<void> {
  const expired = await db.personalData.findMany({
    where: { retentionExpiry: { lte: new Date() }, status: 'ACTIVE' }
  })

  for (const record of expired) {
    // 법정 보존 기간 확인
    if (hasLegalRetentionRequirement(record)) {
      await separateStorage(record) // 분리 보관
      continue
    }

    // 복구 불가 파기
    await secureDelete(record)
    await auditLog({
      actor: 'SYSTEM',
      action: 'PERSONAL_DATA_DELETE',
      target: record.userId,
      details: { reason: 'RETENTION_EXPIRED', originalExpiry: record.retentionExpiry },
      ismsPIControls: ['ISMS-P-I-16', 'ISMS-P-I-17'],
    })
  }
}
```

---

### ISMS-P-I-17: 파기 방법

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-I-17 |
| 요구사항 | 복구 불가능한 방법으로 파기 |
| 핵심 요건 | 전자 파일: 복구 불가 삭제 (덮어쓰기 3회), 출력물: 파쇄·소각, DB: TRUNCATE + 키 폐기 |

**파기 방법별 가이드**:
| 매체 유형 | 파기 방법 | 검증 방법 |
|---------|---------|---------|
| DB 레코드 | DELETE + 암호화 키 폐기 | 조회 불가 확인 |
| 파일 시스템 | `shred -vfz -n 3` | 복구 시도 후 불가 확인 |
| 백업 테이프 | 물리적 파쇄 | 파쇄 증적 사진 |
| SSD | TRIM + Secure Erase | 제조사 도구 검증 |

---

### ISMS-P-I-18: 파기 기록 보관

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-I-18 |
| 요구사항 | 파기 일시·대상·방법·담당자 기록 보관 |
| 핵심 요건 | 파기 기록 3년 보관, audit.jsonl 자동 기록, 파기 확인서 생성 |

---

### ISMS-P-I-19: 정보주체 열람권

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-I-19 |
| 요구사항 | 정보주체의 개인정보 열람 요구 처리 |
| 핵심 요건 | 열람 요구 접수 후 10일 이내 처리, 열람 범위·방법 안내, 열람 이력 기록 |

**구현 예시**:
```typescript
// 정보주체 열람 요구 API
async function handleAccessRequest(subjectId: string): Promise<PersonalDataView> {
  await auditLog({
    actor: subjectId,
    action: 'DATA_SUBJECT_ACCESS_REQUEST',
    target: subjectId,
    ismsPIControls: ['ISMS-P-I-19'],
  })

  const data = await db.personalData.findUnique({
    where: { userId: subjectId },
    select: {
      name: true, email: true, phone: true,
      collectedAt: true, purpose: true, retentionExpiry: true,
      // 암호화된 필드는 복호화하지 않고 존재 여부만 표시
      hasResidentNumber: true,
    }
  })

  return { data, requestedAt: new Date(), deadline: addDays(new Date(), 10) }
}
```

---

### ISMS-P-I-20: 정보주체 정정/삭제권

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-I-20 |
| 요구사항 | 개인정보 정정·삭제 요구 처리 |
| 핵심 요건 | 정정 요구 10일 이내 처리, 삭제 요구 시 법정 보존 외 즉시 삭제, 처리 결과 통보 |

---

### ISMS-P-I-21: 정보주체 처리 정지권

| 항목 | 내용 |
|------|------|
| ID | ISMS-P-I-21 |
| 요구사항 | 개인정보 처리 정지 요구 처리 |
| 핵심 요건 | 처리 정지 요구 10일 이내 처리, 정지 후 해당 정보 이용·제공 중단, 정지 이력 기록 |

---

## 개인정보 생명주기 흐름도

```
수집 (I-01~I-07)
  동의 확보 → 최소 수집 → 처리방침 공개
    |
    v
처리 (I-08~I-14)
  기록 관리 → 접근 통제 → 암호화 → 위탁 관리
    |
    v
보유/파기 (I-15~I-18)
  보유 기간 설정 → 만료 시 파기 → 파기 기록 보관
    |
    v
권리 보장 (I-19~I-21)
  열람권 → 정정/삭제권 → 처리정지권
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | MTU-C6b Do — 보유/파기 4항목 + 권리 보장 3항목 전수 작성 | Implementer Agent |
