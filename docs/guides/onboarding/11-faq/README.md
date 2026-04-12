# 11장: 자주 묻는 질문 (FAQ)

> **문서 ID**: ONBOARD-11-INDEX
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **작성자**: Implementer (Sonnet)
> **목적**: 신규 팀원이 가장 많이 하는 질문에 대한 빠른 답변 제공

---

## 목차

1. [FAQ 섹션 구성](#1-faq-섹션-구성)
2. [가장 자주 묻는 질문 TOP 10](#2-가장-자주-묻는-질문-top-10)
3. [섹션별 FAQ 파일 안내](#3-섹션별-faq-파일-안내)
4. [변경 이력](#4-변경-이력)

---

## 1. FAQ 섹션 구성

이 장은 세 개의 파일로 구성됩니다.

| 파일 | 주제 | 질문 수 | 대상 |
|------|------|--------|------|
| [01-dev-faq.md](01-dev-faq.md) | 개발자 FAQ | 25개 | 백엔드·풀스택 개발자 |
| [02-infra-faq.md](02-infra-faq.md) | 인프라 FAQ | 20개 | 인프라·DevOps 엔지니어 |
| [03-csap-faq.md](03-csap-faq.md) | CSAP·보안 FAQ | 20개 | 전체 (필수 숙지) |

질문이 여러 섹션에 걸쳐 있으면 가장 관련성이 높은 파일에 배치했습니다.

---

## 2. 가장 자주 묻는 질문 TOP 10

신규 입사자가 첫 주에 가장 많이 묻는 10가지 질문입니다.

**Q1. pnpm과 npm 차이가 뭐예요?**

pnpm은 npm보다 빠르고 디스크 공간을 절약하는 패키지 매니저입니다. 이 프로젝트는 monorepo 구조라 pnpm workspace를 사용합니다. npm install을 쓰면 오류가 납니다.
→ [01-dev-faq.md Q1 참고](01-dev-faq.md)

**Q2. 왜 문서를 먼저 써야 해요? 코딩부터 하면 안 되나요?**

이 프로젝트는 CSAP 공공기관 인증을 목표로 하므로 감리 기준상 "문서 없는 구현 = 결함"입니다. Plan → Design → 구현 순서는 선택이 아닌 필수입니다.
→ [03-csap-faq.md Q3 참고](03-csap-faq.md)

**Q3. PR 올렸는데 Q-Gate가 실패했어요. 어떻게 해요?**

Gitea Actions 로그에서 실패한 게이트(G1~G7)를 확인하고 해당 항목을 수정하면 됩니다.
→ [01-dev-faq.md Q18 참고](01-dev-faq.md)

**Q4. Pod이 계속 재시작돼요.**

`kubectl describe pod {pod-name}`으로 원인을 확인합니다. 가장 흔한 원인은 OOMKilled(메모리 부족)와 환경 변수 누락입니다.
→ [02-infra-faq.md Q1 참고](02-infra-faq.md)

**Q5. 환경변수는 어떻게 추가해요?**

로컬은 `.env.local`, 운영은 Vault에서 관리합니다. 코드에 직접 값을 넣으면 CSAP D-09 위반입니다.
→ [01-dev-faq.md Q9 참고](01-dev-faq.md)

**Q6. CSAP가 뭐예요?**

클라우드 서비스 보안인증제(Cloud Security Assurance Program)로, 공공기관이 클라우드 서비스를 도입할 때 요구하는 보안 인증입니다. 이 프로젝트는 79개 통제항목을 준수해야 합니다.
→ [03-csap-faq.md Q1 참고](03-csap-faq.md)

**Q7. AI API에 데이터를 보내도 되나요?**

N2SF 데이터 등급을 확인해야 합니다. C/S 등급은 절대 불가, O 등급만 PII 마스킹 후 전송 가능합니다.
→ [03-csap-faq.md Q5 참고](03-csap-faq.md)

**Q8. Fastify를 왜 Express 대신 써요?**

Fastify는 Express보다 최대 3배 빠르고, JSON Schema 기반 검증과 OpenAPI 자동 생성을 기본 지원합니다.
→ [01-dev-faq.md Q5 참고](01-dev-faq.md)

**Q9. Helm 차트를 수정했는데 반영이 안 돼요.**

Flux GitOps 동기화 주기(기본 1분)를 기다리거나, `flux reconcile` 명령으로 즉시 강제 동기화합니다.
→ [02-infra-faq.md Q3 참고](02-infra-faq.md)

**Q10. 감사 로그를 왜 꼭 써야 해요?**

CSAP D-06 통제항목으로, 모든 민감 작업의 감사 추적이 법적 의무에 해당합니다.
→ [03-csap-faq.md Q3 참고](03-csap-faq.md)

---

## 3. 섹션별 FAQ 파일 안내

### 개발자 FAQ ([01-dev-faq.md](01-dev-faq.md))

백엔드·풀스택 개발자가 일상 개발 중 마주치는 질문 25개를 다룹니다.

**포함 주제**:
- 패키지 관리 (pnpm, npm, Turbo)
- 프레임워크 선택 (Fastify, Prisma)
- 테스트 실행 방법
- 환경 변수 설정
- TypeScript 오류 처리
- 새 서비스·DB 테이블 추가 방법
- Claude Code 활용법
- PR 제출 절차

### 인프라 FAQ ([02-infra-faq.md](02-infra-faq.md))

인프라·DevOps 엔지니어가 k8s, CI/CD, 네트워크를 다루면서 마주치는 질문 20개를 다룹니다.

**포함 주제**:
- Pod 재시작·장애 원인 분석
- 서비스 접근 불가 문제
- Helm 차트·Flux GitOps
- Ingress vs Service
- PVC Pending 처리
- ArgoCD vs Flux 비교
- CI/CD 파이프라인 디버깅

### CSAP·보안 FAQ ([03-csap-faq.md](03-csap-faq.md))

전체 팀원이 반드시 알아야 하는 보안·컴플라이언스 관련 질문 20개를 다룹니다.

**포함 주제**:
- CSAP, N2SF, ISMS-P 개념
- 데이터 등급 분류 (C/S/O)
- 감사 로그 작성 방법
- AI API 데이터 전송 규칙
- 하드코딩 시크릿 금지 이유
- Q-Gate 각 단계 설명
- 보안 위반 발생 시 처리 절차

---

## 4. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 초안 작성 (TOP 10 및 섹션 안내) | Implementer (Sonnet) |
