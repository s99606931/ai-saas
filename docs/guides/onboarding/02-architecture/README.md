# 2장: 아키텍처 (Architecture)

> **문서 ID**: ONBOARD-02-README
> **버전**: 1.0.0 | **작성일**: 2026-04-11
> **학습 대상**: 1장을 완료한 팀원
> **선행 조건**: `01-getting-started/` 전체 완료

---

## 이 섹션 개요

1장에서 개발 환경을 설정하고 첫 PR을 제출했다면, 이제 시스템이 어떻게 설계되어 있는지 깊이 이해할 차례입니다. 이 섹션은 17개 서비스가 어떻게 협력하는지, 각 서비스의 역할이 무엇인지 구체적으로 설명합니다.

이 섹션을 공부하면 다음과 같은 상황에서 자신감 있게 작업할 수 있습니다.

- "이 요청은 어떤 서비스가 처리하는가?" 를 즉시 답할 수 있습니다.
- 서비스 간 통신 흐름을 따라가며 버그를 추적할 수 있습니다.
- 새 기능이 어느 서비스에 추가되어야 하는지 판단할 수 있습니다.

---

## 학습 순서

```mermaid
flowchart TD
    A([1장 완료]) --> B[01-system-overview.md\n전체 아키텍처 이해\n약 3시간]
    B --> B2[02-multitenancy.md\n멀티테넌트 격리\n약 2시간]
    B2 --> B3[03-data-flow.md\n데이터 흐름 완전 가이드\n약 3시간]
    B3 --> B4[04-service-interactions.md\n비즈니스 시나리오 기반\n서비스 간 협업\n약 3시간]
    B4 --> C[services/ 폴더]
    C --> D[services/README.md\n17개 서비스 전체 목록\n약 1시간]
    D --> E[services/01-api-gateway.md\nAPI Gateway 심화\n약 2시간]
    E --> F[services/02-auth-service.md\nAuth Service 심화\n약 2시간]
    F --> G([2장 완료\n3장 바이브코딩으로 이동])

    style A fill:#1565C0,color:#fff
    style G fill:#2E7D32,color:#fff
    style B4 fill:#7B1FA2,color:#fff
```

---

## 파일 목록

| 파일 | 내용 | 예상 학습 시간 |
|------|------|--------------|
| `01-system-overview.md` | 전체 시스템 아키텍처 (C4 다이어그램, 서비스 통신 흐름) | 3시간 |
| `02-multitenancy.md` | 멀티테넌트 격리 원리, 테넌트별 데이터 분리 패턴 | 2시간 |
| `03-data-flow.md` | 로그인·API·이벤트·AI·감사 로그 5가지 데이터 흐름 | 3시간 |
| `04-service-interactions.md` | 비즈니스 시나리오 4가지로 이해하는 서비스 간 협업 (온보딩, AI, 청구, 보안) | 3시간 |
| `services/README.md` | 17개 서비스 전체 목록 표 (포트, 역할, CSAP 매핑) | 1시간 |
| `services/01-api-gateway.md` | API Gateway 역할, 라우팅 규칙, Rate Limiting, 실제 코드 | 2시간 |
| `services/02-auth-service.md` | 인증 플로우, JWT, MFA, CSAP D-08 준수 방법, 실습 | 2시간 |

---

## 이 섹션 완료 후 할 수 있는 것

- 전체 17개 서비스 이름과 역할을 말할 수 있다
- 클라이언트 요청이 API Gateway → 서비스 → DB로 흐르는 경로를 설명할 수 있다
- API Gateway의 Rate Limiting이 어떻게 동작하는지 설명할 수 있다
- auth-service의 로그인 플로우를 단계별로 설명할 수 있다
- CSAP D-08 접근 제어가 코드에서 어떻게 구현되는지 보여줄 수 있다
- 멀티테넌트 격리가 DB와 애플리케이션 계층에서 어떻게 적용되는지 설명할 수 있다
- AI 요청 시 N2SF 데이터 등급 검사와 PII 마스킹이 어떤 순서로 수행되는지 설명할 수 있다
- 감사 로그 SHA-256 해시 체인이 무결성을 어떻게 보장하는지 설명할 수 있다
