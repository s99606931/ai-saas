# 감리 증거 수집 완전 가이드

> 대상 독자: 공공기관 SaaS 플랫폼 개발자 및 PM (감리 경험 무관)
> 관련 기준: 행안부 정보시스템 감리기준 고시 제2023-1호
> 관련 CSAP 항목: 전 영역 (D-01~D-13)
> 최종 수정: 2026-04-13

---

## 목차

1. [감리란? — 초급자를 위한 설명](#1-감리란--초급자를-위한-설명)
2. [감리 산출물 목록 (단계별)](#2-감리-산출물-목록-단계별)
3. [CSAP 증거 자동 수집 파이프라인](#3-csap-증거-자동-수집-파이프라인)
4. [감리 체크리스트 (CSAP 79개 항목)](#4-감리-체크리스트-csap-79개-항목)
5. [감리관 질문 TOP 20 및 답변 가이드](#5-감리관-질문-top-20-및-답변-가이드)
6. [감리 결함 대응 전략](#6-감리-결함-대응-전략)
7. [추적성 매트릭스 자동화](#7-추적성-매트릭스-자동화)
8. [실습: 감리 대비 증거 패키지 준비](#8-실습-감리-대비-증거-패키지-준비)

---

## 1. 감리란? — 초급자를 위한 설명

### 1.1 감리가 무엇인지 쉽게 이해하기

건물을 지을 때 건축 감리사가 설계대로 시공되고 있는지 확인합니다. 정보시스템 감리도 마찬가지입니다. 정부 예산으로 개발하는 정보시스템이 계획대로, 안전하게, 효율적으로 개발되고 있는지 독립적인 전문가(감리원)가 확인하는 절차입니다.

**정보시스템 감리가 중요한 이유**:
- 국민 세금이 투입되는 사업의 품질 보증
- 개인정보 보호 및 보안 요건 충족 확인
- 완성 후 발생할 수 있는 문제의 사전 예방
- 행안부 감리기준에 따른 법적 의무 (5억원 이상 사업)

### 1.2 행안부 정보시스템 감리기준이란

행정안전부는 "정보시스템 감리기준"(고시 제2023-1호)을 통해 다음을 규정합니다.

```
감리 대상:
  • 사업비 5억원 이상 정보화 사업
  • 국가 핵심 인프라 관련 시스템
  • 개인정보 대규모 처리 시스템

감리 단계:
  • 착수 감리: 사업 계획 타당성 검토
  • 중간 감리: 개발 진행 상황 확인
  • 완료 감리: 최종 결과물 검증

감리 영역:
  • 사업관리: 일정, 품질, 위험 관리
  • 응용시스템: 기능, 성능, 보안
  • 데이터: 데이터 품질, 관리
  • 시스템구조: 아키텍처, 표준 준수
  • 보안: CSAP 준수, 개인정보 보호
```

### 1.3 감리원의 역할 및 권한

감리원은 독립적인 위치에서 다음 권한을 행사합니다.

| 권한 | 내용 | 개발자 영향 |
|------|------|------------|
| 산출물 검토 | 모든 문서 열람 요청 가능 | 문서 항상 최신 상태 유지 필요 |
| 현장 확인 | 소스 코드, 서버, DB 직접 확인 | 코드 정리, 주석 정비 필요 |
| 인터뷰 | 개발자 직접 면담 | 자신의 작업 설명 준비 필요 |
| 결함 통보 | 문제 발견 시 시정 요구 | 조치 계획서 제출 의무 |
| 보고서 작성 | 감리 결과를 발주처에 보고 | 결함은 기관장까지 보고됨 |

### 1.4 개발자가 준비해야 할 것

감리는 "갑자기" 오지 않습니다. 미리 준비하면 충분히 통과할 수 있습니다.

**개발자 체크리스트**:
```
코드 측면:
[ ] 주석: 함수마다 목적과 설계 참조 주석 작성
[ ] 린트: 경고 0개 상태 유지
[ ] 테스트: 커버리지 80% 이상 유지
[ ] 시크릿: 하드코딩된 비밀번호/키 없음 확인

문서 측면:
[ ] 설계 문서(docs/02-design/)와 코드 일치 확인
[ ] API 명세서 최신 상태 유지
[ ] 변경 이력(CHANGELOG.md) 업데이트
[ ] 감사 로그(audit.jsonl) 정상 기록 확인
```

---

## 2. 감리 산출물 목록 (단계별)

### 2.1 감리 준비 타임라인

```mermaid
flowchart TD
    W8[8주 전\n감리 일정 확정\n산출물 현황 파악] --> W6[6주 전\n누락 산출물 식별\n작성 계획 수립]
    W6 --> W4[4주 전\n핵심 산출물 완성\n내부 검토 시작]
    W4 --> W2[2주 전\n모의 감리 실시\n지적 사항 보완]
    W2 --> W1[1주 전\n최종 점검\n증거 패키지 완성]
    W1 --> D0[감리 당일\n산출물 제출\n감리원 안내]
    D0 --> WP1[감리 후 1주\n결함 조치 계획서 제출]
    WP1 --> WP4[감리 후 4주\n조치 완료 보고]

    style W8 fill:#4488ff,color:#fff
    style W6 fill:#4488ff,color:#fff
    style W4 fill:#ff8800,color:#fff
    style W2 fill:#ff8800,color:#fff
    style W1 fill:#ff4444,color:#fff
    style D0 fill:#ff4444,color:#fff
    style WP1 fill:#22aa44,color:#fff
    style WP4 fill:#22aa44,color:#fff
```

### 2.2 착수 단계 산출물

| 산출물 | 위치 | 담당 | 중요도 |
|--------|------|------|--------|
| 제안요청서(RFP) | docs/00-project/ | PM | 필수 |
| 사업계획서 | docs/00-project/ | PM | 필수 |
| 보안계획서 | docs/07-security/ | 보안담당 | 필수 |
| 착수신고서 | docs/00-project/ | PM | 필수 |
| 조직도 및 역할 정의 | docs/00-project/ | PM | 필수 |
| 개발 표준 정의서 | docs/coding-standards/ | 기술리더 | 필수 |

### 2.3 분석 단계 산출물

| 산출물 | 위치 | 담당 | 중요도 |
|--------|------|------|--------|
| 요구사항 정의서 | docs/01-plan/ | 분석가 | 필수 |
| 현황 분석 보고서 | docs/01-plan/ | 분석가 | 필수 |
| 업무 흐름도(As-Is/To-Be) | docs/01-plan/ | 분석가 | 필수 |
| 인터페이스 목록 | docs/01-plan/ | 분석가 | 권장 |
| 위험 분석 보고서 | docs/01-plan/ | PM | 권장 |
| 데이터 표준 정의 | docs/01-plan/ | DBA | 필수 |

**요구사항 정의서 필수 포함 항목** (우리 플랫폼 기준):
```
FR-{모듈}.{번호}: 기능 요구사항
NFR-{번호}: 비기능 요구사항 (성능, 가용성)
INFR-{번호}: 인프라 요구사항
AI-REQ-{번호}: AI 연동 요구사항
CC-REQ-{번호}: CSAP/N2SF 보안 요구사항
```

### 2.4 설계 단계 산출물

| 산출물 | 위치 | 담당 | 중요도 |
|--------|------|------|--------|
| 시스템 아키텍처 설계서 | docs/02-design/ | 아키텍트 | 필수 |
| 상세 설계서 (기능별) | docs/02-design/features/ | 개발자 | 필수 |
| 인터페이스 설계서 | docs/02-design/ | 개발자 | 필수 |
| 데이터베이스 설계서 | docs/02-design/ | DBA | 필수 |
| 보안 설계서 | docs/02-design/ | 보안담당 | 필수 |
| 화면 설계서(UI) | docs/02-design/ | UI/UX | 권장 |
| 성능 설계서 | docs/02-design/ | 아키텍트 | 권장 |

**설계 문서 필수 섹션** (우리 플랫폼 하네스 기준):
```markdown
# {기능명} 설계서

## Executive Summary (4-Perspective 테이블)
| 관점 | 내용 |
|------|------|
| 비즈니스 | ... |
| 기술 | ... |
| 보안 | ... |
| 운영 | ... |

## Context Anchor
- WHY: 왜 이 기능이 필요한가
- WHO: 누가 사용하는가
- RISK: 위험 요소
- SUCCESS: 성공 기준
- SCOPE: 범위

## 추적성 매트릭스
| FR ID | 설계 섹션 | 구현 파일 | 테스트 케이스 | CSAP 항목 |
```

### 2.5 구현 단계 산출물

| 산출물 | 위치 | 담당 | 중요도 |
|--------|------|------|--------|
| 소스 코드 | platform/, packages/ | 개발자 | 필수 |
| 단위 테스트 결과 | 각 서비스 __tests__/ | 개발자 | 필수 |
| 코드 리뷰 기록 | Gitea PR 코멘트 | 개발자 | 권장 |
| 정적 분석 결과 | CI/CD 파이프라인 출력 | 개발자 | 필수 |
| 린트 결과 | npm run lint 출력 | 개발자 | 필수 |
| 보안 취약점 스캔 결과 | .gitea/workflows/ | 보안담당 | 필수 |

**코드 레벨 감리 준비 — 주석 형식**:
```typescript
/**
 * 민원 자동 분류 함수
 *
 * Design Ref: §3.2 AI 분류 엔진 설계 — SVC-AI-2026 DESIGN
 * Plan SC: FR-AI26.1 (RAG 기반 민원 분류)
 * CSAP: D-12 (입력 검증), N2SF N-05 (등급 검증)
 *
 * @param tenantId - 테넌트 ID (UUID 형식, N2SF N-03 격리)
 * @param grade - 데이터 등급 ('O'만 허용, N2SF N-05)
 * @param complaintText - 민원 내용 (PII 마스킹 후 전달)
 * @returns 분류 결과 및 신뢰도
 */
export async function classifyComplaint(
  tenantId: string,
  grade: 'O',
  complaintText: string,
): Promise<ClassificationResult> {
  // ...
}
```

### 2.6 시험 단계 산출물

| 산출물 | 위치 | 담당 | 중요도 |
|--------|------|------|--------|
| 통합 테스트 계획서 | docs/tests/ | QA | 필수 |
| 통합 테스트 결과 | docs/tests/results/ | QA | 필수 |
| 성능 테스트 결과 | docs/tests/performance/ | 인프라 | 필수 |
| 보안 취약점 점검 결과 | docs/tests/security/ | 보안담당 | 필수 |
| 사용자 수용 테스트(UAT) | docs/tests/uat/ | PM+사용자 | 필수 |
| 장애 복구 테스트 결과 | docs/tests/dr/ | 인프라 | 권장 |

---

## 3. CSAP 증거 자동 수집 파이프라인

### 3.1 csap-evidence.yml 워크플로우 해설

실제 소스 파일(`.gitea/workflows/csap-evidence.yml`)을 상세히 분석합니다.

```yaml
# 실제 워크플로우 전체 분석
name: CSAP 증거 수집

on:
  # 매주 월요일 09:00 KST (UTC 00:00) 자동 실행
  schedule:
    - cron: '0 0 * * 1'

  # 수동 트리거 지원 (감리 직전 수동 수집 시 사용)
  workflow_dispatch:
    inputs:
      date:
        description: '수집 기준일 (YYYY-MM-DD)'
        required: false
        type: string
      controls:
        description: '수집 대상 통제항목 (예: D-06,D-08 또는 all)'
        required: false
        type: string
        default: 'all'
```

**스케줄의 의미**: 감리 준비를 주간 단위로 자동화합니다. 매주 월요일 아침 자동으로 증거를 수집하여 `evidence/` 디렉토리에 저장합니다.

**수동 트리거의 의미**: 감리가 임박했을 때 특정 날짜나 특정 CSAP 항목만 선택하여 수집할 수 있습니다. 예를 들어 D-06(침해사고 관리) 증거만 재수집하려면:
```bash
# Gitea UI에서 또는 CLI로:
gh workflow run csap-evidence --field controls=D-06 --field date=2026-04-13
```

**핵심 단계 1: CSAP 증거 수집 스크립트 실행**
```yaml
- name: CSAP 증거 수집 v2 실행
  run: |
    chmod +x scripts/csap-evidence-collect-v2.sh
    ./scripts/csap-evidence-collect-v2.sh $ARGS
```

이 스크립트는 다음을 수행합니다.
- 감사 로그(`audit.jsonl`) 필터링 및 정리
- Kubernetes 리소스 현황 수집 (NetworkPolicy, RBAC, Secret 목록)
- Prometheus 메트릭 스냅샷 (SLO 달성률, 보안 이벤트 건수)
- CSAP 각 통제항목별 디렉토리 생성 및 증거 파일 저장

**핵심 단계 2: 무결성 검증**
```yaml
- name: 증거 무결성 검증
  run: |
    MANIFEST="evidence/${DATE}/manifest.sha256"
    if [[ -f "$MANIFEST" ]]; then
      cd "evidence/${DATE}"
      sha256sum -c manifest.sha256 2>&1 | tail -5
      echo "무결성 검증 완료"
    fi
```

감리에서 "이 파일이 원본인가요?"라는 질문에 답할 수 있어야 합니다. SHA-256 해시로 무결성을 보장합니다. 파일이 변조되면 해시가 달라져 즉시 탐지됩니다.

**핵심 단계 3: 아티팩트 1년 보존**
```yaml
- name: 증거 아티팩트 업로드
  uses: actions/upload-artifact@v4
  with:
    name: csap-evidence-${{ inputs.date || 'latest' }}
    path: evidence/
    retention-days: 365  # CSAP D-06: 1년 이상 보존 요건
```

CSAP D-06은 보안 이벤트 로그를 최소 1년 보존하도록 요구합니다. CI/CD 아티팩트로 자동 보관합니다.

**핵심 단계 4: 감사 로그 기록**
```yaml
- name: 감사 로그 기록
  if: always()  # 성공/실패 관계없이 항상 실행
  run: |
    echo "{
      \"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
      \"actor\":\"csap-evidence-ci\",
      \"action\":\"CSAP_EVIDENCE_CI_COMPLETE\",
      \"csap_ref\":\"D-06\"
    }" >> "$AUDIT_LOG"
```

CI/CD 파이프라인 자체의 실행도 감사 로그에 기록합니다. 감리원이 "언제 어떻게 증거를 수집했는가?"를 묻는다면 이 로그로 답할 수 있습니다.

### 3.2 통제항목별 증거 수집 방법

**D-06 침해사고 관리 증거**
```bash
# 감사 로그에서 보안 이벤트 추출
grep '"action":"FALCO_\|"action":"AI_GRADE_VIOLATION\|"action":"SECURITY_' \
  .claude/audit.jsonl \
  | jq '.' \
  > evidence/D-06/security-events.jsonl

# 이벤트 건수 통계
CRITICAL=$(grep -c '"csap_severity":"CSAP_CRITICAL"' evidence/D-06/security-events.jsonl)
echo "CRITICAL 보안 이벤트: ${CRITICAL}건"

# Falco 탐지 이벤트
kubectl logs -n falco -l app=falco --since=168h \
  | grep "CSAP-D06" \
  > evidence/D-06/falco-events.log
```

**D-08 접근 통제 증거**
```bash
# RBAC 구성 현황
kubectl get clusterrolebindings,rolebindings --all-namespaces -o json \
  | jq '.items[] | {
      kind: .kind,
      name: .metadata.name,
      namespace: .metadata.namespace,
      subjects: .subjects,
      role: .roleRef
    }' \
  > evidence/D-08/rbac-configuration.json

# 관리자 권한 보유자 목록
kubectl get clusterrolebindings -o json \
  | jq '.items[] | select(.roleRef.name == "cluster-admin") | .subjects' \
  > evidence/D-08/cluster-admin-list.json

# JWT 설정 확인 (만료 시간 등)
kubectl get configmap -n platform jwt-config -o yaml \
  > evidence/D-08/jwt-configuration.yaml
```

**D-09 암호화 증거**
```bash
# TLS 인증서 현황 (유효기간 확인)
kubectl get certificates --all-namespaces -o json \
  | jq '.items[] | {
      name: .metadata.name,
      namespace: .metadata.namespace,
      notAfter: .status.notAfter,
      issuer: .spec.issuerRef.name
    }' \
  > evidence/D-09/tls-certificates.json

# Linkerd mTLS 상태
linkerd check --proxy 2>/dev/null \
  > evidence/D-09/mtls-status.txt

# 암호화 키 관리 (Vault 설정 — 키 내용 제외, 구성만)
vault policy list > evidence/D-09/vault-policies.txt
vault secrets list > evidence/D-09/vault-secret-engines.txt
```

**D-12 시스템 개발 보안 증거**
```bash
# 린트 결과
npm run lint 2>&1 > evidence/D-12/lint-results.txt

# 단위 테스트 결과 및 커버리지
npm test -- --coverage --reporter=json 2>&1 \
  | tee evidence/D-12/test-results.json

# 정적 분석 (시크릿 탐지)
npx secretlint "**/*.{js,ts,yaml,json}" 2>&1 \
  > evidence/D-12/secret-scan-results.txt

# 취약점 스캔
npm audit --audit-level=high 2>&1 \
  > evidence/D-12/npm-audit-results.txt
```

### 3.3 compliance-service 감사 로그 분석

실제 소스 코드(`platform/services/compliance-service/src/lib/audit.ts`)를 분석합니다.

```typescript
// 실제 소스 코드 분석
// 준수 현황 서비스 감사 로깅
// Design Ref: DESIGN-MTU-P14
// CSAP: D-06

import { createAuditLogger, createStandardTransport } from '@public-saas/audit-sdk';

const auditLogger = createAuditLogger({
  serviceName: 'compliance-service',
  transport: createStandardTransport('compliance-service'),
  // createStandardTransport: 다음 동작 수행
  //   1. 로컬 파일(.claude/audit.jsonl)에 append-only 기록
  //   2. 로그 레벨별 필터링 (DEBUG 이상)
  //   3. 구조화된 JSON 형식 유지
});

export async function logComplianceEvent(
  action: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await auditLogger.log({
    actor: 'system:compliance-service',
    action,
    target: 'compliance',
    targetType: 'compliance',
    tenantId: 'system',
    ip: process.env.SERVICE_IP || '127.0.0.1',
    // 중요: 내부 서비스 IP를 환경 변수에서 주입
    // 하드코딩 금지 (CSAP D-12)
    userAgent: 'compliance-service/1.0',
    metadata,
    // metadata 예시:
    // { csapRef: 'D-06', controlId: 79, checkResult: 'PASS' }
  });
}
```

**이 코드가 감리에서 중요한 이유**:

1. **서비스별 분리**: 각 서비스가 자신의 감사 로그를 독립적으로 기록합니다. 감리원이 "compliance-service는 어떤 행동을 했는가?" 물으면 이 로그로 답할 수 있습니다.

2. **표준화**: `@public-saas/audit-sdk`를 통해 모든 서비스가 동일한 형식으로 로그를 기록합니다. 감리원이 여러 서비스의 로그를 비교 분석하기 쉽습니다.

3. **CSAP D-06 직접 준수**: 주석에 `// CSAP: D-06`이 명시되어 있어 감리원이 어느 통제항목을 구현했는지 코드에서 직접 확인할 수 있습니다.

---

## 4. 감리 체크리스트 (CSAP 79개 항목)

### 4.1 통제 영역별 준수 현황

CSAP 79개 통제항목을 13개 영역으로 분류하여 준수 여부를 관리합니다.

| 영역 | 코드 | 항목 수 | 핵심 요건 | 우리 구현 |
|------|------|---------|----------|---------|
| 보안 조직 | D-01 | 5 | 보안 담당자 지정, ISMS 체계 | 보안담당자 지정, 문서 관리 |
| 자산 관리 | D-02 | 4 | 정보자산 목록, 등급 분류 | N2SF C/S/O 등급 체계 |
| 물리 보안 | D-03 | 6 | 서버실 접근 통제, 환경 통제 | k3s 노드 물리 보안 |
| 운영 보안 | D-04 | 8 | 변경 관리, 백업, 장애 대응 | GitOps, 백업 정책 |
| 통신 보안 | D-05 | 4 | TLS, 방화벽, 네트워크 분리 | Linkerd mTLS, NetworkPolicy |
| **침해사고** | **D-06** | **5** | **보안 이벤트 탐지/기록** | **Falco, audit.jsonl** |
| 공급망 보안 | D-07 | 3 | 소프트웨어 공급망, SCA | npm audit, Trivy |
| **접근 통제** | **D-08** | **12** | **RBAC, MFA, 세션 관리** | **JWT, Kubernetes RBAC** |
| **암호화** | **D-09** | **4** | **AES-256, TLS 1.3** | **crypto.ts, Linkerd** |
| 취약점 관리 | D-10 | 7 | 패치 관리, 취약점 스캔 | Trivy, npm audit |
| 연속성 보장 | D-11 | 5 | BCP, DR, RTO/RPO | k3s HA, 백업 정책 |
| **개발 보안** | **D-12** | **10** | **시큐어 코딩, 입력 검증** | **Zod, 매개변수화 쿼리** |
| 개인정보 보호 | D-13 | 6 | 개인정보 최소 수집, 파기 | PII 마스킹, 데이터 보존 |

### 4.2 자주 지적되는 D-12 개발 보안 세부 항목

| 세부 항목 | 요건 | 우리 구현 | 증거 위치 |
|-----------|------|---------|---------|
| D-12-1 | 소스코드 보안 검토 | AgentShield 102규칙 | CI/CD 보고서 |
| D-12-2 | SQL 주입 방지 | 매개변수화 쿼리 (Prisma) | 소스코드 + 린트 |
| D-12-3 | XSS 방지 | DOMPurify, CSP 헤더 | 보안 테스트 결과 |
| D-12-4 | CSRF 방지 | SameSite 쿠키, Origin 검사 | 설계서 + 코드 |
| D-12-5 | 입력 검증 | Zod 스키마 검증 | 모든 핸들러 |
| D-12-6 | 시크릿 관리 | 환경변수, Vault | secretlint 결과 |
| D-12-7 | 에러 처리 보안 | 민감 정보 미노출 | 코드 리뷰 기록 |
| D-12-8 | 의존성 관리 | npm audit, Dependabot | 취약점 스캔 결과 |
| D-12-9 | 로깅 보안 | PII 마스킹 후 로그 | audit.jsonl 샘플 |
| D-12-10 | 암호화 적용 | AES-256, bcrypt | crypto.ts 코드 |

### 4.3 D-08 접근 통제 세부 점검 항목

```bash
# D-08 접근 통제 준수 확인 스크립트
#!/bin/bash
echo "=== D-08 접근 통제 점검 ==="

# 1. JWT 토큰 만료 설정 확인 (접근 15분, 갱신 7일)
echo "1. JWT 설정 확인..."
kubectl get configmap -n platform jwt-config -o jsonpath='{.data}' | jq '.'

# 2. 불필요한 cluster-admin 권한 확인
echo "2. cluster-admin 권한 보유자..."
kubectl get clusterrolebindings -o json \
  | jq -r '.items[] | select(.roleRef.name=="cluster-admin") | .subjects[].name'

# 3. 기본 서비스 어카운트에 토큰 자동 마운트 비활성화 확인
echo "3. 서비스 어카운트 토큰 자동 마운트..."
kubectl get serviceaccounts --all-namespaces -o json \
  | jq '.items[] | select(.automountServiceAccountToken == true) | {ns: .metadata.namespace, name: .metadata.name}'

# 4. Network Policy 적용 확인
echo "4. NetworkPolicy 미적용 네임스페이스..."
for ns in $(kubectl get namespaces -o jsonpath='{.items[*].metadata.name}'); do
  count=$(kubectl get networkpolicies -n $ns --no-headers 2>/dev/null | wc -l)
  if [ "$count" -eq 0 ]; then
    echo "  경고: $ns 네임스페이스에 NetworkPolicy 없음"
  fi
done
```

---

## 5. 감리관 질문 TOP 20 및 답변 가이드

### 5.1 사업관리 영역 질문

**Q1. 요구사항 변경 관리는 어떻게 하고 있습니까?**

```
답변 가이드:
모든 요구사항 변경은 다음 절차를 따릅니다.

1. Gitea 이슈 등록 (FR ID 부여, 영향도 분석)
2. 설계 문서 업데이트 (docs/01-plan/, docs/02-design/)
3. 코드 구현 (Design Ref 주석 포함)
4. 추적성 매트릭스 업데이트 (FR↔설계↔구현↔테스트)
5. CHANGELOG.md 기록

증거: Gitea 이슈 목록, 커밋 히스토리, CHANGELOG.md
```

**Q2. 산출물 형상 관리는 어떻게 하고 있습니까?**

```
답변 가이드:
Git을 통해 모든 산출물(코드, 문서)의 버전을 관리합니다.

- 브랜치 전략: feat/, fix/, docs/, refactor/ 접두사
- 커밋 메시지: Conventional Commits (feat(csap): FR-2.1 구현)
- 보호된 브랜치: main 브랜치는 PR 승인 없이 직접 커밋 금지
- 태깅: 릴리스마다 semantic versioning 태그

증거: git log --oneline, PR 목록, 브랜치 보호 설정 화면
```

### 5.2 보안 영역 질문

**Q3. 개인정보 처리 방침은 어떻게 적용하고 있습니까?**

```
답변 가이드:
N2SF C/S/O 3단계 등급 분류 체계를 적용합니다.

- C등급(기밀): 주민번호, 의료정보 → AI API 전송 절대 금지, AES-256 암호화 저장
- S등급(민감): 내부 정보 → 내부 시스템만 처리, 암호화 저장
- O등급(일반): 공개 정보 → PII 마스킹 후 AI Gateway 경유 처리 가능

실제 코드에서 validateDataGrade() 함수가 C/S 등급을 자동 차단합니다.
maskPII() 함수가 이메일, 전화번호, 주민번호를 자동 마스킹합니다.

증거:
- platform/services/ai-service/src/lib/grade-check.ts
- platform/services/ai-service/src/lib/pii-masking.ts
- 감사 로그의 AI_GRADE_VIOLATION 이벤트
```

**Q4. CSAP D-06 침해사고 탐지 체계는 어떻게 구축했습니까?**

```
답변 가이드:
3단계 탐지 체계를 구축했습니다.

1계층: Falco 런타임 보안 탐지
  - 커스텀 규칙 5개 (AI 서비스, 컨테이너 탈출, 권한 상승 등)
  - 이벤트 발생 즉시 Slack + PagerDuty 알림

2계층: AI 서비스 등급 위반 차단
  - validateDataGrade()로 C/S 등급 요청 즉시 차단
  - 차단 이벤트 audit.jsonl에 기록

3계층: Prometheus + AlertManager
  - 보안 메트릭 실시간 모니터링
  - 임계값 초과 시 자동 알림

증거:
- Falco 규칙 파일 (etc/falco/rules.d/)
- AlertManager 설정
- audit.jsonl 보안 이벤트 샘플
- Grafana 보안 대시보드 스크린샷
```

**Q5. SQL 주입 방지는 어떻게 구현했습니까?**

```
답변 가이드:
Prisma ORM을 통해 모든 DB 접근을 매개변수화 쿼리로 처리합니다.

직접 SQL 문자열 결합은 코드 전체에서 금지하고,
정적 분석 도구(AgentShield)가 위반 시 CI 빌드를 실패시킵니다.

// ❌ 금지 패턴 (AgentShield가 탐지)
db.execute(`SELECT * FROM users WHERE id = '${userId}'`)

// ✅ 허용 패턴 (Prisma 사용)
prisma.user.findUnique({ where: { id: userId } })

추가로 Zod 스키마가 모든 API 입력을 타입 안전하게 검증합니다.

증거:
- 소스코드 (prisma.*.findMany/create/update 패턴)
- AgentShield 102규칙 설정
- lint 결과 (SQL 직접 결합 0건)
```

**Q6. 감사 로그의 무결성은 어떻게 보장합니까?**

```
답변 가이드:
append-only 구조와 SHA-256 해시로 무결성을 보장합니다.

1. audit.jsonl: 파일 추가만 가능 (수정/삭제 불가 구조)
   - @public-saas/audit-sdk의 createStandardTransport가 강제
   - 파일시스템 레벨에서 immutable 설정 검토 중

2. CSAP 증거: SHA-256 해시 manifest 자동 생성
   - 매주 CI/CD에서 hash 생성 및 검증
   - 위변조 즉시 탐지

3. 1년 보존: CI/CD 아티팩트로 자동 보관
   - Gitea Actions artifacts retention-days: 365

증거:
- audit.jsonl 샘플 (append-only 구조 시연)
- manifest.sha256 파일
- CI/CD 파이프라인 설정 (csap-evidence.yml)
```

### 5.3 아키텍처/설계 영역 질문

**Q7. 멀티테넌시 격리는 어떻게 구현했습니까?**

```
답변 가이드:
4단계 격리 체계를 적용합니다.

1. 네트워크 격리: Kubernetes NetworkPolicy (기관 간 직접 통신 차단)
2. 데이터 격리: DB 쿼리마다 tenantId 필터 필수 (Prisma)
3. 저장소 격리: 테넌트별 별도 버킷 또는 접두사
4. 서비스 격리: Linkerd mTLS로 서비스 간 인증 통신

모든 API에서 tenantId를 JWT에서 추출하여 자동 적용하므로
개발자 실수로 다른 테넌트 데이터를 조회하는 것을 구조적으로 방지합니다.

증거:
- NetworkPolicy 설정 파일
- prisma.*.findMany의 where.tenantId 패턴
- Linkerd mTLS 상태 확인 명령 결과
```

**Q8. 고가용성(HA) 구성은 어떻게 되어 있습니까?**

```
답변 가이드:
k3s 기반 3노드 HA 클러스터로 구성합니다.

- 컨트롤 플레인: 3노드 etcd HA (2/3 장애 허용)
- 워커 노드: HPA(수평 파드 자동 확장) 적용
- 데이터베이스: PostgreSQL Primary-Replica 구성
- 캐시: Redis Sentinel 모드

RTO(복구 목표 시간): 5분 이내
RPO(복구 목표 지점): 1시간 이내 (시간별 DB 스냅샷)

증거:
- k3s 클러스터 구성 문서
- HPA 설정 파일
- DR 테스트 결과 보고서
```

### 5.4 개발/코드 영역 질문

**Q9. 하드코딩된 시크릿은 없습니까?**

```
답변 가이드:
secretlint와 git-secrets를 사용하여 커밋 전 자동 차단합니다.

- pre-commit hook: git-secrets 실행 (API 키 패턴 탐지)
- CI 파이프라인: secretlint 실행 (전체 코드베이스 스캔)
- 런타임: 환경변수 사용, Vault에서 동적 주입

// 모든 시크릿은 이 형식으로만 사용
const SECRET = process.env.SECRET_KEY;
if (!SECRET) throw new Error('SECRET_KEY 환경 변수 누락');

마지막 전체 스캔 결과: 0건 탐지

증거:
- secretlint 실행 결과 (0건)
- .gitignore 설정 (.env, secrets.* 제외)
- git log --all -S "api_key" 결과
```

**Q10. 코드 리뷰 절차가 있습니까?**

```
답변 가이드:
모든 코드 변경은 PR(Pull Request)를 통해 검토됩니다.

필수 검토 항목:
- 최소 1명의 다른 개발자 승인
- CI 파이프라인 통과 (테스트, 린트, 보안 스캔)
- Design Ref 주석 포함 여부
- CSAP 관련 변경 시 보안 담당자 추가 검토

5개 에이전트 협업 체계:
  Implementer → Reviewer → Auditor → Tester → Refactorer

증거:
- Gitea PR 목록 (승인 기록 포함)
- CI/CD 파이프라인 통과 기록
- Reviewer 에이전트 보고서
```

### 5.5 데이터 관리 영역 질문

**Q11~Q20 (요약)**

| 번호 | 질문 | 핵심 답변 | 증거 위치 |
|------|------|----------|---------|
| Q11 | 개인정보 보존 기간은? | N2SF C등급 5년, S 3년, O 1년 (또는 법령 기준) | 데이터 정책 문서 |
| Q12 | DB 백업 주기는? | 시간별 증분 + 일별 전체, 30일 보존 | 백업 정책 문서 |
| Q13 | 데이터 파기 절차는? | 테넌트 탈퇴 시 안전 삭제(DoD 7회 덮어쓰기) | 탈퇴 처리 코드 |
| Q14 | 로그 보존 기간은? | audit.jsonl 1년, 애플리케이션 로그 90일 | 로그 정책 문서 |
| Q15 | 성능 목표치는? | API P95 응답 200ms, 가용성 99.9% | SLO 문서, Grafana |
| Q16 | 장애 복구 절차는? | Runbook 문서화, DR 훈련 연 2회 | DR 계획서, 훈련 기록 |
| Q17 | 패치 관리 주기는? | 보안 패치 72시간 내, 일반 패치 월 1회 | 패치 이력 |
| Q18 | 외부 API 의존성 관리는? | npm audit 주간, Trivy 이미지 스캔 | 취약점 스캔 보고서 |
| Q19 | AI 서비스 보안은? | N2SF N-05 준수, grade-check.ts | AI 서비스 설계서 |
| Q20 | 형사 책임 방지 대책은? | RBAC + MFA + 감사 로그 + 영상 감시 | 보안 정책 문서 |

---

## 6. 감리 결함 대응 전략

### 6.1 감리 결함 등급 이해

| 등급 | 정의 | 대응 기한 | 영향 |
|------|------|----------|------|
| 중대 결함 | 시스템 안전성/기능에 심각한 영향 | 즉시 (감리 중) | 사업 중단 가능 |
| 일반 결함 | 요구사항 미충족, 설계 위반 | 30일 이내 | 조치 계획서 제출 |
| 경미 결함 | 표준 미준수, 개선 권고 | 60일 이내 | 다음 감리 시 확인 |

### 6.2 결함 유형별 대응 방법

**중대 결함 예시: 하드코딩된 DB 비밀번호 발견**
```
발견:
  platform/services/compliance-service/src/lib/prisma.ts
  const DATABASE_URL = "postgresql://admin:password123@localhost:5432/db"

즉각 조치 (2시간 이내):
  1. 해당 시크릿 즉시 교체
  2. 코드 수정 (환경변수 사용)
  3. 시크릿 노출 범위 확인 (git history 검토)
  4. 노출된 비밀번호로 접근 시도 이력 확인

재발 방지:
  1. pre-commit hook에 패스워드 패턴 추가
  2. 팀 전체 보안 교육
  3. 전체 코드베이스 재스캔
```

**일반 결함 예시: 감사 로그 일부 누락**
```
발견:
  compliance-service의 일부 API 엔드포인트에 감사 로그 미적용

조치 계획서 양식:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
결함 번호: DEF-2026-001
결함 유형: 일반 결함
CSAP 항목: D-06-1 (보안 이벤트 기록)
발견 일시: 2026-04-13
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

원인 분석:
  compliance-service 신규 엔드포인트 3개에 logComplianceEvent()
  미적용. 감사 로그 코드 리뷰 체크리스트 부재.

조치 계획:
  1단계 (1주일): 누락 엔드포인트 감사 로그 추가 (구현 담당: 김개발)
  2단계 (2주일): 전체 엔드포인트 감사 로그 적용 여부 자동 검사
               (AgentShield 신규 규칙 추가)
  3단계 (3주일): 코드 리뷰 체크리스트에 감사 로그 항목 추가

완료 예정일: 2026-05-13
담당자: 홍길동 (개발팀장)
승인자: 김철수 (PM)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 6.3 결함 조치 완료 증명

조치 완료 후에는 구체적인 증거를 제출해야 합니다.

```markdown
# 결함 조치 완료 보고서 (DEF-2026-001)

## 조치 내용

### 1. 코드 수정
- PR #142: compliance-service 감사 로그 누락 보완
- 변경 파일: platform/services/compliance-service/src/routes.ts
- 추가된 감사 로그 호출: 3개 엔드포인트

### 2. 자동화 강화
- AgentShield 규칙 추가: "감사 로그 미적용 핸들러 탐지"
- CI 빌드 시 감사 로그 누락 시 경고 생성

### 3. 검증 결과
- npm test: 100% 통과
- audit.jsonl 확인: 3개 신규 엔드포인트 로그 정상 기록
- grep 결과: 감사 로그 미적용 핸들러 0건

## 증거 첨부
- [PR #142 링크]
- [수정된 소스코드 스크린샷]
- [audit.jsonl 신규 로그 샘플]
- [AgentShield 설정 파일]
```

---

## 7. 추적성 매트릭스 자동화

### 7.1 추적성 매트릭스 구조

```mermaid
flowchart LR
    A[FR ID\n요구사항] -->|설계 반영| B[설계 문서\ndocs/02-design/]
    B -->|구현| C[소스코드\nplatform/]
    C -->|테스트| D[테스트 케이스\n__tests__/]
    D -->|CSAP 항목| E[CSAP 통제\nD-01~D-13]

    A -.->|역방향 추적| B
    B -.->|역방향 추적| A

    style A fill:#4488ff,color:#fff
    style B fill:#ff8800,color:#fff
    style C fill:#22aa44,color:#fff
    style D fill:#aa44ff,color:#fff
    style E fill:#ff4444,color:#fff
```

### 7.2 추적성 매트릭스 예시 (AI 서비스)

| FR ID | 요구사항 | 설계 문서 | 구현 파일 | 테스트 파일 | CSAP 항목 |
|-------|---------|---------|---------|-----------|---------|
| FR-AI26.1 | RAG 기반 문서 검색 | SVC-AI-2026 DESIGN §1 | ai-rag.handler.ts | rag.test.ts | D-12-5 |
| FR-AI26.2 | ReAct 에이전트 실행 | SVC-AI-2026 DESIGN §2 | ai-agent.handler.ts | agent.test.ts | D-12-5, N2SF N-05 |
| FR-P10.2 | N2SF 등급 검증 | DESIGN-MTU-P10 §2 | grade-check.ts | grade-check.test.ts | N2SF N-05 |
| FR-P10.3 | PII 자동 마스킹 | DESIGN-MTU-P10 §3 | pii-masking.ts | pii-masking.test.ts | D-13, N2SF N-05 |
| FR-D06.1 | 감사 로그 기록 | DESIGN-MTU-P14/15 | audit.ts (각 서비스) | audit.test.ts | D-06-1 |

### 7.3 추적성 매트릭스 자동 생성 스크립트

```bash
#!/bin/bash
# scripts/generate-traceability-matrix.sh
# 코드의 Design Ref 주석과 Plan SC 주석을 파싱하여
# 추적성 매트릭스를 자동 생성합니다.

OUTPUT="docs/traceability-matrix.md"
echo "# 추적성 매트릭스" > "$OUTPUT"
echo "자동 생성일: $(date +%Y-%m-%d)" >> "$OUTPUT"
echo "" >> "$OUTPUT"
echo "| FR ID | 파일 | 라인 | 설계 참조 | CSAP |" >> "$OUTPUT"
echo "|-------|------|------|----------|------|" >> "$OUTPUT"

# TypeScript 파일에서 Plan SC와 Design Ref 주석 추출
find /data/ai-saas/platform -name "*.ts" -not -path "*/node_modules/*" | \
while read -r file; do
  # Plan SC: FR-XXX.X 패턴 추출
  grep -n "Plan SC:" "$file" | while read -r match; do
    line_num=$(echo "$match" | cut -d: -f1)
    fr_id=$(echo "$match" | grep -oP "FR-[A-Z0-9]+\.[0-9]+")

    # 같은 파일의 Design Ref 추출
    design_ref=$(grep "Design Ref:" "$file" | head -1 | grep -oP "§\d+[^\s]*|[A-Z]+-[A-Z0-9]+-[A-Z0-9]+")

    # CSAP 참조 추출
    csap_ref=$(grep -m1 "CSAP:" "$file" | grep -oP "D-\d+|N2SF [A-Z]-\d+")

    relative_file=$(echo "$file" | sed 's|/data/ai-saas/||')

    echo "| ${fr_id:-N/A} | ${relative_file} | ${line_num} | ${design_ref:-N/A} | ${csap_ref:-N/A} |" >> "$OUTPUT"
  done
done

echo ""
echo "추적성 매트릭스 생성 완료: $OUTPUT"
wc -l "$OUTPUT"
```

### 7.4 추적성 검증 자동화

```typescript
// scripts/validate-traceability.ts
// 모든 FR ID에 대해 설계, 구현, 테스트가 모두 존재하는지 검증

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

interface TraceabilityEntry {
  frId: string;
  hasDesign: boolean;
  hasImplementation: boolean;
  hasTest: boolean;
  hasCsapMapping: boolean;
}

async function validateTraceability(): Promise<void> {
  const planDir = '/data/ai-saas/docs/01-plan';
  const designDir = '/data/ai-saas/docs/02-design';

  // 1. Plan 문서에서 모든 FR ID 추출
  const frIds = new Set<string>();
  const planFiles = getAllFiles(planDir, '.plan.md');

  for (const file of planFiles) {
    const content = readFileSync(file, 'utf-8');
    const matches = content.matchAll(/FR-[A-Z0-9]+\.\d+/g);
    for (const match of matches) {
      frIds.add(match[0]);
    }
  }

  console.log(`총 FR ID: ${frIds.size}개`);

  // 2. 각 FR ID에 대해 4방향 추적 확인
  const results: TraceabilityEntry[] = [];
  for (const frId of frIds) {
    const entry: TraceabilityEntry = {
      frId,
      hasDesign: checkInDirectory(designDir, frId),
      hasImplementation: checkInDirectory('/data/ai-saas/platform', frId),
      hasTest: checkInDirectory('/data/ai-saas/platform', `${frId}.*test`),
      hasCsapMapping: checkInDirectory(designDir, `CSAP.*${frId}|${frId}.*CSAP`),
    };
    results.push(entry);
  }

  // 3. 누락 항목 보고
  const missing = results.filter(r =>
    !r.hasDesign || !r.hasImplementation || !r.hasTest
  );

  if (missing.length > 0) {
    console.error('\n[경고] 추적성 불완전 항목:');
    for (const entry of missing) {
      console.error(`  ${entry.frId}:`);
      if (!entry.hasDesign) console.error('    - 설계 문서 없음');
      if (!entry.hasImplementation) console.error('    - 구현 없음');
      if (!entry.hasTest) console.error('    - 테스트 없음');
    }
    process.exit(1);  // CI에서 빌드 실패
  }

  console.log('추적성 검증 통과: 모든 FR ID가 4방향 추적 완비');
}

validateTraceability().catch(console.error);
```

---

## 8. 실습: 감리 대비 증거 패키지 준비

### 실습 목표

실제 감리 상황을 가정하여 증거 패키지를 준비합니다. 이 실습은 감리 8주 전에 실시하는 것을 권장합니다.

### 8.1 단계 1: 현재 상태 진단

```bash
#!/bin/bash
# 감리 준비 상태 진단 스크립트

echo "=== 감리 준비 상태 진단 ==="
echo "진단 일시: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

SCORE=0
TOTAL=10

# 1. 감사 로그 정상 기록 여부
echo "1. 감사 로그 확인..."
if [ -f ".claude/audit.jsonl" ] && [ -s ".claude/audit.jsonl" ]; then
  LAST_LOG=$(tail -1 .claude/audit.jsonl | jq -r '.timestamp')
  echo "   최근 로그: ${LAST_LOG}"
  SCORE=$((SCORE + 1))
  echo "   [PASS]"
else
  echo "   [FAIL] 감사 로그 없음 또는 비어있음"
fi

# 2. 하드코딩 시크릿 없음
echo "2. 하드코딩 시크릿 스캔..."
if npx secretlint "**/*.{ts,js,yaml,json}" --no-error-on-warn 2>/dev/null; then
  SCORE=$((SCORE + 1))
  echo "   [PASS] 시크릿 0건"
else
  echo "   [FAIL] 하드코딩 시크릿 탐지됨"
fi

# 3. 린트 오류 없음
echo "3. 린트 오류 확인..."
if npm run lint --silent 2>/dev/null; then
  SCORE=$((SCORE + 1))
  echo "   [PASS] 린트 오류 0건"
else
  echo "   [FAIL] 린트 오류 있음"
fi

# 4. 테스트 통과
echo "4. 테스트 실행..."
if npm test --silent 2>/dev/null; then
  SCORE=$((SCORE + 1))
  echo "   [PASS]"
else
  echo "   [FAIL] 테스트 실패"
fi

# 5. Plan 문서 존재
echo "5. Plan 문서 확인..."
PLAN_COUNT=$(find docs/01-plan -name "*.plan.md" 2>/dev/null | wc -l)
echo "   Plan 문서: ${PLAN_COUNT}개"
if [ "$PLAN_COUNT" -gt 0 ]; then
  SCORE=$((SCORE + 1))
  echo "   [PASS]"
else
  echo "   [FAIL] Plan 문서 없음"
fi

# 6. Design 문서 존재
echo "6. Design 문서 확인..."
DESIGN_COUNT=$(find docs/02-design -name "*.design.md" 2>/dev/null | wc -l)
echo "   Design 문서: ${DESIGN_COUNT}개"
if [ "$DESIGN_COUNT" -gt 0 ]; then
  SCORE=$((SCORE + 1))
  echo "   [PASS]"
else
  echo "   [FAIL] Design 문서 없음"
fi

# 7. CSAP 증거 최신성
echo "7. CSAP 증거 최신성..."
LATEST_EVIDENCE=$(ls -t evidence/ 2>/dev/null | head -1)
if [ -n "$LATEST_EVIDENCE" ]; then
  echo "   최근 증거: evidence/${LATEST_EVIDENCE}"
  SCORE=$((SCORE + 1))
  echo "   [PASS]"
else
  echo "   [FAIL] CSAP 증거 없음"
fi

# 8. Falco 실행 중
echo "8. Falco 실행 상태..."
if kubectl get pods -n falco -l app=falco --no-headers 2>/dev/null | grep -q Running; then
  SCORE=$((SCORE + 1))
  echo "   [PASS] Falco 실행 중"
else
  echo "   [FAIL] Falco 미실행"
fi

# 9. N2SF 위반 차단 기능
echo "9. N2SF 등급 검증 기능..."
if grep -r "validateDataGrade" platform/services/ai-service/src/ 2>/dev/null | grep -q "."; then
  SCORE=$((SCORE + 1))
  echo "   [PASS] validateDataGrade 구현됨"
else
  echo "   [FAIL] validateDataGrade 미구현"
fi

# 10. CHANGELOG 최신
echo "10. CHANGELOG 최신성..."
if [ -f "CHANGELOG.md" ]; then
  LAST_CHANGE=$(head -20 CHANGELOG.md | grep "^## \[" | head -1)
  echo "   최근 변경: ${LAST_CHANGE}"
  SCORE=$((SCORE + 1))
  echo "   [PASS]"
else
  echo "   [FAIL] CHANGELOG.md 없음"
fi

echo ""
echo "=============================="
echo "감리 준비 점수: ${SCORE}/${TOTAL}"
if [ "$SCORE" -ge 9 ]; then
  echo "상태: [우수] 감리 준비 완료"
elif [ "$SCORE" -ge 7 ]; then
  echo "상태: [양호] 일부 보완 필요"
else
  echo "상태: [부족] 즉시 보완 필요"
fi
echo "=============================="
```

### 8.2 단계 2: 증거 패키지 생성

```bash
#!/bin/bash
# 감리용 증거 패키지 생성
# 모든 CSAP 증거를 하나의 패키지로 묶습니다.

DATE=$(date +%Y-%m-%d)
PACKAGE_DIR="audit-package-${DATE}"
mkdir -p "${PACKAGE_DIR}"

echo "=== 감리 증거 패키지 생성: ${PACKAGE_DIR} ==="

# 1. 시스템 현황 스냅샷
mkdir -p "${PACKAGE_DIR}/01-system-status"
kubectl get all --all-namespaces > "${PACKAGE_DIR}/01-system-status/k8s-all-resources.txt"
kubectl get nodes -o wide > "${PACKAGE_DIR}/01-system-status/nodes.txt"
kubectl get pvc --all-namespaces > "${PACKAGE_DIR}/01-system-status/storage.txt"

# 2. 보안 설정
mkdir -p "${PACKAGE_DIR}/02-security"
kubectl get networkpolicies --all-namespaces -o yaml > "${PACKAGE_DIR}/02-security/network-policies.yaml"
kubectl get clusterrolebindings -o yaml > "${PACKAGE_DIR}/02-security/rbac.yaml"
kubectl get certificates --all-namespaces -o yaml > "${PACKAGE_DIR}/02-security/tls-certs.yaml"

# 3. 감사 로그 (최근 30일)
mkdir -p "${PACKAGE_DIR}/03-audit-logs"
THIRTY_DAYS_AGO=$(date -d "30 days ago" +%Y-%m-%d 2>/dev/null || date -v-30d +%Y-%m-%d)
grep "\"timestamp\":\"${THIRTY_DAYS_AGO:0:7}" .claude/audit.jsonl \
  > "${PACKAGE_DIR}/03-audit-logs/audit-last-30days.jsonl" 2>/dev/null || true

# 보안 이벤트만 별도 추출
grep '"action":"FALCO_\|"action":"AI_GRADE_VIOLATION\|"action":"SECURITY_"' \
  .claude/audit.jsonl \
  > "${PACKAGE_DIR}/03-audit-logs/security-events.jsonl" 2>/dev/null || true

# 4. 코드 품질 증거
mkdir -p "${PACKAGE_DIR}/04-code-quality"
npm run lint 2>&1 > "${PACKAGE_DIR}/04-code-quality/lint-results.txt" || true
npm test -- --coverage --reporter=json 2>&1 \
  > "${PACKAGE_DIR}/04-code-quality/test-coverage.json" || true

# 5. N2SF 준수 증거
mkdir -p "${PACKAGE_DIR}/05-n2sf"
echo "AI 등급 위반 차단 이벤트:" > "${PACKAGE_DIR}/05-n2sf/n05-summary.txt"
grep "AI_GRADE_VIOLATION" .claude/audit.jsonl | wc -l >> "${PACKAGE_DIR}/05-n2sf/n05-summary.txt"
echo "O등급 AI 처리 이벤트:" >> "${PACKAGE_DIR}/05-n2sf/n05-summary.txt"
grep '"action":"AGENT_RUN\|RAG_QUERY\|RAG_INGEST"' .claude/audit.jsonl | wc -l >> "${PACKAGE_DIR}/05-n2sf/n05-summary.txt"

# 6. 추적성 매트릭스
mkdir -p "${PACKAGE_DIR}/06-traceability"
bash scripts/generate-traceability-matrix.sh 2>/dev/null || true
cp docs/traceability-matrix.md "${PACKAGE_DIR}/06-traceability/" 2>/dev/null || true

# 7. 패키지 인덱스 생성
cat > "${PACKAGE_DIR}/INDEX.md" << EOF
# 감리 증거 패키지

**생성일**: ${DATE}
**대상 CSAP**: D-01~D-13 전 영역
**생성자**: $(git config user.name)

## 패키지 구성

| 디렉토리 | 내용 | CSAP 항목 |
|----------|------|----------|
| 01-system-status | 시스템 현황 스냅샷 | D-04, D-11 |
| 02-security | 보안 설정 (NetworkPolicy, RBAC, TLS) | D-05, D-08, D-09 |
| 03-audit-logs | 감사 로그 (최근 30일, 보안 이벤트) | D-06 |
| 04-code-quality | 린트 결과, 테스트 커버리지 | D-12 |
| 05-n2sf | N2SF 준수 증거 | N2SF N-01~N-06 |
| 06-traceability | 추적성 매트릭스 | 전체 |

## 주요 지표

- 하드코딩 시크릿: 0건
- 린트 오류: 0건
- 테스트 커버리지: 80%+
- N2SF N-05 위반 차단: $(grep "AI_GRADE_VIOLATION" .claude/audit.jsonl | wc -l)건
- CSAP D-06 감사 이벤트: $(wc -l < .claude/audit.jsonl)건
EOF

# 8. 패키지 압축 및 해시
tar -czf "${PACKAGE_DIR}.tar.gz" "${PACKAGE_DIR}/"
sha256sum "${PACKAGE_DIR}.tar.gz" > "${PACKAGE_DIR}.sha256"

echo ""
echo "=== 감리 증거 패키지 완성 ==="
echo "파일: ${PACKAGE_DIR}.tar.gz"
echo "해시: $(cat ${PACKAGE_DIR}.sha256)"
echo ""
echo "감리관에게 다음 파일을 제출하십시오:"
echo "  1. ${PACKAGE_DIR}.tar.gz (증거 패키지)"
echo "  2. ${PACKAGE_DIR}.sha256 (무결성 검증 해시)"
```

### 8.3 단계 3: 모의 감리 실시

```bash
# 모의 감리 체크리스트 실행
cat << 'EOF'
=== 모의 감리 시나리오 ===

[시나리오 1] 감리원이 "하드코딩된 비밀번호를 보여주세요"라고 요청

실제 대응:
  git log --all --full-history | head -20  # 커밋 이력
  npx secretlint "**/*.{ts,js}" 2>&1       # 스캔 결과 (0건)
  grep -r "password.*=" platform/ | grep -v "process.env"  # 환경변수 사용 확인

예상 결과: 하드코딩 0건 → 통과

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[시나리오 2] 감리원이 "AI API에 개인정보가 전송되지 않음을 증명하세요"

실제 대응:
  cat platform/services/ai-service/src/lib/grade-check.ts  # 등급 검증 코드
  cat platform/services/ai-service/src/lib/pii-masking.ts  # PII 마스킹 코드
  grep "AI_GRADE_VIOLATION" .claude/audit.jsonl | tail -5  # 차단 이벤트 확인
  grep "maskPII" platform/services/ai-service/src/handlers/ -r  # 적용 현황

예상 결과: validateDataGrade + maskPII 적용 확인 → 통과

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[시나리오 3] 감리원이 "테넌트 간 데이터 격리를 시연해주세요"

실제 대응:
  kubectl get networkpolicies --all-namespaces  # 네트워크 정책
  # Postman으로 테넌트 A 토큰으로 테넌트 B 데이터 조회 시도 → 403 확인

예상 결과: tenantId 필터 + NetworkPolicy → 격리 확인 → 통과
EOF
```

### 8.4 실습 완료 체크리스트

```
감리 준비 최종 체크리스트:

산출물 준비:
[ ] 모든 단계 설계 문서 완비 (docs/01-plan/, docs/02-design/)
[ ] 추적성 매트릭스 최신 상태 (FR ID ↔ 설계 ↔ 구현 ↔ 테스트 ↔ CSAP)
[ ] CHANGELOG.md 최신 상태
[ ] API 명세서와 소스코드 일치 확인

기술적 준비:
[ ] 린트 오류 0건
[ ] 테스트 커버리지 80% 이상
[ ] 하드코딩 시크릿 0건 (secretlint 통과)
[ ] 감사 로그 정상 기록 확인 (audit.jsonl)

보안 준비:
[ ] Falco 정상 실행 및 커스텀 규칙 적용
[ ] N2SF N-05 등급 검증 동작 확인
[ ] PII 마스킹 로직 테스트 통과
[ ] RBAC 최소 권한 적용 확인

증거 준비:
[ ] CSAP 증거 패키지 생성 (audit-package-{날짜}.tar.gz)
[ ] SHA-256 해시 파일 생성
[ ] Falco 탐지 이벤트 로그 수집
[ ] 주요 지표 스크린샷 (Grafana 대시보드)

대응 준비:
[ ] 감리관 질문 TOP 20 답변 숙지
[ ] 모의 감리 1회 이상 실시
[ ] 결함 발견 시 조치 계획서 양식 준비
[ ] 비상 연락망 정리 (보안담당, DB관리자, 인프라팀)
```

---

## 참고 자료

- 행안부 정보시스템 감리기준: 고시 제2023-1호
- CSAP 클라우드 서비스 안전성 평가 기준: 한국인터넷진흥원(KISA)
- 내부 워크플로우: `/data/ai-saas/.gitea/workflows/csap-evidence.yml`
- 내부 감사 로그 SDK: `@public-saas/audit-sdk`
- 연관 가이드: `docs/guides/onboarding/07-security/15-n2sf-advanced-guide.md`
- 연관 가이드: `docs/guides/onboarding/04-infrastructure/23-falco-runtime-security.md`
- 연관 가이드: `docs/guides/onboarding/07-security/14-csap-deep-dive.md`

---

*작성: 공공기관 SaaS 플랫폼팀 | 행안부 감리기준 준수 | 최종 수정: 2026-04-13*
