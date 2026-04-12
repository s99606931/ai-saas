# 온보딩 이해도 평가 — 30문항 자가 평가 시험

> **문서 ID**: ONBOARD-08-ASSESS
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **작성자**: Implementer (Sonnet)
> **대상**: 온보딩 가이드북 1~7장 학습을 완료한 신규 팀원
> **선행 학습**: 온보딩 가이드북 전체 (README.md 경로 참조)
> **관련 문서**:
>   - `15-onboarding-checklist.md` — 온보딩 완료 체크리스트 (별개 문서, 중복 아님)
>   - `00-overview.md` — 시스템 전체 개요
> **목적**: 온보딩 완료 기준 측정 및 추가 학습 방향 제시

---

## 목차

1. [평가 안내](#1-평가-안내)
2. [섹션 1: 프로젝트 개요 및 아키텍처 (20점)](#2-섹션-1-프로젝트-개요-및-아키텍처-20점)
3. [섹션 2: 개발 및 보안 (30점)](#3-섹션-2-개발-및-보안-30점)
4. [섹션 3: 인프라 및 CI/CD (20점)](#4-섹션-3-인프라-및-cicd-20점)
5. [섹션 4: 모니터링 및 운영 (20점)](#5-섹션-4-모니터링-및-운영-20점)
6. [섹션 5: 실습 능력 확인 (10점)](#6-섹션-5-실습-능력-확인-10점)
7. [정답 및 해설 참조](#7-정답-및-해설-참조)
8. [평가 결과 해석](#8-평가-결과-해석)
9. [변경 이력](#9-변경-이력)

---

## 1. 평가 안내

### 1.1 이 평가의 목적

이 평가는 신규 팀원이 공공기관 SaaS 프레임워크의 핵심 개념을 정확하게 이해했는지 측정하기 위한 **자가 평가(Self-Assessment)** 도구입니다.

이 평가를 통해:
- 온보딩 가이드북의 어느 섹션을 더 학습해야 하는지 파악할 수 있습니다.
- 멘토와의 면담에서 무엇을 질문할지 정할 수 있습니다.
- 첫 PR(Pull Request) 제출 전 CSAP 보안 규정을 충분히 이해했는지 확인할 수 있습니다.

### 1.2 합격 기준

| 총점 | 판정 | 조치 |
|------|------|------|
| 90점 이상 | 우수 — 온보딩 완료 | 멘토 최종 면담 후 업무 시작 |
| 70~89점 | 합격 — 온보딩 완료 | 오답 섹션 재학습 후 업무 시작 |
| 60~69점 | 재학습 필요 | 오답 섹션 집중 학습 후 멘토 면담 |
| 60점 미만 | 온보딩 미완료 | 멘토 면담 필수, 가이드북 재학습 |

### 1.3 평가 구성 (총 100점)

| 섹션 | 주제 | 배점 | 문항 수 |
|------|------|------|---------|
| 1 | 프로젝트 개요 및 아키텍처 | 20점 | 5문항 (객관식) |
| 2 | 개발 및 보안 | 30점 | 5문항 (객관식) + 2문항 (서술형) |
| 3 | 인프라 및 CI/CD | 20점 | 5문항 (객관식) |
| 4 | 모니터링 및 운영 | 20점 | 4문항 (객관식) + 1문항 (서술형) |
| 5 | 실습 능력 확인 | 10점 | 3문항 (단답형) |
| **합계** | | **100점** | **25문항** |

> 서술형·단답형 문항은 내용의 정확성과 핵심 키워드 포함 여부로 채점합니다.

### 1.4 오픈북 허용 여부

**오픈북 허용**: 온보딩 가이드북 참조가 허용됩니다.

그러나 다음 점에 유의하십시오.
- 참조를 하더라도 **핵심 개념은 직접 이해**해야 합니다.
- 서술형 문항은 단순 복사가 아닌 **자신의 말로 설명**해야 합니다.
- 실제 업무에서는 코드 작성 중에 가이드북을 매번 볼 수 없습니다.
- 평가 시간 제한은 없습니다. 충분히 생각하고 작성하십시오.

### 1.5 평가 방법

1. 아래 문항을 읽고 별도의 답안지(종이 또는 개인 문서)에 작성합니다.
2. 답안 작성 완료 후 7절 정답과 대조하여 채점합니다.
3. 채점 결과를 멘토에게 보고하고, 오답 항목에 대해 질문합니다.

---

## 2. 섹션 1: 프로젝트 개요 및 아키텍처 (20점)

> 각 문항 4점 | 5문항 합계 20점
> 참조 문서: `00-overview.md`, `02-architecture/01-system-overview.md`, `02-architecture/02-multitenancy.md`

---

**문항 1-1.** 이 프로젝트가 취득을 목표로 하는 보안 인증과 감리 기준을 모두 고르십시오.

```
A) ISO 27001 + PCI-DSS
B) CSAP 중/상 등급 + 행안부 정보화사업 감리기준
C) SOC 2 Type II + GDPR
D) 국정원 CC인증 + ISMS-P
E) CSAP 하 등급만
```

---

**문항 1-2.** 다음 중 이 플랫폼에서 운영 중인 서비스 목록으로 올바른 것을 고르십시오.

```
A) auth-service, user-service, billing-service, ai-service, tenant-service 포함 총 10개
B) api-gateway, auth-service, user-service 등 17개 마이크로서비스
C) auth-service 단일 모놀리식 서비스
D) api-gateway, auth-service, billing-service 3개 서비스
E) 서비스 수는 고정되지 않으며 테넌트마다 다름
```

---

**문항 1-3.** 멀티테넌시(Multi-tenancy) 아키텍처에서 테넌트 격리(Tenant Isolation)를 구현하는 주요 방법을 고르십시오.

```
A) 테넌트마다 별도 k3s 클러스터 구축
B) JWT 클레임(x-user-tenant-id) 기반 데이터 필터링 + 데이터베이스 행 수준 격리
C) 테넌트마다 별도 네트워크 VLAN 구성
D) 단일 DB 테이블 사용 (격리 없음)
E) 테넌트 데이터는 모두 암호화하여 같은 컬럼에 저장
```

---

**문항 1-4.** 이 프로젝트의 PDCA 사이클에서 'Plan 문서 없이 구현을 시작'하면 어떤 결과가 발생합니까?

```
A) 코드 리뷰에서 경고만 발생하고 통과됨
B) 감리 결함으로 지적되며, IMPL_COMPLETE.md 작성 불가
C) 일단 구현 후 나중에 문서를 작성하면 됨
D) 아무 문제없음 — 코드의 품질이 더 중요
E) 테스트만 통과하면 감리 문제없음
```

---

**문항 1-5.** 이 프로젝트에서 사용하는 에이전트 5가지와 역할을 바르게 연결한 것을 고르십시오.

```
A) Implementer(구현) - Reviewer(품질·보안 검사) - Auditor(CSAP 감리) - Tester(테스트) - Refactorer(정리)
B) Planner(계획) - Coder(구현) - Checker(검사) - Deployer(배포) - Monitor(모니터링)
C) Designer(설계) - Developer(개발) - QA(품질) - Ops(운영) - Manager(관리)
D) Architect(설계) - Implementer(구현) - Reviewer(검사) - Deployer(배포) - Auditor(감리)
E) 에이전트 구분 없이 단일 AI가 모든 작업 수행
```

---

## 3. 섹션 2: 개발 및 보안 (30점)

> 객관식 5문항 각 4점 (20점) + 서술형 2문항 각 5점 (10점) = 합계 30점
> 참조 문서: `.claude/rules/csap-compliance.md`, `07-security/coding/`, `07-security/n2sf/`

---

**문항 2-1.** CSAP D-08 접근 통제 요건에 따라 모든 API 엔드포인트에서 반드시 수행해야 하는 작업은 무엇입니까?

```
A) 요청마다 DB 접속 테스트
B) JWT 토큰 검증 + RBAC 권한 검사
C) IP 주소 화이트리스트 확인
D) HTTPS 리다이렉션
E) API 키 헤더 확인만으로 충분
```

---

**문항 2-2.** 아래 코드에서 CSAP D-12(시스템 개발 보안) 위반 사항을 모두 고르십시오.

```typescript
// 문제의 코드
const userEmail = req.query.email;
const query = `SELECT * FROM users WHERE email = '${userEmail}'`;
const user = await db.execute(query);

const apiKey = 'sk-ant-api03-1234567890abcdef';
return { user, apiKey };
```

```
A) 위반 없음 — 정상 코드
B) SQL 직접 문자열 결합 (SQL 주입 취약점)
C) SQL 직접 문자열 결합 + 하드코딩된 API 키 + 에러 응답에 시크릿 노출
D) 환경 변수 미사용
E) B, D만 해당
```

---

**문항 2-3.** N2SF(국가 정보보안 프레임워크)에서 AI API 전송이 허용되는 데이터 등급은 무엇입니까?

```
A) C 등급 (기밀) — 항상 허용
B) S 등급 (민감) — 암호화 후 허용
C) O 등급 (일반) — PII 마스킹 후 허용
D) 모든 등급 허용 (AI Gateway 경유 시)
E) 어떤 등급도 허용하지 않음
```

---

**문항 2-4.** CSAP D-09 암호화 요건에 따른 올바른 구현 방식을 고르십시오.

```
A) 비밀번호 MD5 해시 저장 + HTTP 전송
B) 비밀번호 bcrypt(12회) 해시 + TLS 1.3 전송
C) 비밀번호 SHA-1 해시 + TLS 1.0 전송
D) 비밀번호 평문 저장 + HTTPS 전송
E) 비밀번호 AES-256 암호화 저장 + HTTP 전송
```

---

**문항 2-5.** auditLog() 함수를 반드시 호출해야 하는 상황이 아닌 것을 고르십시오.

```
A) 사용자 삭제 작업
B) 인보이스 결제 처리
C) GET /health 헬스체크 호출
D) 세금계산서 발행
E) 로그인 실패 5회 연속 발생
```

---

**서술형 2-6.** (5점)

다음 코드가 CSAP 보안 요건을 위반하는 이유를 **3가지 이상** 명시하고, 각각의 올바른 수정 방법을 작성하십시오.

```typescript
export async function deleteUser(userId: string) {
  const password = 'admin1234';  // DB 비밀번호
  const conn = await connect(`postgresql://admin:${password}@db:5432/users`);

  const result = await conn.query(
    `DELETE FROM users WHERE id = '${userId}'`
  );

  return { deleted: result.rowCount, connectionString: conn.connectionString };
}
```

> 답안 작성 공간 (핵심 키워드: 하드코딩 시크릿, SQL 주입, 민감 정보 노출, 감사 로그 누락, 환경 변수)

---

**서술형 2-7.** (5점)

공공기관 SaaS 플랫폼에서 **멀티테넌시 환경의 보안 위협**을 가장 잘 설명하고, 이 프로젝트에서 이를 방어하는 구체적인 방법(코드 또는 설정 수준)을 서술하십시오.

> 답안 작성 공간 (핵심 키워드: 테넌트 격리, JWT 클레임, RBAC, Linkerd mTLS, 데이터 격리)

---

## 4. 섹션 3: 인프라 및 CI/CD (20점)

> 각 문항 4점 | 5문항 합계 20점
> 참조 문서: `04-infrastructure/`, `06-cicd/`, `02-architecture/09-platform-engineering.md`

---

**문항 3-1.** 이 프로젝트가 k3s를 컨테이너 오케스트레이션으로 선택한 주요 이유를 고르십시오.

```
A) GKE, EKS보다 기능이 더 많아서
B) 온프레미스(WSL2 환경) 경량 운영에 적합하고 외부 클라우드 의존성 없음
C) 공개 인터넷에서만 동작하는 환경에 특화되어 있어서
D) 도커 컴포즈로 충분하지만 k3s가 팀 취향에 맞아서
E) 행안부 규정에서 k3s를 반드시 사용하도록 명시해서
```

---

**문항 3-2.** Flux GitOps에서 "소스 오브 트루스(Source of Truth)"는 어디에 있습니까?

```
A) 프로덕션 k3s 클러스터의 현재 상태
B) 개발자 로컬 머신의 kubectl 명령어 이력
C) Gitea 저장소의 infra/ 디렉토리 YAML 파일
D) Grafana 대시보드의 배포 이력
E) Vault의 시크릿 관리 상태
```

---

**문항 3-3.** Q-Gate(품질 게이트) G4가 요구하는 기준을 고르십시오.

```
A) 빌드 성공 여부만 확인
B) 테스트 커버리지 80% 이상 + 모든 테스트 통과
C) Lint 오류 없음만 확인
D) PR 제출 후 24시간 이내 리뷰어 승인
E) OWASP Top 10 통과만 확인
```

---

**문항 3-4.** Blue-Green 배포 전략에서 "Green" 환경의 역할은 무엇입니까?

```
A) 현재 프로덕션 트래픽을 받고 있는 기존 환경
B) 새 버전이 배포되어 검증 중인 환경 — 검증 통과 시 트래픽 전환
C) 개발팀 테스트 전용 환경
D) 모니터링 전용 환경 (트래픽 없음)
E) 롤백 시 즉시 사용되는 백업 환경
```

---

**문항 3-5.** 배포 파이프라인에서 Trivy가 수행하는 역할을 고르십시오.

```
A) 코드 스타일 검사 (Lint)
B) 컨테이너 이미지의 CVE 취약점 스캔
C) API 부하 테스트
D) 데이터베이스 마이그레이션 실행
E) 인프라 비용 계산
```

---

## 5. 섹션 4: 모니터링 및 운영 (20점)

> 객관식 4문항 각 4점 (16점) + 서술형 1문항 4점 = 합계 20점
> 참조 문서: `05-monitoring/`, `05-monitoring/slo/`, `05-monitoring/dora/`

---

**문항 4-1.** Prometheus에서 다음 PromQL 쿼리가 반환하는 값은 무엇입니까?

```promql
sum(rate(http_requests_total{status=~"5.."}[5m]))
/
sum(rate(http_requests_total[5m]))
* 100
```

```
A) 초당 HTTP 요청 건수
B) 최근 5분간 5xx 에러 비율 (%)
C) 평균 응답 시간 (밀리초)
D) 동시 접속자 수
E) 서비스별 CPU 사용률
```

---

**문항 4-2.** SLO(서비스 수준 목표)와 SLA(서비스 수준 협약)의 차이를 올바르게 설명한 것을 고르십시오.

```
A) SLO = 외부 고객과의 계약, SLA = 내부 팀 목표
B) SLO = 내부 팀이 설정하는 달성 목표, SLA = 외부 기관과의 공식 계약 (위반 시 패널티)
C) SLO와 SLA는 같은 의미
D) SLO는 Prometheus 메트릭이고 SLA는 Grafana 알림
E) SLO는 99.9%, SLA는 99.99% 로 비율로 고정됨
```

---

**문항 4-3.** DORA 4대 지표(Four Keys) 중 "변경 실패율(Change Failure Rate)"이 의미하는 것을 고르십시오.

```
A) 배포 후 서비스가 중단된 횟수
B) 전체 배포 중 장애·롤백·핫픽스로 이어진 배포의 비율
C) 코드 변경 후 프로덕션 배포까지 걸리는 시간
D) 한 달 동안 배포한 횟수
E) 장애 발생 후 서비스 복구까지 걸리는 시간
```

---

**문항 4-4.** 이 프로젝트에서 온콜(On-call) 엔지니어가 P1 긴급 장애 알림을 받았을 때 첫 번째로 해야 할 행동은 무엇입니까?

```
A) 즉시 서비스를 재시작
B) 5분 이내 #incidents 채널에 인지 메시지 게시 + 장애 대응 시작
C) 팀장에게 보고 후 지시를 기다림
D) 원인 분석을 완료할 때까지 조용히 혼자 작업
E) 30분 안에 Slack 메시지 답변
```

---

**서술형 4-5.** (4점)

Error Budget(에러 예산)이 무엇인지 설명하고, Error Budget이 80% 이상 소진되었을 때 팀이 취해야 할 조치를 서술하십시오.

> 답안 작성 공간 (핵심 키워드: SLO, 허용 가능한 오류량, 신뢰성 작업 우선, 신규 기능 개발 동결/축소)

---

## 6. 섹션 5: 실습 능력 확인 (10점)

> 단답형 3문항 (3~4점) | 합계 10점
> 참조 문서: `14-quick-reference.md`, `01-getting-started/`, `03-development/`

---

**문항 5-1.** (3점)

아래 상황에서 올바른 `kubectl` 명령어를 작성하십시오.

```
상황: saas 네임스페이스의 auth-service Pod가 CrashLoopBackOff 상태입니다.
원인을 파악하기 위해 가장 최근 Pod 로그를 확인하려고 합니다.
단, 이전 컨테이너 인스턴스의 로그도 함께 확인해야 합니다.
```

> 명령어 작성 공간 (힌트: `-p` 플래그, `--previous`)

---

**문항 5-2.** (4점)

새 기능 브랜치를 생성하고, 코드를 커밋한 후 PR(Pull Request)을 생성하는 전체 git 워크플로우를 순서대로 작성하십시오. 아래 조건을 반드시 지키십시오.

```
조건:
1. 브랜치 이름: feat/user-email-validation
2. 커밋 메시지: Conventional Commits 형식 (feat(auth): FR-2.1 이메일 검증 추가)
3. --no-verify 플래그 절대 사용 금지
4. PR 제출 대상 브랜치: stg
```

> 명령어 목록 작성 공간

---

**문항 5-3.** (3점)

아래 TypeScript 코드에서 발생하는 런타임 오류를 찾고, 올바르게 수정하십시오.

```typescript
// 오류가 있는 코드
async function getTenantInfo(tenantId: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }
  });

  // 테넌트 이름 로그 출력
  console.log(`테넌트 이름: ${tenant.name}`);
}
```

> 오류 설명 및 수정 코드 작성 공간

---

## 7. 정답 및 해설 참조

> 이 섹션을 답안 작성 완료 후에만 펼쳐 확인하십시오.
> 답을 먼저 확인하면 평가의 의미가 없습니다.

---

<details>
<summary>정답 확인 (클릭하여 펼치기)</summary>

### 섹션 1 정답

| 문항 | 정답 | 참조 문서 |
|------|------|-----------|
| 1-1 | **B** | `00-overview.md` §1, `CLAUDE.md` 1절 |
| 1-2 | **B** | `02-architecture/01-system-overview.md` §2 |
| 1-3 | **B** | `02-architecture/02-multitenancy.md` §3 |
| 1-4 | **B** | `CLAUDE.md` 1절, `08-document-management/pdca/` |
| 1-5 | **A** | `CLAUDE.md` §2 에이전트 분업 원칙 |

**1-1 해설**: CSAP(클라우드 보안 인증제) 중/상 등급과 행정안전부 정보화사업 감리기준 준수가 이 프로젝트의 두 가지 인증 목표입니다. ISO 27001, SOC 2 등은 민간 국제 인증으로 우리 프로젝트의 목표가 아닙니다.

**1-2 해설**: 현재 17개 마이크로서비스가 운영 중입니다: api-gateway, auth-service, user-service, billing-service, ai-service, tenant-service, notification-service, subscription-service, catalog-service, saas-catalog-service, crm-service, audit-service, compliance-service, security-service, security-monitor-service, file-service, menu-service.

**1-3 해설**: 멀티테넌시 격리는 JWT 클레임(`x-user-tenant-id`) 기반 데이터 필터링이 핵심입니다. `billing.handler.ts`에서 `if (jwtRole !== 'SUPER_ADMIN' && jwtTenantId)` 패턴으로 구현되어 있습니다.

**1-4 해설**: `CLAUDE.md` 1절 절대 제약: "구현 착수 전 Plan + Design 문서 완비 필수. 문서 없는 구현 = 감리 결함."

**1-5 해설**: 5개 에이전트의 Cascade 순서는 구현(Implementer) → 리뷰(Reviewer) → 감리(Auditor) → 테스트(Tester) → 리팩토링(Refactorer)입니다.

---

### 섹션 2 정답

| 문항 | 정답 | 참조 문서 |
|------|------|-----------|
| 2-1 | **B** | `.claude/rules/csap-compliance.md` D-08 |
| 2-2 | **C** | `.claude/rules/csap-compliance.md` D-12 |
| 2-3 | **C** | `.claude/rules/csap-compliance.md` N2SF 항목 |
| 2-4 | **B** | `.claude/rules/csap-compliance.md` D-09 |
| 2-5 | **C** | `.claude/rules/csap-compliance.md` D-06 |

**2-1 해설**: CSAP D-08 접근 통제는 모든 API 엔드포인트에서 반드시 `verifyToken()` + `hasPermission()` 순서로 인증·권한을 검사하도록 요구합니다. IP 화이트리스트만으로는 불충분합니다.

**2-2 해설**: 세 가지 위반이 있습니다.
- SQL 직접 문자열 결합 (`${userEmail}`) → SQL 주입 취약점 (D-12)
- 하드코딩된 API 키 (`'sk-ant-api03-...'`) → 시크릿 하드코딩 금지 (D-09)
- 응답에 `apiKey` 노출 → 민감 정보 노출 금지 (D-12)

**2-3 해설**: N2SF 데이터 등급 중 O등급(일반)만 AI API 전송이 허용됩니다. 단, PII(개인식별정보) 마스킹이 반드시 선행되어야 합니다. C(기밀), S(민감) 등급은 절대 전송 불가입니다.

**2-4 해설**: CSAP D-09 암호화 요건: 비밀번호는 bcrypt(cost factor 12) 해시, 전송은 TLS 1.3+ 필수. MD5·SHA-1은 보안 취약, HTTP는 전송 암호화 미적용으로 위반입니다.

**2-5 해설**: `GET /health` 헬스체크는 감사 로그 대상이 아닙니다. 건강 확인 요청은 민감 작업이 아니므로 auditLog 호출이 불필요합니다. 나머지(사용자 삭제, 결제 처리, 세금계산서 발행, 로그인 실패 연속 발생)는 모두 감사 로그가 필요합니다.

**서술형 2-6 채점 기준 (5점)**:

위반 사항 및 수정 방법 — 다음 항목 중 3가지 이상 정확히 서술 시 만점:

1. **하드코딩된 DB 비밀번호** (2점):
   - 문제: `const password = 'admin1234'` → 코드에 시크릿 하드코딩 (CSAP D-09, D-12)
   - 수정: `const password = process.env['DB_PASSWORD']; if (!password) throw new Error('...')`

2. **SQL 주입 취약점** (1점):
   - 문제: `` `DELETE FROM users WHERE id = '${userId}'` `` → SQL 직접 결합 (CSAP D-12)
   - 수정: `conn.query('DELETE FROM users WHERE id = $1', [userId])`

3. **민감 정보 응답 노출** (1점):
   - 문제: `return { connectionString: conn.connectionString }` → DB 연결 정보 노출 (CSAP D-12)
   - 수정: 응답에서 민감 정보 제거, 에러 ID만 반환

4. **감사 로그 누락** (1점):
   - 문제: 사용자 삭제(중요 작업)에 auditLog 호출 없음 (CSAP D-06)
   - 수정: 삭제 전 `auditLog({ action: 'USER_DELETE', ... })` 호출

**서술형 2-7 채점 기준 (5점)**:

다음 내용을 포함하면 만점:
- **위협**: 한 테넌트 권한으로 다른 테넌트 데이터 접근 시도 (2점)
- **방어 방법** (3점 — 최소 2가지):
  - JWT 클레임 기반 필터링: `if (jwtRole !== 'SUPER_ADMIN' && jwtTenantId) where['tenantId'] = jwtTenantId`
  - Linkerd mTLS: 서비스 간 통신 자동 암호화 + AuthorizationPolicy
  - N2SF 네트워크 격리: Cilium 네임스페이스별 격리

---

### 섹션 3 정답

| 문항 | 정답 | 참조 문서 |
|------|------|-----------|
| 3-1 | **B** | `04-infrastructure/01-overview.md`, `00-project-history.md` |
| 3-2 | **C** | `06-cicd/` GitOps 섹션 |
| 3-3 | **B** | `CLAUDE.md` §6 Q-Gate |
| 3-4 | **B** | `06-cicd/` 배포 전략 섹션 |
| 3-5 | **B** | `06-cicd/` DevSecOps 섹션 |

**3-1 해설**: k3s는 경량 Kubernetes 배포판으로 WSL2(Windows Subsystem for Linux 2) 위에서 온프레미스 환경을 구성하기 적합합니다. 이 프로젝트는 외부 클라우드 서비스 사용이 절대 금지되어 있어 GKE, EKS 등을 사용할 수 없습니다.

**3-2 해설**: GitOps에서 소스 오브 트루스는 Git 저장소(Gitea)의 `infra/` 디렉토리 YAML 파일입니다. Flux가 이 파일을 감시하고 클러스터 상태를 자동으로 일치시킵니다. kubectl 명령어 직접 실행은 GitOps 원칙 위반입니다.

**3-3 해설**: Q-Gate G4는 테스트 커버리지 80% 이상을 요구합니다. 7단계 Q-Gate: G1(FR ID 전수) G2(설계 완전성) G3(코드 품질+102 규칙) G4(커버리지 80%+) G5(OWASP Top10) G6(CSAP 100%) G7(감사 추적).

**3-4 해설**: Blue-Green 배포에서 Blue = 현재 프로덕션(기존 버전), Green = 새 버전 배포 환경입니다. Green에서 검증 완료 후 트래픽 전환, 문제 발생 시 Blue로 즉시 롤백합니다.

**3-5 해설**: Trivy는 컨테이너 이미지의 CVE(Common Vulnerabilities and Exposures) 취약점을 스캔합니다. CRITICAL·HIGH 취약점 발견 시 빌드 실패, 배포 차단이 됩니다.

---

### 섹션 4 정답

| 문항 | 정답 | 참조 문서 |
|------|------|-----------|
| 4-1 | **B** | `05-monitoring/01-prometheus-basics.md` |
| 4-2 | **B** | `05-monitoring/slo/` |
| 4-3 | **B** | `05-monitoring/dora/`, `05-monitoring/metrics/04-business-metrics-catalog.md` |
| 4-4 | **B** | `05-monitoring/11-sre-oncall-guide.md` |

**4-1 해설**: `status=~"5.."` 은 5xx 상태 코드(500, 502, 503 등)를 정규식으로 필터링합니다. `rate()[5m]`은 5분간 초당 발생률이고, 분모는 전체 요청입니다. 결과 × 100 = 에러 비율(%).

**4-2 해설**: SLO(Service Level Objective)는 팀이 스스로 설정하는 달성 목표입니다. SLA(Service Level Agreement)는 외부 고객(공공기관)과의 공식 계약으로 위반 시 패널티가 발생합니다. SLO는 SLA보다 엄격하게 설정하여 SLA 위반을 방지합니다.

**4-3 해설**: 변경 실패율(Change Failure Rate) = (장애/롤백/핫픽스를 유발한 배포 수) / (전체 배포 수). Elite 팀의 기준은 0~15% 미만입니다.

**4-4 해설**: P1 긴급 장애 발생 시 첫 번째 행동은 5분 이내 `#incidents` 채널에 인지 메시지 게시입니다. "현재 인지하고 조사 중"이라는 메시지가 없으면 팀 전체가 모르는 상태가 됩니다. 원인 분석보다 소통이 우선입니다.

**서술형 4-5 채점 기준 (4점)**:

- **Error Budget 정의** (2점): SLO 목표치와 100% 사이의 허용 가능한 오류량. 예: 가용성 SLO 99.9% = 월 43분 장애 허용 = Error Budget 43분
- **소진 80% 시 조치** (2점): 신뢰성 개선 작업 우선 / 신규 기능 개발 속도 줄임 / Error Budget 소진 원인 분석 및 포스트모텀 작성

---

### 섹션 5 정답 및 채점 기준

**5-1 정답 (3점)**:

```bash
# 현재 Pod 로그 확인
kubectl logs -n saas -l app=auth-service

# 이전(크래시된) 컨테이너 로그 확인 (핵심)
kubectl logs -n saas -l app=auth-service --previous

# 또는 Pod 이름 지정 시
kubectl logs -n saas <pod-name> --previous
```

채점 기준: `--previous` 또는 `-p` 플래그 사용 시 만점. 없으면 1점 감점.

**5-2 정답 (4점)**:

```bash
# 1. 새 기능 브랜치 생성
git checkout -b feat/user-email-validation

# 2. 코드 수정 후 스테이징
git add platform/services/auth-service/src/lib/validation.ts
# (파일 이름은 예시 — 실제 수정 파일 추가)

# 3. Conventional Commits 형식 커밋 (--no-verify 절대 금지)
git commit -m "feat(auth): FR-2.1 이메일 검증 추가"

# 4. 원격 저장소에 푸시
git push origin feat/user-email-validation

# 5. PR 생성 (gh CLI 또는 Gitea 웹 UI)
gh pr create \
  --base stg \
  --title "feat(auth): FR-2.1 이메일 검증 추가" \
  --body "Plan SC: FR-2.1 이메일 형식 검증 구현"
```

채점 기준:
- 브랜치 이름 정확 (1점)
- Conventional Commits 형식 커밋 메시지 (1점)
- --no-verify 미사용 (1점, 사용 시 0점)
- stg 브랜치 대상 PR (1점)

**5-3 정답 (3점)**:

오류: `tenant`가 `null`일 수 있는데 `tenant.name` 접근 시 `TypeError: Cannot read properties of null` 발생.

```typescript
// 올바른 수정 코드
async function getTenantInfo(tenantId: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }
  });

  // null 확인 필수
  if (!tenant) {
    throw new Error(`테넌트를 찾을 수 없습니다: ${tenantId}`);
  }

  console.log(`테넌트 이름: ${tenant.name}`);
}
```

채점 기준:
- 오류 원인 정확히 서술 (1점)
- null 체크 코드 작성 (1점)
- 적절한 에러 처리 (1점)

</details>

---

## 8. 평가 결과 해석

### 8.1 점수별 추가 학습 권장 가이드

**90점 이상 (우수)**

축하합니다. 온보딩 가이드북의 핵심 내용을 정확하게 이해했습니다.

```
권장 다음 단계:
  [ ] 멘토와 최종 면담 후 온보딩 완료 선언
  [ ] 15-onboarding-checklist.md 최종 체크리스트 제출
  [ ] 첫 PR 제출 준비 (담당 서비스 Bug Fix 또는 소규모 개선)
  [ ] 10-exercises/ 실습 문제 도전
```

**70~89점 (합격)**

온보딩의 핵심을 이해했으나 일부 영역에 보완이 필요합니다.

```
오답 섹션별 추가 학습:

섹션 1 오답:
  → 00-overview.md, 02-architecture/01-system-overview.md 재학습

섹션 2 오답:
  → .claude/rules/csap-compliance.md 전체 재독
  → 07-security/coding/01-secure-patterns.md 실습 예제 직접 타이핑

섹션 3 오답:
  → 04-infrastructure/01-overview.md 재학습
  → 06-cicd/ GitOps 섹션 재학습

섹션 4 오답:
  → 05-monitoring/slo/ 재학습
  → 05-monitoring/11-sre-oncall-guide.md 재학습

섹션 5 오답:
  → 14-quick-reference.md 명령어 실습
  → kubectl 명령어 직접 실행 연습
```

**60~69점 (재학습 필요)**

기초 개념은 파악했으나 핵심 보안 규정과 운영 절차에 대한 이해가 부족합니다.

```
집중 학습 대상:

1. CSAP 보안 규정 (최우선):
   → .claude/rules/csap-compliance.md 처음부터 정독
   → 07-security/csap/ 전체

2. 멀티테넌시 격리:
   → 02-architecture/02-multitenancy.md
   → billing.handler.ts 코드 직접 읽기

3. 인프라 기초:
   → 04-infrastructure/kubernetes/01-k3s-basics.md
   → 04-infrastructure/components/06-linkerd.md

멘토 면담 요청: 오답 항목 가지고 멘토와 1:1 세션 진행
```

**60점 미만 (온보딩 미완료)**

온보딩 가이드북 전체를 처음부터 다시 학습해야 합니다.

```
즉시 조치:
  1. 멘토에게 연락 → 온보딩 미완료 상태 공유
  2. 00-overview.md부터 순서대로 재학습
  3. 학습 중 의문점은 즉시 메모 → 멘토 면담 시 질문

멘토 면담 필수:
  이 점수대는 혼자 해결보다 멘토와 함께 학습하는 것이 효율적입니다.
  멘토 연락처: 팀 위키 참조 또는 #dev 채널 멘션
```

### 8.2 멘토 면담 요청 기준 (60점 미만)

60점 미만인 경우 다음 정보를 멘토에게 제공하십시오.

```
멘토 면담 요청 양식:

이름:
평가 일자:
총점: /100

섹션별 점수:
  섹션 1 (아키텍처): /20
  섹션 2 (개발·보안): /30
  섹션 3 (인프라·CI/CD): /20
  섹션 4 (모니터링): /20
  섹션 5 (실습): /10

가장 이해가 부족한 영역 (본인 서술):

질문 목록 (최소 3개):
  1.
  2.
  3.
```

### 8.3 합격 후 추가 성장 경로

온보딩 평가를 통과한 후에도 지속적인 학습이 필요합니다.

```mermaid
graph TB
    A["온보딩 평가 통과\n70점 이상"] --> B{"관심 분야 선택"}

    B --> C["백엔드/보안 심화"]
    B --> D["인프라/DevOps 심화"]
    B --> E["모니터링/SRE 심화"]
    B --> F["AI/ML 통합 심화"]

    C --> C1["07-security/ 전체 학습\nCSAP 79개 항목 상세"]
    C --> C2["서비스 코드 전체 분석\nauth, billing, ai-service"]

    D --> D1["04-infrastructure/ 전체\nVault, Flux, Cilium 심화"]
    D --> D2["06-cicd/ 전체\nDevSecOps 파이프라인"]

    E --> E1["05-monitoring/08-observability\n분산 추적·프로파일링"]
    E --> E2["05-monitoring/09-sre-practices\nSLO·오류 예산 관리"]

    F --> F1["06-ai-integration/ 학습\nAI Gateway, RAG 엔진"]
    F --> F2["packages/ml-pipeline\n모델 CI/CD 파이프라인"]

    C1 --> G["첫 기능 PR 제출"]
    C2 --> G
    D1 --> G
    D2 --> G
    E1 --> G
    E2 --> G
    F1 --> G
    F2 --> G

    G --> H["Month 1 완료\n담당 서비스 기능 기여"]
```

**월별 성장 마일스톤:**

| 시기 | 목표 | 완료 기준 |
|------|------|-----------|
| Week 1 | 환경 구성 + 아키텍처 파악 | pnpm build 성공 + 17개 서비스 설명 가능 |
| Week 2 | 첫 PR 제출 (Bug Fix) | Q-Gate G1~G7 통과 + 리뷰어 승인 |
| Month 1 | 담당 서비스 소규모 기능 | FR 문서 + Design 문서 + 구현 + 테스트 |
| Month 3 | MTU 1개 단독 완료 | PDCA 전 단계 통과 + 감사 로그 완비 |
| Month 6 | 신규 팀원 멘토링 참여 | 온보딩 가이드북 개선 기여 1건 이상 |

---

## 9. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|-------|
| 1.0.0 | 2026-04-12 | 초기 작성 — 30문항 온보딩 이해도 평가 | Implementer (Sonnet) |
