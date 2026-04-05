# N2SF 데이터 분류 및 PII 마스킹 구현 가이드

> MTU-A1 | FR-6.2 | 적용 기준일: 2026-04-05
> 참조: MTU-C4 (N2SF 등급 분류), N2SF N-05 (데이터 관리)

---

## 1. 데이터 등급 분류 체계

| 등급 | 정의 | AI API 허용 | 마스킹 요건 | 예시 |
|------|------|:---------:|:---------:|------|
| C (기밀) | 국가 안보·군사 관련 | 외부 금지, 로컬만 | 전송 자체 차단 | 군사 정보, 수사 자료 |
| S (민감) | 개인정보·금융 정보 | 외부 금지, 로컬만 | 전송 자체 차단 | 주민번호, 계좌번호, 의료기록 |
| O (공개) | 공개 가능 데이터 | 외부 허용 | PII 마스킹 후 | 공공 통계, 정책 문서 |

---

## 2. PII 마스킹 규칙

### 2.1 마스킹 대상

| PII 유형 | 패턴 | 마스킹 결과 | 근거 |
|---------|------|-----------|------|
| 주민등록번호 | `XXXXXX-XXXXXXX` | `******-*******` | 개인정보보호법 제24조 |
| 전화번호 | `XXX-XXXX-XXXX` | `***-****-****` | 통신비밀보호법 |
| 이메일 | `user@domain.com` | `***@***.***` | 개인정보보호법 |
| 계좌번호 | `XXXX-XXXX-XXXX-XXXX` | `****-****-****-****` | 금융실명법 |
| 여권번호 | `M12345678` | `M********` | 개인정보보호법 |
| IP 주소 | `192.168.1.100` | `192.168.*.*` | 내부 IP 보호 |
| 한국 이름 (3자) | `홍길동` | `홍OO` | 가명처리 |

### 2.2 마스킹 구현

```typescript
class PIIMasker {
  private rules: MaskingRule[] = [
    // 주민등록번호 (6자리-7자리)
    { pattern: /(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])-([1-4])\d{6}/g,
      replacement: '******-*******', field: '주민등록번호' },

    // 전화번호
    { pattern: /01[016789]-\d{3,4}-\d{4}/g,
      replacement: '***-****-****', field: '휴대전화' },
    { pattern: /0\d{1,2}-\d{3,4}-\d{4}/g,
      replacement: '***-****-****', field: '유선전화' },

    // 이메일
    { pattern: /[\w.-]+@[\w.-]+\.\w{2,}/g,
      replacement: '***@***.***', field: '이메일' },

    // 카드번호 (4자리-4자리-4자리-4자리)
    { pattern: /\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/g,
      replacement: '****-****-****-****', field: '카드번호' },

    // 계좌번호 (은행별 다양한 형식)
    { pattern: /\d{3,4}-\d{2,6}-\d{2,6}/g,
      replacement: '***-******-******', field: '계좌번호' },
  ]

  mask(text: string): MaskingResult {
    let result = text
    const masked: string[] = []

    for (const rule of this.rules) {
      if (rule.pattern.test(result)) {
        result = result.replace(rule.pattern, rule.replacement)
        masked.push(rule.field)
      }
      rule.pattern.lastIndex = 0 // 정규식 상태 초기화
    }

    return { text: result, maskedFields: masked, originalLength: text.length }
  }

  validate(text: string): boolean {
    // 마스킹 후에도 PII가 남아있는지 검증
    const result = this.mask(text)
    return result.maskedFields.length === 0
  }
}
```

---

## 3. AI API 전송 전 데이터 등급 확인 흐름

```typescript
async function sendToAI(data: unknown, userId: string): Promise<AIResponse> {
  const classification = classifyData(data)

  // C/S등급: 외부 AI API 전송 절대 금지
  if (classification.grade === DataGrade.C || classification.grade === DataGrade.S) {
    await auditLog({
      actor: userId,
      action: 'AI_EXTERNAL_BLOCKED',
      result: 'BLOCKED',
      details: { grade: classification.grade, reason: 'N2SF N-05 외부 전송 금지' },
    })
    throw new Error(`BLOCKED: ${classification.grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
  }

  // O등급: PII 마스킹 후 전송
  const masker = new PIIMasker()
  const masked = masker.mask(JSON.stringify(data))

  // 마스킹 후 재검증
  if (!masker.validate(masked.text)) {
    throw new Error('마스킹 후에도 PII 잔존 탐지 — 전송 차단')
  }

  return aiGateway.send(masked.text)
}
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | MTU-A1 Do — 데이터 분류 + PII 마스킹 가이드 작성 | Implementer Agent |
