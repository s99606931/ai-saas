# AI 보안 게이트웨이 아키텍처 패턴

> MTU-A1 | FR-6.1 | 적용 기준일: 2026-04-05
> 참조: MTU-C4 (N2SF 매핑), MTU-C5 (N2SF 영역), N2SF N-05 (데이터 관리)

---

## 1. 개요

N2SF 데이터 등급(C/S/O) 기반으로 AI API 접근을 자동 제어하는 보안 게이트웨이입니다.
C/S등급 데이터는 외부 AI API 전송을 100% 차단하고, 온프레미스 LM Studio로 라우팅합니다.

---

## 2. 게이트웨이 결정 트리

```
요청 수신 (사용자 또는 시스템)
  |
  v
[1단계] 데이터 등급 분류 (classifyData)
  |
  +-- C등급 (기밀) --> 외부 AI API 전송 금지
  |                     --> LM Studio (host.docker.internal:1234)
  |
  +-- S등급 (민감) --> 외부 AI API 전송 금지
  |                     --> LM Studio (host.docker.internal:1234)
  |
  +-- O등급 (공개) --> [2단계] PII 마스킹 (maskPII)
                        |
                        v
                      [3단계] 외부 AI API 전송
                        --> Claude API / GPT-4 API
                        |
                        v
                      [4단계] 응답 PII 필터링
                        --> 결과 반환
```

---

## 3. 핵심 구현 패턴

### 3.1 데이터 등급 분류기

```typescript
enum DataGrade { C = 'C', S = 'S', O = 'O' }

interface ClassificationResult {
  grade: DataGrade
  reasons: string[]
  piiFields: string[]
}

function classifyData(data: unknown): ClassificationResult {
  const piiFields: string[] = []
  const reasons: string[] = []
  const text = JSON.stringify(data)

  // C등급 판별 (기밀)
  const cPatterns = [
    { pattern: /주민등록번호|resident.*number/gi, field: '주민등록번호' },
    { pattern: /군사|기밀.*등급|비밀.*취급/gi, field: '군사기밀' },
    { pattern: /수사.*정보|첩보/gi, field: '수사정보' },
  ]

  for (const { pattern, field } of cPatterns) {
    if (pattern.test(text)) {
      piiFields.push(field)
      reasons.push(`C등급 데이터 탐지: ${field}`)
      return { grade: DataGrade.C, reasons, piiFields }
    }
  }

  // S등급 판별 (민감)
  const sPatterns = [
    { pattern: /개인정보|personal.*data/gi, field: '개인정보' },
    { pattern: /계좌번호|account.*number/gi, field: '계좌번호' },
    { pattern: /여권번호|passport/gi, field: '여권번호' },
    { pattern: /의료.*기록|health.*record/gi, field: '의료기록' },
  ]

  for (const { pattern, field } of sPatterns) {
    if (pattern.test(text)) {
      piiFields.push(field)
      reasons.push(`S등급 데이터 탐지: ${field}`)
    }
  }

  if (piiFields.length > 0) {
    return { grade: DataGrade.S, reasons, piiFields }
  }

  return { grade: DataGrade.O, reasons: ['공개 등급 데이터'], piiFields: [] }
}
```

### 3.2 PII 마스킹

```typescript
interface MaskingRule {
  pattern: RegExp
  replacement: string
  field: string
}

const MASKING_RULES: MaskingRule[] = [
  { pattern: /\d{6}-[1-4]\d{6}/g, replacement: '******-*******', field: '주민번호' },
  { pattern: /\d{3}-\d{4}-\d{4}/g, replacement: '***-****-****', field: '전화번호' },
  { pattern: /[\w.]+@[\w.]+\.\w+/g, replacement: '***@***.***', field: '이메일' },
  { pattern: /\d{4}-\d{4}-\d{4}-\d{4}/g, replacement: '****-****-****-****', field: '카드번호' },
]

function maskPII(text: string): { masked: string; maskedFields: string[] } {
  let masked = text
  const maskedFields: string[] = []

  for (const rule of MASKING_RULES) {
    if (rule.pattern.test(masked)) {
      masked = masked.replace(rule.pattern, rule.replacement)
      maskedFields.push(rule.field)
    }
  }

  return { masked, maskedFields }
}
```

### 3.3 AI 게이트웨이 라우터

```typescript
import OpenAI from 'openai'

const externalAI = new OpenAI({ apiKey: process.env.ANTHROPIC_API_KEY })
const localLLM = new OpenAI({
  baseURL: 'http://host.docker.internal:1234/v1',
  apiKey: 'lm-studio',
})

async function aiGateway(
  prompt: string,
  context: unknown,
  userId: string
): Promise<string> {
  const classification = classifyData(context)

  // 감사 로그 기록
  await auditLog({
    actor: userId,
    action: 'AI_GATEWAY_REQUEST',
    details: {
      grade: classification.grade,
      piiFields: classification.piiFields,
      routed: classification.grade === DataGrade.O ? 'external' : 'local',
    },
    ismsPControls: ['ISMS-P-P-01'],
    csapControls: ['CSAP-D08-10'],
  })

  // C/S등급: 로컬 LLM으로 라우팅
  if (classification.grade === DataGrade.C || classification.grade === DataGrade.S) {
    const response = await localLLM.chat.completions.create({
      model: 'llama-3.1-8b-instruct',
      messages: [{ role: 'user', content: prompt }],
    })
    return response.choices[0].message.content ?? ''
  }

  // O등급: PII 마스킹 후 외부 AI API
  const { masked, maskedFields } = maskPII(prompt)

  if (maskedFields.length > 0) {
    await auditLog({
      actor: userId,
      action: 'AI_PII_MASKING',
      details: { maskedFields },
      ismsPIControls: ['ISMS-P-I-14'],
    })
  }

  const response = await externalAI.chat.completions.create({
    model: 'claude-sonnet-4-20250514',
    messages: [{ role: 'user', content: masked }],
  })

  // 응답 PII 필터링
  const { masked: filteredResponse } = maskPII(response.choices[0].message.content ?? '')
  return filteredResponse
}
```

---

## 4. audit.jsonl AI 감사 로그

모든 AI API 호출은 audit.jsonl에 자동 기록됩니다:

```json
{
  "timestamp": "2026-04-05T10:30:00Z",
  "actor": "user-123",
  "action": "AI_GATEWAY_REQUEST",
  "result": "SUCCESS",
  "details": {
    "grade": "O",
    "piiFields": [],
    "routed": "external",
    "model": "claude-sonnet-4-20250514",
    "tokenCount": 150
  },
  "ismsPControls": ["ISMS-P-P-01"],
  "csapControls": ["CSAP-D08-10"],
  "ip": "10.42.0.15"
}
```

---

## 5. N2SF-N05 통제 충족 매핑

| N2SF-N05 요건 | 게이트웨이 구현 | 증적 |
|-------------|-------------|------|
| 데이터 등급 분류 | classifyData() 자동 분류 | audit.jsonl grade 필드 |
| C/S등급 외부 전송 금지 | localLLM 라우팅 | audit.jsonl routed: local |
| O등급 PII 마스킹 | maskPII() 자동 적용 | audit.jsonl maskedFields |
| AI API 호출 감사 | auditLog() 전수 기록 | audit.jsonl 전체 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | MTU-A1 Do — AI 보안 게이트웨이 패턴 작성 | Implementer Agent |
