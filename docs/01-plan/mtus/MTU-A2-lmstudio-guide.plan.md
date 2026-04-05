# MTU-A2: LM Studio 연동 가이드 [신규]

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-A2 |
| Phase | Phase 4 Advanced |
| 상태 | Draft |
| 작성일 | 2026-04-05 |
| FR 매핑 | FR-6.3-new, AI-REQ-3 |
| 의존 MTU | MTU-A1 (AI 보안 게이트웨이) |
| 예상 세션 | 1 세션 |
| 추가 근거 | 사용자 결정: LM Studio를 온프레미스 LLM 솔루션으로 채택 |

---

## 목적

N2SF C/S등급 데이터 전용 온프레미스 LLM 서비스로 **LM Studio**를 활용합니다.
LM Studio는 Windows 호스트에서 실행되며, WSL2 및 k3s 파드에서
`host.docker.internal:1234`로 접근하는 OpenAI 호환 API를 제공합니다.

**선택 근거**:
- k3s 내부 GPU 할당 불필요 → 배포 복잡도 대폭 감소
- OpenAI SDK 완전 호환 → 코드 변경 최소화
- GGUF 모델 지원: Llama 3.1, Mistral 3, Gemma, DeepSeek, Phi-3
- Windows 호스트 실행 → WSL2 커널 공유로 지연 최소화

---

## 아키텍처

```
┌─────────────────────────────────────────────────────┐
│  Windows 호스트                                      │
│  ┌──────────────────┐                               │
│  │   LM Studio       │  localhost:1234               │
│  │  (GGUF 모델 실행) │  OpenAI 호환 API              │
│  └──────────────────┘                               │
└────────────────────────┬────────────────────────────┘
                         │ host.docker.internal:1234
┌────────────────────────▼────────────────────────────┐
│  WSL2 / k3s                                          │
│  ┌──────────────────┐    ┌───────────────────────┐  │
│  │  AI 보안 게이트웨이│→→→│  LM Studio 클라이언트  │  │
│  │  (N2SF 등급 확인) │    │  (C/S등급 요청만 전달) │  │
│  └──────────────────┘    └───────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## 산출물 파일 (2개)

| 파일 | 문서 유형 | 핵심 내용 |
|------|---------|---------|
| `06-ai-integration/lmstudio-guide.md` | 아키텍처 레퍼런스형 | LM Studio 설치·설정·모델 로드 + WSL2 접근 패턴 |
| `06-ai-integration/lmstudio-client-examples.md` | 구현 가이드형 | Python/TypeScript 클라이언트 코드 예시 |

---

## 핵심 연동 패턴

### Python (openai SDK)

```python
from openai import OpenAI

# LM Studio — OpenAI 호환 엔드포인트
client = OpenAI(
    base_url="http://host.docker.internal:1234/v1",
    api_key="lm-studio"  # 온프레미스이므로 임의 값
)

def query_local_llm(prompt: str, data_grade: str) -> str:
    """N2SF C/S등급 데이터 전용 — LM Studio 라우팅"""
    if data_grade not in ("C", "S"):
        raise ValueError(f"LM Studio는 C/S등급 전용. 현재 등급: {data_grade}")

    response = client.chat.completions.create(
        model="llama-3.1-8b-instruct",  # LM Studio에서 로드한 모델명
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
    )
    return response.choices[0].message.content
```

### TypeScript (openai SDK)

```typescript
import OpenAI from 'openai'

const lmStudio = new OpenAI({
  baseURL: 'http://host.docker.internal:1234/v1',
  apiKey: 'lm-studio',
})

async function queryLocalLLM(prompt: string, dataGrade: 'C' | 'S'): Promise<string> {
  const response = await lmStudio.chat.completions.create({
    model: 'llama-3.1-8b-instruct',
    messages: [{ role: 'user', content: prompt }],
  })
  return response.choices[0].message.content ?? ''
}
```

---

## LM Studio 설정 가이드 (문서 핵심 내용)

### 1. LM Studio 설치 및 모델 로드

```
1. https://lmstudio.ai 에서 Windows용 다운로드
2. Models 탭 → 검색: "llama-3.1-8b-instruct" (GGUF 형식)
3. Local Server 탭 → Start Server (포트: 1234)
4. CORS 허용 설정 확인 (기본값: 허용)
```

### 2. WSL2 접근 확인

```bash
# WSL2 터미널에서 접근 테스트
curl http://host.docker.internal:1234/v1/models

# 응답 예시
# {"object":"list","data":[{"id":"llama-3.1-8b-instruct",...}]}
```

### 3. k3s 파드에서 접근

```yaml
# k3s Deployment 환경변수
env:
  - name: LM_STUDIO_URL
    value: "http://host.docker.internal:1234/v1"
  - name: LM_STUDIO_API_KEY
    value: "lm-studio"
```

---

## 지원 모델 (GGUF)

| 모델 | 파라미터 | 용도 | 최소 VRAM |
|------|---------|------|---------|
| Llama 3.1 8B Instruct | 8B | 범용 질의응답 | 8GB |
| Mistral 3 7B | 7B | 코드 + 문서 요약 | 6GB |
| Gemma 2 9B | 9B | 한국어 지원 개선 | 10GB |
| Phi-3 Mini 3.8B | 3.8B | 경량 추론 | 4GB |
| DeepSeek Coder 6.7B | 6.7B | 코드 생성 | 8GB |

---

## N2SF 데이터 등급 연동

| 데이터 등급 | LM Studio 사용 | 외부 AI API |
|-----------|--------------|------------|
| C (기밀) | ✅ 허용 | ❌ 절대 금지 |
| S (민감) | ✅ 허용 | ❌ 절대 금지 |
| O (공개) | 선택적 사용 | ✅ 허용 (PII 마스킹 후) |

---

## 합격 기준

1. LM Studio → WSL2 API 연동 확인 (`host.docker.internal:1234` 응답)
2. Python/TypeScript 클라이언트 코드 예시 동작 확인
3. N2SF C/S등급 라우팅 로직 포함 (외부 API 전송 차단 검증)
4. 지원 모델 목록 및 최소 사양 명시
5. k3s 파드 환경변수 설정 예시 포함

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 신규 — LM Studio 온프레미스 LLM 솔루션 채택 반영 | Claude Code |
