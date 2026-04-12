# 온보딩 체크리스트 (인쇄용)

> **문서 ID**: ONBOARD-15
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **작성자**: Implementer (Sonnet)
> **목적**: 신규 팀원 온보딩 전 과정 추적 및 완료 증빙용 체크리스트
> **사용 방법**: 인쇄 후 각 항목 완료 시 체크. 완료된 체크리스트를 멘토에게 제출하여 확인받으십시오.

---

## 목차

1. [Week 1 체크리스트 (Day별)](#1-week-1-체크리스트-day별)
2. [Week 2 체크리스트](#2-week-2-체크리스트)
3. [Month 1 체크리스트](#3-month-1-체크리스트)
4. [역할별 추가 체크리스트](#4-역할별-추가-체크리스트)
5. [온보딩 완료 선언 체크리스트](#5-온보딩-완료-선언-체크리스트)
6. [온보딩 완료 서명란](#6-온보딩-완료-서명란)
7. [변경 이력](#7-변경-이력)

---

## 1. Week 1 체크리스트 (Day별)

> **목표**: 개발 환경 구성 완료 및 프로젝트 전체 구조 파악

---

### Day 1 (월요일) — 환경 설정 및 오리엔테이션

**계정 및 접근권한 발급**

```
[ ] Gitea 계정 발급 완료 (팀 리드에게 요청)
    - Gitea URL: http://gitea.saas.local
    - 아이디:
    - 조직(Organization) 초대 완료 여부: 예 / 아니오

[ ] HashiCorp Vault 접근 계정 발급 완료
    - Vault URL: http://vault.saas.local
    - 역할(Role): dev-readonly

[ ] k3s kubeconfig 발급 및 설정 완료
    - 확인 명령어: kubectl get nodes
    - 출력 결과 (STATUS가 Ready인지 확인):

[ ] Slack/협업 도구 채널 참여 완료
    - #general, #dev, #alerts, #deployments 채널 합류

[ ] VPN 접속 설정 완료 (현장 근무 시)
```

**저장소 설정**

```
[ ] 저장소 클론 완료
    - 명령어: git clone http://gitea.saas.local/public-saas/ai-saas.git
    - 클론 경로: /data/ai-saas

[ ] pnpm install 성공
    - 명령어: pnpm install --frozen-lockfile
    - 완료 여부: 예 / 아니오
    - 오류가 있었다면 해결 방법:

[ ] pnpm build 첫 성공
    - 명령어: cd /data/ai-saas && pnpm build
    - 완료 여부: 예 / 아니오
    - 빌드 소요 시간:

[ ] Claude Code 설치 완료
    - 명령어: npm install -g @anthropic-ai/claude-code
    - /pm 실행 확인: 예 / 아니오
```

**가이드북 기초 학습**

```
[ ] 00-overview.md 읽기 완료
    - 학습 완료 시각:
    - 인상 깊었던 내용 한 줄:

[ ] 00-project-history.md 읽기 완료
    - 기술 선택 이유 (k3s, Fastify, pnpm 모노레포) 이해: 예 / 아니오

[ ] 7장 보안 코딩 규칙 첫 번째 섹션 숙지
    - 07-security/csap/01-what-is-csap.md 읽기 완료: 예 / 아니오
    - CSAP 등급 3가지 암기: 하 / 중 / 상

[ ] 멘토와 Day 1 체크인 미팅 완료
    - 미팅 시각:
    - 확인 사항 메모:
```

---

### Day 2 (화요일) — 개발 환경 심화 설정

**환경 구성 완료**

```
[ ] 02-environment-setup.md 전체 따라하기 완료
    - 소요 시간:
    - 막혔던 부분:

[ ] k3s 로컬 클러스터 정상 확인
    - 명령어: kubectl get nodes
    - 출력 예: saas-node   Ready   control-plane,master

[ ] 로컬 서비스 기동 확인
    - auth-service 기동: cd platform/services/auth-service && pnpm run dev
    - "Listening on 0.0.0.0:3001" 출력 확인: 예 / 아니오

[ ] Grafana 접근 확인
    - URL: http://grafana.saas.local
    - 기본 대시보드 로드 확인: 예 / 아니오

[ ] Prometheus 접근 확인
    - URL: http://prometheus.saas.local
    - 메트릭 수집 확인 (up{job="auth-service"} 쿼리): 예 / 아니오
```

**아키텍처 학습**

```
[ ] 02-architecture/01-system-overview.md 시스템 개요 읽기 완료
    - 17개 서비스 목록 인지: 예 / 아니오
    - C4 다이어그램 이해: 예 / 아니오

[ ] 02-architecture/services/ 하위 서비스 문서 3개 이상 읽기
    - 읽은 서비스:
    1.
    2.
    3.

[ ] 네임스페이스 구조 이해
    - kubectl get namespaces 실행 후 목록 확인: 예 / 아니오
```

---

### Day 3 (수요일) — 코드 구조 및 개발 규칙 파악

**코드 구조 탐색**

```
[ ] 모노레포 구조 파악 완료
    - platform/services/ 하위 서비스 목록 확인: 예 / 아니오
    - platform/packages/ 하위 공유 패키지 목록 확인: 예 / 아니오
    - packages/ 하위 도메인 패키지 목록 확인: 예 / 아니오

[ ] auth-service 코드 탐색
    - platform/services/auth-service/src/ 구조 파악: 예 / 아니오
    - routes.ts → handler → service → repository 흐름 이해: 예 / 아니오

[ ] 공유 패키지 이해
    - @public-saas/mesh-ready의 역할: (본인 작성)
    - @public-saas/healthcheck의 역할: (본인 작성)

[ ] 03-development/01-local-setup.md 읽기 완료
    - pnpm 명령어 체계 이해: 예 / 아니오
```

**개발 규칙 숙지**

```
[ ] .claude/rules/harness-constraints.md 읽기 완료
    - 함수 최대 줄 수: 줄
    - 파일 최대 줄 수: 줄
    - 최대 중첩 깊이:

[ ] .claude/rules/csap-compliance.md 읽기 완료
    - D-08 핵심 요건 (한 줄):
    - D-09 핵심 요건 (한 줄):
    - D-06 핵심 요건 (한 줄):
    - D-12 핵심 요건 (한 줄):

[ ] Conventional Commits 형식 학습
    - feat, fix, docs, refactor 차이 이해: 예 / 아니오
    - 올바른 예시 하나 작성:
```

---

### Day 4 (목요일) — PDCA·Q-Gate·보안 학습

**PDCA 및 문서 체계 학습**

```
[ ] 08-document-management/pdca/01-what-is-pdca.md 읽기 완료
    - PDCA 4단계 암기: Plan / Do / Check / Act

[ ] 08-document-management/pdca/02-writing-plan.md 읽기 완료
    - Executive Summary 4-Perspective 테이블 이해: 예 / 아니오

[ ] FR ID 체계 암기
    - 기능 요구사항 형식: FR-{모듈}.{번호}
    - 예시: FR-2.1, FR-3.3

[ ] 08-document-management/mtu-system/01-mtu-explained.md 읽기 완료
    - MTU 완료 기준 3가지 나열:
    1.
    2.
    3.
```

**Q-Gate 학습**

```
[ ] 06-cicd/pipelines/02-quality-gate.md 읽기 완료
    - G1 ~ G7 각각의 역할 암기:
    G1:
    G2:
    G3:
    G4:
    G5:
    G6:
    G7:

[ ] Q-Gate 실패 시 대응 방법 이해: 예 / 아니오
    - G4 실패 시 (커버리지 부족):
    - G6 실패 시 (CSAP 위반):
```

**보안 심화 학습**

```
[ ] 07-security/csap/02-dev-checklist.md 읽기 완료
    - 새 API 엔드포인트 작성 시 체크 항목 6가지 암기: 예 / 아니오

[ ] 07-security/coding/01-secure-patterns.md 읽기 완료
    - 매개변수화 쿼리 패턴 이해: 예 / 아니오
    - Zod 검증 패턴 이해: 예 / 아니오

[ ] 11-faq/03-csap-faq.md 전체 읽기 완료
    - N2SF C/S/O 등급 차이 설명 가능: 예 / 아니오
    - AI API 전송 규칙 설명 가능: 예 / 아니오
```

---

### Day 5 (금요일) — 실습 1 수행 및 Week 1 회고

**실습 1 수행**

```
[ ] 실습 브랜치 생성 완료
    - 브랜치 이름: feat/exercise-01-hello-service-{본인이름}

[ ] 10-exercises/01-hello-service.md 전체 읽기 완료

[ ] auth-service에 /health/ping 엔드포인트 추가 완료
    - 응답에 status, timestamp, version 필드 포함: 예 / 아니오
    - HTTP 200 반환 확인: 예 / 아니오

[ ] 단위 테스트 작성 완료
    - 테스트 통과 확인 (pnpm test): 예 / 아니오

[ ] Claude Code로 코드 리뷰 요청
    - 지적 사항 수정 완료: 예 / 아니오

[ ] Conventional Commits 형식으로 커밋
    - 커밋 메시지:

[ ] 실습 1 완료 체크리스트 확인 (README.md 기준 6개 항목 모두 체크)
```

**Week 1 회고**

```
[ ] 멘토와 Week 1 회고 미팅 완료
    - 미팅 시각:
    - 잘 이해된 부분:
    - 추가 학습이 필요한 부분:
    - 다음 주 목표:
```

---

## 2. Week 2 체크리스트

> **목표**: 실습 2~4 완료, 인프라 및 모니터링 실무 경험

---

### Week 2 — 실습 2: 미니 PDCA 체험

```
[ ] 10-exercises/02-pdca-mini.md 전체 읽기 완료

[ ] 미니 Plan 문서 작성 완료
    - 파일 경로: docs/01-plan/mtus/
    - Executive Summary 포함: 예 / 아니오
    - FR ID (최소 2개) 포함: 예 / 아니오
    - Context Anchor 포함: 예 / 아니오

[ ] 미니 Design 문서 작성 완료
    - API 명세 (경로, 메서드, 요청/응답 스키마) 포함: 예 / 아니오
    - 시퀀스 다이어그램 포함: 예 / 아니오

[ ] 코드 스캐폴드 구현 완료
    - 컴파일 오류 없이 빌드: 예 / 아니오
    - pnpm build --filter={서비스명} 성공: 예 / 아니오

[ ] 미니 PDCA 보고서 작성 완료 (4단계 결과 기록)

[ ] 실습 2 완료 체크리스트 확인 (README.md 기준 5개 항목 모두 체크)
```

---

### Week 2 — 실습 3: 모니터링 대시보드 만들기

```
[ ] 10-exercises/03-monitoring-lab.md 전체 읽기 완료

[ ] 05-monitoring/metrics/01-prometheus-basics.md 읽기 완료
    - PromQL 기본 문법 이해: 예 / 아니오

[ ] PromQL 쿼리 작성 완료
    - 로그인 성공률 쿼리:
    - 로그인 실패율 쿼리:
    - Prometheus에서 데이터 반환 확인: 예 / 아니오

[ ] Grafana 패널 생성 완료
    - 패널 제목:
    - 로그인 성공/실패율 시각화: 예 / 아니오
    - 공공기관 표준 명칭 사용: 예 / 아니오

[ ] 알림(Alert) 규칙 설정 완료
    - 임계값: 로그인 실패율 % 초과 시 알림
    - 알림 채널: Slack/이메일

[ ] 실습 3 완료 체크리스트 확인 (README.md 기준 4개 항목 모두 체크)
```

---

### Week 2 — 실습 4: k8s 장애 시뮬레이션

```
[ ] 10-exercises/04-k8s-debug.md 전체 읽기 완료

[ ] 04-infrastructure/kubernetes/01-k3s-basics.md 읽기 완료
    - kubectl 기본 명령어 숙지: 예 / 아니오

[ ] 의도적 OOMKilled 상태 재현
    - 메모리 제한을 낮게 설정하여 OOMKilled 확인: 예 / 아니오
    - Exit Code 137 확인: 예 / 아니오

[ ] kubectl describe 로 원인 분석
    - OOMKilled 이벤트 발견: 예 / 아니오
    - 발견한 이벤트 메시지 기록:

[ ] 올바른 메모리 제한으로 수정 후 정상 실행 확인
    - 수정한 메모리 제한값:
    - Pod 정상 실행 확인 (Running 상태): 예 / 아니오

[ ] 장애 원인 분석 메모 작성 완료
    - 메모 파일 경로 (선택 사항):

[ ] 실습 4 완료 체크리스트 확인 (README.md 기준 4개 항목 모두 체크)
```

---

### Week 2 — 추가 학습

```
[ ] 04-infrastructure/kubernetes/03-gitops-flux.md 읽기 완료
    - HelmRelease와 HelmChart 차이 이해: 예 / 아니오

[ ] 06-cicd/deployment/01-gitops-deploy.md 읽기 완료
    - GitOps 워크플로우 이해: 예 / 아니오

[ ] 09-troubleshooting/01-common-errors.md 읽기 완료
    - CrashLoopBackOff 진단 절차 암기: 예 / 아니오

[ ] 멘토와 Week 2 회고 미팅 완료
    - 미팅 시각:
    - 개선 사항:
```

---

## 3. Month 1 체크리스트

> **목표**: 실습 5~6 완료, 첫 실제 기여, 온보딩 평가 합격

---

### Month 1 — 실습 5: 보안 감사 체험

```
[ ] 10-exercises/05-security-audit.md 전체 읽기 완료

[ ] SQL 인젝션 취약점 탐지 및 수정
    - 발견한 취약점 위치:
    - 매개변수화 쿼리로 수정 완료: 예 / 아니오

[ ] 하드코딩 시크릿 탐지 및 수정
    - 발견한 시크릿 위치:
    - 환경 변수로 교체 완료: 예 / 아니오
    - process.env 접근 방어 코드 추가: 예 / 아니오

[ ] RBAC 누락 엔드포인트 탐지 및 수정
    - 발견한 엔드포인트:
    - verifyToken() + hasPermission() 추가 완료: 예 / 아니오

[ ] Claude Code 보안 리뷰 요청 및 통과
    - 리뷰 통과 여부: 예 / 아니오

[ ] CSAP D-08/D-09/D-12 체크리스트 기준 자가 검증 완료

[ ] 실습 5 완료 체크리스트 확인 (README.md 기준 5개 항목 모두 체크)
```

---

### Month 1 — 실습 6: 종합 시나리오 (핵심)

```
[ ] 10-exercises/06-end-to-end-scenario.md 전체 읽기 완료 (4~6시간 예상)

[ ] Plan 문서 작성 완료
    - 파일 경로: docs/01-plan/mtus/
    - FR ID 추적성 매트릭스 포함: 예 / 아니오

[ ] Design 문서 작성 완료
    - API 명세, 시퀀스 다이어그램, ER 다이어그램 포함: 예 / 아니오

[ ] 구현 완료
    - GET /api/v1/admin/tenants/:tenantId/stats 엔드포인트 완료: 예 / 아니오
    - Redis 캐시 5분 TTL 동작 확인: 예 / 아니오
    - STATS_VIEWED 감사 로그 기록 확인: 예 / 아니오
    - 인증/인가 적용 확인 (401, 403 반환): 예 / 아니오

[ ] 테스트 완료
    - pnpm test:coverage 결과: %
    - 80% 이상 달성: 예 / 아니오

[ ] Q-Gate G1~G7 전부 통과
    - G1 (FR ID): 통과 / 실패
    - G2 (설계 완전성): 통과 / 실패
    - G3 (코드 품질): 통과 / 실패
    - G4 (커버리지 80%+): 통과 / 실패
    - G5 (OWASP): 통과 / 실패
    - G6 (CSAP): 통과 / 실패
    - G7 (감사 추적): 통과 / 실패
    - Gitea CI 파이프라인 green: 예 / 아니오

[ ] 완료 보고서 작성
    - 파일 경로: docs/03-impl/tenant-service/

[ ] PR 제출 완료
    - PR 링크:

[ ] 실습 6 완료 체크리스트 확인 (README.md 기준 10개 항목 모두 체크)
```

---

### Month 1 — 온보딩 최종 평가

```
[ ] 10-exercises/07-assessment.md 평가 응시 완료
    - 응시 날짜:
    - 카테고리 1 점수: / 6
    - 카테고리 2 점수: / 6
    - 카테고리 3 점수: / 6
    - 카테고리 4 점수: / 6
    - 카테고리 5 점수: / 6
    - 총점: / 30
    - 합격 여부 (20점 이상 + 각 카테고리 4점 이상): 합격 / 불합격

[ ] 불합격 카테고리 재학습 완료 (해당 시)
    - 재학습한 카테고리:
    - 재평가 날짜:
    - 재평가 결과:
```

---

### Month 1 — 첫 실제 기여

```
[ ] 실제 업무 이슈 또는 버그픽스 PR 제출
    - PR 링크:
    - PR 제목:
    - Q-Gate 통과 여부: 예 / 아니오

[ ] 다른 팀원 PR 리뷰 1회 이상 수행
    - 리뷰한 PR 링크:
    - 작성한 리뷰 댓글 수:

[ ] 팀 스프린트 미팅 첫 참여
    - 참여 날짜:
    - 발언한 내용 요약:

[ ] 멘토와 Month 1 회고 미팅 완료
    - 미팅 날짜:
    - 강점으로 파악된 역량:
    - 개발이 필요한 역량:
    - 다음 달 목표:
```

---

## 4. 역할별 추가 체크리스트

---

### 4.1 백엔드 개발자 전용

```
[ ] Fastify 라우터 패턴 숙지
    - preHandler 훅으로 미들웨어 적용 방법 이해: 예 / 아니오
    - Fastify 플러그인 시스템 이해: 예 / 아니오

[ ] Prisma ORM 심화 학습
    - $transaction 사용 시점 이해: 예 / 아니오
    - 멀티테넌트 tenantId 필터 패턴 암기: 예 / 아니오
    - 마이그레이션 생성 명령어: pnpm prisma migrate dev

[ ] 공유 패키지 구조 파악
    - @public-saas/auth 패키지 API 숙지: 예 / 아니오
    - @public-saas/audit 패키지 API 숙지: 예 / 아니오
    - @public-saas/mesh-ready 동작 원리 이해: 예 / 아니오

[ ] Redis 캐싱 패턴 학습
    - TTL 기반 캐시 구현 예시 코드 작성 가능: 예 / 아니오
    - 캐시 무효화 전략 이해: 예 / 아니오

[ ] 서비스 간 통신 패턴 학습
    - HTTP 동기 호출 vs 이벤트 기반 비동기 차이 이해: 예 / 아니오
    - Circuit Breaker 패턴 적용 방법 이해: 예 / 아니오

[ ] 테스트 전략 학습
    - 단위 테스트 (Vitest) 작성 가능: 예 / 아니오
    - 통합 테스트 패턴 이해: 예 / 아니오
    - 모킹(Mocking) 전략 이해: 예 / 아니오

[ ] AI 기능 개발 규칙 숙지
    - 내부 AI Gateway 경유 규칙 이해: 예 / 아니오
    - N2SF 데이터 등급별 전송 규칙 암기: 예 / 아니오
    - PII 마스킹 함수 사용법 이해: 예 / 아니오

[ ] 첫 번째 새 API 엔드포인트 독립 구현 완료
    - 구현한 엔드포인트:
    - Q-Gate 통과 확인: 예 / 아니오
```

---

### 4.2 인프라 엔지니어 전용

```
[ ] k3s 클러스터 구성 심화 이해
    - 04-infrastructure/kubernetes/ 전체 읽기 완료: 예 / 아니오
    - 노드 구성 및 리소스 할당 이해: 예 / 아니오

[ ] Helm 차트 작성 및 배포 실습
    - 기존 서비스의 Helm 차트 구조 분석 완료: 예 / 아니오
    - values.yaml 수정하여 배포 테스트: 예 / 아니오

[ ] Flux GitOps 파이프라인 심화 이해
    - 04-infrastructure/kubernetes/03-gitops-flux.md 읽기 완료: 예 / 아니오
    - HelmRepository, HelmChart, HelmRelease 직접 생성 경험: 예 / 아니오
    - GitRepository 소스 설정 이해: 예 / 아니오

[ ] Traefik Ingress 설정 이해
    - 04-infrastructure/components/01-traefik.md 읽기 완료: 예 / 아니오
    - 새 서비스에 Ingress 규칙 추가 가능: 예 / 아니오
    - TLS 1.3 인증서 설정 확인 방법 이해: 예 / 아니오

[ ] Linkerd 서비스 메시 이해
    - 04-infrastructure/components/06-linkerd.md 읽기 완료: 예 / 아니오
    - mTLS 자동 적용 확인 방법 이해: 예 / 아니오

[ ] Vault 시크릿 관리 실습
    - 04-infrastructure/components/04-vault.md 읽기 완료: 예 / 아니오
    - 개발용 시크릿 조회 방법 이해: 예 / 아니오

[ ] 카나리 배포 실습
    - Flagger 기반 카나리 배포 설정 이해: 예 / 아니오
    - 자동 롤백 조건 암기: 예 / 아니오
    - 카나리 진행 상태 모니터링 방법: 예 / 아니오

[ ] CSAP 인프라 요건 학습
    - 네트워크 분리(NetworkPolicy) 설정 이해: 예 / 아니오
    - TLS 1.3 강제 설정 확인: 예 / 아니오
    - 백업 및 복구 절차 이해: 예 / 아니오

[ ] SRE 운영 절차 숙지
    - 09-troubleshooting/ 전체 읽기 완료: 예 / 아니오
    - 인시던트 대응 절차 이해: 예 / 아니오
    - 포스트모템(사후 분석) 작성 방법 이해: 예 / 아니오
```

---

### 4.3 PM/기획자 전용

```
[ ] 프로젝트 거버넌스 이해
    - CSAP 인증 프로세스 전체 흐름 이해: 예 / 아니오
    - 행안부 정보화사업 감리 절차 이해: 예 / 아니오
    - MTU 시스템과 스프린트 연계 방법 이해: 예 / 아니오

[ ] 문서 관리 체계 학습
    - 08-document-management/ 전체 읽기 완료: 예 / 아니오
    - Plan 문서 작성 기준 이해: 예 / 아니오
    - 추적성 매트릭스(FR → 산출물 → 테스트 → CSAP) 이해: 예 / 아니오

[ ] PDCA 사이클 운영 이해
    - PDCA 단계별 담당자 및 산출물 이해: 예 / 아니오
    - MTU 우선순위 결정 기준 이해: 예 / 아니오
    - PDCA 보고서 리뷰 방법 이해: 예 / 아니오

[ ] Q-Gate 관리자 관점 이해
    - 7단계 Q-Gate 기준 이해: 예 / 아니오
    - Q-Gate 실패 시 프로세스 이해: 예 / 아니오
    - Gitea Actions에서 Q-Gate 결과 확인 방법: 예 / 아니오

[ ] DORA 지표 이해
    - 05-monitoring/dora/01-dora-metrics.md 읽기 완료: 예 / 아니오
    - 4개 DORA 지표 정의 (배포 빈도, 변경 리드타임, MTTR, 변경 실패율): 예 / 아니오
    - 현재 팀의 DORA 지표 수준 파악: 예 / 아니오

[ ] 감리 증거 관리 이해
    - 감사 로그(audit.jsonl) 역할 이해: 예 / 아니오
    - CSAP 증거 자동 수집 파이프라인 이해: 예 / 아니오
    - 감리 시 준비해야 하는 산출물 목록 파악: 예 / 아니오

[ ] 이해관계자 소통 방법
    - 기술적 내용을 비기술적 이해관계자에게 설명하는 방법 학습: 예 / 아니오
    - CSAP 감사 보고서 독해 방법 이해: 예 / 아니오

[ ] 신규 MTU 초안 작성 실습
    - 직접 작성한 MTU Plan 문서 초안:
    - 멘토 리뷰 완료: 예 / 아니오
```

---

## 5. 온보딩 완료 선언 체크리스트

> **안내**: 아래 10개 항목은 멘토와 함께 확인합니다. 자가 체크만으로는 온보딩 완료가 인정되지 않습니다.

---

```
[ ] 항목 1. 실습 1~5 완료 확인
    확인 내용: 실습 1~5의 브랜치 또는 PR 링크를 제시하고 멘토가 내용 확인
    멘토 서명: __________ 날짜: __________

[ ] 항목 2. 실습 6 Q-Gate G1~G7 전부 통과 확인
    확인 내용: Gitea CI 파이프라인 green 화면을 멘토에게 직접 시연
    PR 링크:
    멘토 서명: __________ 날짜: __________

[ ] 항목 3. 온보딩 최종 평가 합격 확인
    확인 내용: 07-assessment.md 기준 총 20/30 이상 + 각 카테고리 4/6 이상
    총점: / 30
    멘토 서명: __________ 날짜: __________

[ ] 항목 4. 코드 리뷰 1회 수행 확인
    확인 내용: 다른 팀원의 PR에 의미 있는 리뷰 댓글을 작성한 사례 제시
    리뷰한 PR 링크:
    멘토 서명: __________ 날짜: __________

[ ] 항목 5. auditLog() 직접 구현 확인
    확인 내용: 실제 서비스에 auditLog() 호출이 포함된 커밋을 제시
    관련 커밋 링크:
    멘토 서명: __________ 날짜: __________

[ ] 항목 6. CSAP 개발자 체크리스트 자가 점검 완료 확인
    확인 내용: 07-security/csap/02-dev-checklist.md의 모든 항목 체크 상태를 멘토와 함께 검토
    미충족 항목 수: (0이어야 완료)
    멘토 서명: __________ 날짜: __________

[ ] 항목 7. N2SF 데이터 등급 실연 확인
    확인 내용: 멘토가 제시하는 데이터를 보고 C/S/O 등급을 즉석에서 분류하는 실연
    실연 날짜: __________ 멘토 서명: __________

[ ] 항목 8. CrashLoopBackOff 진단 실연 확인
    확인 내용: 멘토가 재현한 CrashLoopBackOff 상황에서 kubectl 명령어로 원인 분석 실연
    실연 날짜: __________ 멘토 서명: __________

[ ] 항목 9. 첫 실제 PR 제출 및 머지 확인
    확인 내용: 실제 업무 이슈 또는 버그픽스 PR이 Q-Gate를 통과하여 stg 브랜치에 머지된 것을 확인
    PR 링크:
    머지 날짜:
    멘토 서명: __________ 날짜: __________

[ ] 항목 10. 온보딩 피드백 제출 확인
    확인 내용: Gitea 이슈에 onboarding-feedback 레이블로 이 가이드북에 대한 개선 의견 제출
    이슈 링크:
    멘토 서명: __________ 날짜: __________
```

---

## 6. 온보딩 완료 서명란

> 아래 서명란은 10개 항목 전부 확인 후에 작성합니다.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

온보딩 완료 선언

이름:                           직책/역할:
입사일:                         온보딩 완료일:
담당 서비스/팀:

평가 총점: ______ / 30          각 카테고리 점수: __ / __ / __ / __ / __

본인 서명: ______________________    날짜: __________

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

멘토 확인

멘토 이름:                      멘토 직책:
10개 완료 항목 전부 확인 여부: 예 / 아니오

멘토 의견:



멘토 서명: ______________________    날짜: __________

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

팀 리드 최종 승인

팀 리드 이름:
비고:



팀 리드 서명: ______________________    날짜: __________

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 7. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 초안 작성 — Week 1(Day별), Week 2, Month 1, 역할별, 완료 선언 체크리스트 포함 | Implementer (Sonnet) |
