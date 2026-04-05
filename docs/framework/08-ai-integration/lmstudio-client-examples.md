# LM Studio 클라이언트 코드 예시

> MTU-A2 | AI-REQ-3 | 적용 기준일: 2026-04-05

---

## Python 클라이언트

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://host.docker.internal:1234/v1",
    api_key="lm-studio"
)

def query_local_llm(prompt: str, data_grade: str) -> str:
    if data_grade not in ("C", "S"):
        raise ValueError(f"LM Studio는 C/S등급 전용. 현재: {data_grade}")

    response = client.chat.completions.create(
        model="llama-3.1-8b-instruct",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        max_tokens=2048,
    )
    return response.choices[0].message.content
```

## TypeScript 클라이언트

```typescript
import OpenAI from 'openai'

const lmStudio = new OpenAI({
  baseURL: 'http://host.docker.internal:1234/v1',
  apiKey: 'lm-studio',
})

async function queryLocalLLM(
  prompt: string,
  dataGrade: 'C' | 'S'
): Promise<string> {
  const response = await lmStudio.chat.completions.create({
    model: 'llama-3.1-8b-instruct',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 2048,
  })
  return response.choices[0].message.content ?? ''
}
```

## 스트리밍 예시 (TypeScript)

```typescript
async function* streamLocalLLM(prompt: string): AsyncGenerator<string> {
  const stream = await lmStudio.chat.completions.create({
    model: 'llama-3.1-8b-instruct',
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  })

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content
    if (content) yield content
  }
}
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | MTU-A2 Do — 클라이언트 예시 작성 | Implementer Agent |
