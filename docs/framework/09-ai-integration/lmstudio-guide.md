# LM Studio 온프레미스 LLM 연동 가이드

> MTU-A2 | FR-6.3-new, AI-REQ-3 | 적용 기준일: 2026-04-05
> 참조: MTU-A1 (AI 보안 게이트웨이), N2SF C/S등급 데이터 전용

---

## 1. 개요

N2SF C/S등급 데이터 처리 시 외부 AI API 사용이 금지되므로,
Windows 호스트에서 LM Studio를 실행하고 WSL2/k3s에서 접근하는 온프레미스 LLM 서비스를 구성합니다.

---

## 2. 아키텍처

```
+---------------------------------------------+
|  Windows 호스트                              |
|  +--------------------+                      |
|  |   LM Studio        |  localhost:1234       |
|  |  (GGUF 모델 실행)  |  OpenAI 호환 API      |
|  +--------------------+                      |
+------------------|---------------------------+
                   | host.docker.internal:1234
+------------------v---------------------------+
|  WSL2 / k3s                                  |
|  +------------------+  +-------------------+ |
|  | AI 보안 게이트웨이 |->| LM Studio Client  | |
|  | (N2SF 등급 확인)  |  | (C/S등급 전용)    | |
|  +------------------+  +-------------------+ |
+----------------------------------------------+
```

---

## 3. LM Studio 설치 및 설정

### 3.1 설치

1. https://lmstudio.ai 에서 Windows용 다운로드
2. 설치 후 실행

### 3.2 모델 로드

1. Models 탭 -> 검색: `llama-3.1-8b-instruct` (GGUF)
2. 다운로드 완료 후 모델 선택

### 3.3 서버 시작

1. Local Server 탭 -> Start Server
2. 포트: 1234 (기본값)
3. CORS: 허용 확인

### 3.4 WSL2 접근 확인

```bash
curl http://host.docker.internal:1234/v1/models
# 응답: {"object":"list","data":[{"id":"llama-3.1-8b-instruct",...}]}
```

---

## 4. 지원 모델 (GGUF)

| 모델 | 파라미터 | 용도 | 최소 VRAM | 비고 |
|------|---------|------|---------|------|
| Llama 3.1 8B Instruct | 8B | 범용 질의응답 | 8GB | 권장 기본 모델 |
| Mistral 3 7B | 7B | 코드 + 문서 요약 | 6GB | 코드 작업 우수 |
| Gemma 2 9B | 9B | 한국어 지원 | 10GB | 한국어 성능 양호 |
| Phi-3 Mini 3.8B | 3.8B | 경량 추론 | 4GB | 저사양 환경 |
| DeepSeek Coder 6.7B | 6.7B | 코드 생성 | 8GB | 코딩 특화 |

---

## 5. k3s 파드 환경 설정

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-service
spec:
  template:
    spec:
      containers:
        - name: ai-service
          env:
            - name: LM_STUDIO_URL
              value: "http://host.docker.internal:1234/v1"
            - name: LM_STUDIO_API_KEY
              value: "lm-studio"
            - name: LM_STUDIO_MODEL
              value: "llama-3.1-8b-instruct"
```

---

## 6. N2SF 데이터 등급 연동

| 데이터 등급 | LM Studio | 외부 AI API | 비고 |
|-----------|:---------:|:-----------:|------|
| C (기밀) | 허용 | 절대 금지 | 온프레미스 전용 |
| S (민감) | 허용 | 절대 금지 | 온프레미스 전용 |
| O (공개) | 선택적 | 허용 (PII 마스킹) | 게이트웨이 라우팅 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | MTU-A2 Do — LM Studio 연동 가이드 작성 | Implementer Agent |
