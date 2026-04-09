# 코드 품질 분석 결과

| 항목 | 내용 |
|------|------|
| 문서 ID | ANALYSIS-CQ-2026-04 |
| 분석일 | 2026-04-05 |
| 분석 대상 | 프레임워크 코드/스크립트 (인프라, CSAP, N2SF, CC 하네스) |
| 분석 파일 수 | 22개 (Shell 1, Markdown 내 코드블록 21) |
| 분석자 | Code Analyzer Agent (claude-opus-4-6) |

---

## 품질 점수 요약

| 파일/영역 | 점수 | 비고 |
|---------|------|------|
| `08-infra/k3s-wsl2/scripts/install-k3s.sh` | 82/100 | 양호. 보안 관련 개선 필요 |
| `08-infra/k3s-wsl2/cluster-setup-recipe.md` (코드블록) | 78/100 | kubeconfig 권한, 테스트 시크릿 이슈 |
| `08-infra/container-security-baseline.md` (코드블록) | 85/100 | 양호. 체계적인 CIS 매핑 |
| `08-infra/policy-as-code/kyverno-policies.md` (YAML) | 88/100 | 양호. 플레이스홀더 키 주의 |
| `08-infra/policy-as-code/opa-gatekeeper.md` (Rego) | 90/100 | 우수. Rego 로직 정확 |
| `02-csap/standard-grade/implementation-guide/D08-*.md` (TypeScript) | 85/100 | 양호. Rate limiter 메모리 누수 가능성 |
| `02-csap/standard-grade/implementation-guide/D09-*.md` (TypeScript) | 90/100 | 우수. AES-256-GCM + bcrypt 정확 |
| `02-csap/standard-grade/implementation-guide/D12-*.md` (TypeScript) | 87/100 | 양호. OWASP 대응 체계적 |
| `02-csap/standard-grade/implementation-guide/D06-*.md` (TypeScript) | 86/100 | 양호. 해시 체인 무결성 로직 정확 |
| `04-n2sf/data-grade-classification.md` (TypeScript) | 83/100 | PII 마스킹 regex 버그 존재 |
| `04-n2sf/domains/N05-data.md` (TypeScript) | 84/100 | regex.test + replace 연계 버그 |
| `04-n2sf/domains/N03-isolation.md` (YAML/TypeScript) | 87/100 | 양호. NetworkPolicy 체계적 |
| `10-cc-harness/harness-verification-guide.md` (Bash) | 85/100 | 양호. 검증 스크립트 실용적 |

**종합 점수: 85/100**

---

## 발견된 이슈 목록

총 12건 발견 (Critical 2, Important 6, Info 4). 저신뢰도(80% 미만) 항목 3건 필터링됨.

---

### HIGH (즉시 수정 필요)

| 번호 | 파일 | 위치 | 이슈 | 심각도 | 신뢰도 | 권고 조치 |
|------|------|------|------|--------|--------|---------|
| H-01 | `install-k3s.sh` | 115행 | `--write-kubeconfig-mode 644` -- kubeconfig 파일이 모든 사용자에게 읽기 가능. 이 파일은 클러스터 관리자 인증서를 포함하며, 644 권한은 비인가 사용자가 클러스터에 접근 가능. CSAP-D08 접근 통제 위반 | Critical | 95% | `--write-kubeconfig-mode 600`으로 변경. 사용자 접근은 별도 kubeconfig 복사 (Step 5에서 이미 수행) |
| H-02 | `N05-data.md` | 196~199행 | `regex.test()` 호출 후 동일 regex 객체로 `replace()` 호출 -- `test()`가 `lastIndex`를 변경하여 `g` 플래그가 있는 regex에서 `replace()`가 첫 매칭을 건너뛸 수 있음. PII 마스킹 누락으로 C/S등급 데이터가 AI API로 전송될 위험 | Critical | 92% | `test()` 제거하고 `replace()` 결과를 직접 비교하거나, `test()` 후 `pattern.lastIndex = 0` 리셋 추가. 또는 `String.match()` 사용으로 변경 |

---

### MEDIUM (개선 권장)

| 번호 | 파일 | 위치 | 이슈 | 심각도 | 신뢰도 | 권고 조치 |
|------|------|------|------|--------|--------|---------|
| M-01 | `cluster-setup-recipe.md` | 206행 | `--from-literal=password=test123` -- 테스트 명령이지만 `test123`은 실제 패스워드처럼 보이는 값. 복사-붙여넣기로 운영 환경에 적용될 위험. CSAP-D09 암호화 요건 문맥 불일치 | Important | 85% | `--from-literal=key=test-value`로 변경하거나 주석에 "테스트 전용, 즉시 삭제" 강조 추가 |
| M-02 | `D08-access-control.md` | 525~534행 | Rate limiter가 `Map` 객체 기반 -- 만료된 엔트리를 정리하지 않아 장시간 운영 시 메모리 누수. 공공기관 24/7 서비스 기준 심각할 수 있음 | Important | 88% | 정기 정리 타이머 추가: `setInterval(() => { for (const [k,v] of store) if (Date.now() > v.resetAt) store.delete(k) }, 60_000)` 또는 Redis 기반으로 전환 |
| M-03 | `D08-access-control.md` | 444~445행 | `TOKEN_BLACKLIST = new Set<string>()` -- 인메모리 블랙리스트는 서버 재시작 시 초기화되어 로그아웃된 토큰이 재사용 가능. 주석에 "운영: Redis 사용"이라 되어있으나 가이드 코드가 그대로 복사될 위험 | Important | 85% | 주석 강조 수준 높이기: `// WARNING: 운영 환경에서 반드시 Redis/DB로 교체 필수` + Redis 코드 예시 병행 제공 |
| M-04 | `data-grade-classification.md` | 196~198행 | 주민등록번호 마스킹 regex `/\d{6}-?\d{7}/`이 6자리+7자리 숫자 조합이면 모두 매칭 -- 전화번호, 계좌번호 등 오탐 가능. 마스킹 과잉 적용 시 데이터 유실 | Important | 83% | 좀 더 정밀한 패턴 사용: `/(?<!\d)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])-?[1-4]\d{6}(?!\d)/` |
| M-05 | `install-k3s.sh` | 109행 | `curl -sfL https://get.k3s.io \| sh -s -` -- 외부 URL에서 스크립트를 다운로드하여 바로 실행. 공급망 공격에 취약. CSAP-D12-08(패치 관리) + D05(공급망) 관점에서 검증 절차 필요 | Important | 87% | 스크립트를 사전에 다운로드 후 체크섬 검증: `curl -sfL https://get.k3s.io -o install.sh && sha256sum install.sh && sh install.sh` |
| M-06 | `kyverno-policies.md` | 257~262행 | Cosign 공개 키에 플레이스홀더(`-----BEGIN PUBLIC KEY-----\n# Cosign 공개 키 (실제 키로 교체 필수)`) 존재. 이 상태로 적용 시 이미지 서명 검증이 항상 실패하거나 우회 가능 | Important | 90% | 키 생성 명령(`cosign generate-key-pair`)의 출력 예시를 포함하고, 플레이스홀더 적용 시 에러가 발생하도록 검증 로직 추가 권고 |

---

### LOW (참고 사항)

| 번호 | 파일 | 위치 | 이슈 | 비고 |
|------|------|------|------|------|
| L-01 | `coding-style-guide.md` | 243~244행 | 하드코딩 시크릿 예시(`my-secret-key`, `sk-1234567890abcdef`)가 "금지" 교육 목적으로 존재 | 금지 패턴 교육용이므로 허용. 단, git-secrets 자동 스캔 시 오탐 방지를 위해 `# allowlist:` 주석 추가 권고 |
| L-02 | `N03-isolation.md` | 322행 | `cidr: 160.79.104.0/23` -- Anthropic API IP가 예시로 하드코딩. 실제 IP 범위와 다를 수 있음 | 주석에 "(예시)"가 명기되어 있음. ExternalName Service나 FQDN 기반 Egress 정책으로 대체 권고 |
| L-03 | `container-security-baseline.md` | 476행 | metrics-server TLS 우회: `--kubelet-insecure-tls` -- 개발 환경 전용이지만 운영 적용 시 보안 취약 | "개발 환경만" 주석 존재하나 더 명확한 경고 추가 권고: `# WARNING: 운영 환경 적용 금지` |
| L-04 | `harness-verification-guide.md` | 전체 | 검증 스크립트가 `.md` 내 코드블록으로만 존재 -- 별도 `.sh` 파일로 추출하면 자동화 용이 | `10-cc-harness/scripts/harness-verify.sh`로 분리 권고 |

---

## 분석 항목별 상세 결과

### 1. CSAP D-12 개발보안 요건 준수

| 점검 항목 | 결과 | 비고 |
|---------|------|------|
| SQL 인젝션 방어 패턴 | 준수 | D12-01: Zod 검증 + 매개변수화 쿼리 패턴 명시. 금지 패턴(문자열 결합) 명확히 표시 |
| XSS 방어 패턴 | 준수 | D12-01: DOMPurify + ALLOWED_TAGS 화이트리스트 방식 |
| 입력 검증 | 준수 | Zod 스키마 예시 충실. 이메일/이름/전화번호/역할 검증 포함 |
| 보안 코딩 가이드 | 준수 | D12-02: 10항목 코드 리뷰 체크리스트 제공 |
| OWASP Top 10 대응 | 준수 | D12-03: 10개 항목 전수 대응 매핑 테이블 존재 |
| 안전한 에러 처리 | 준수 | errorId(UUID) 반환 패턴, 민감정보 미노출 패턴 존재 |

### 2. N2SF C/S 등급 데이터 AI API 전송 차단 로직

| 점검 항목 | 결과 | 비고 |
|---------|------|------|
| DataGrade enum 정의 | 존재 | `data-grade-classification.md`: C/S/O 3등급 enum |
| C/S 등급 차단 로직 | 존재 | `sendToAI()` 함수에서 `if (grade === DataGrade.C \|\| grade === DataGrade.S)` 즉시 throw |
| 차단 시 감사 로그 | 존재 | `AI_API_BLOCKED` 액션으로 audit.jsonl 기록 |
| O 등급 PII 마스킹 | 존재 | `maskPII()` + `validateNoRemainingPII()` 이중 검증 |
| AI 라우팅 분기 | 존재 | N05-data.md: C/S -> LM Studio(온프레미스), O -> Claude API(외부) |
| 미분류 데이터 fail-safe | 존재 | 미분류 시 S등급 기본 적용 + AI 라우팅 차단 |

### 3. TypeScript 코드 품질

| 점검 항목 | 결과 | 비고 |
|---------|------|------|
| 타입 안전성 | 양호 | enum, interface, Record, 제네릭 적절히 사용 |
| 에러 핸들링 | 양호 | 커스텀 에러 클래스(`AuthError`, `DataGradeError`, `PIIMaskingError`) 사용 |
| 시크릿 하드코딩 | 미발견 | 모든 시크릿이 `process.env.*`로 참조. 누락 시 throw 패턴 |
| 비동기 처리 | 양호 | async/await 일관 사용, 적절한 에러 전파 |
| 함수 크기 | 양호 | 대부분 30줄 이내. 단일 책임 원칙 준수 |

### 4. Shell 스크립트 품질 (`install-k3s.sh`)

| 점검 항목 | 결과 | 비고 |
|---------|------|------|
| `set -euo pipefail` | 준수 | 엄격 모드 적용 |
| 에러 핸들링 | 양호 | 타임아웃 로직, exit 코드, 조건 분기 적절 |
| 사용자 입력 처리 | 양호 | `read -p` + 확인 후 진행 |
| 로깅 | 우수 | 컬러 로그 함수(INFO/OK/WARN/ERROR) 체계적 |
| 멱등성 | 양호 | `--dry-run=client -o yaml \| kubectl apply -f -` 패턴 사용 |
| 변수 기본값 | 양호 | `${VAR:-default}` 패턴 사용 |
| root 권한 확인 | 존재 | `id -u` 검사 |

### 5. Kubernetes YAML/Kyverno/OPA 품질

| 점검 항목 | 결과 | 비고 |
|---------|------|------|
| NetworkPolicy 체계 | 우수 | C/S/O 등급별 3단계 격리. deny-all 기본 + 화이트리스트 |
| Kyverno 정책 | 우수 | 8개 정책 CSAP 매핑 명확. annotations에 csap.control 태깅 |
| OPA Rego 로직 | 우수 | 3개 정책. 등급 계층 검증, 로그 보존 기간 검증 정확 |
| PSS(Pod Security Standards) | 준수 | restricted 모드 적용. securityContext 표준 템플릿 제공 |
| RBAC | 준수 | ClusterRole/ClusterRoleBinding 정의. 최소 권한 원칙 |

### 6. 하드코딩된 IP/도메인/패스워드

| 항목 | 위치 | 판정 | 비고 |
|------|------|------|------|
| `10.42.0.0/16`, `10.43.0.0/16` | install-k3s.sh, recipe.md | 허용 | k3s 기본 CIDR, 환경변수로 오버라이드 가능 |
| `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` | N03-isolation.md | 허용 | RFC 1918 사설 IP 대역 (표준) |
| `0.0.0.0/0` | D10, D13, N03 | 허용 | NetworkPolicy 와일드카드 (표준 패턴) |
| `160.79.104.0/23` | N03-isolation.md | 주의 | "(예시)" 주석 있으나 실제 IP와 다를 수 있음 |
| `password=test123` | cluster-setup-recipe.md | 수정 필요 | 테스트 시크릿이지만 복사-붙여넣기 위험 (M-01) |
| `my-secret-key`, `sk-1234567890abcdef` | coding-style-guide.md | 허용 | 금지 패턴 교육 목적 (L-01) |

---

## ECC AgentShield 핵심 규칙 위반 여부

| AgentShield 규칙 | 결과 | 비고 |
|---------------|------|------|
| 하드코딩 시크릿 금지 | 통과 | 교육용 예시만 존재 (주석으로 "절대 금지" 표시) |
| SQL 인젝션 방지 | 통과 | 매개변수화 쿼리 패턴만 사용. 직접 결합 예시는 "BLOCKED" 주석 |
| XSS 방지 | 통과 | DOMPurify 새니타이제이션 패턴 존재 |
| RBAC 적용 | 통과 | 모든 API 엔드포인트에 권한 검사 패턴 존재 |
| 감사 로그 | 통과 | 모든 민감 작업에 auditLog() 호출 패턴 존재 |
| 환경변수 사용 | 통과 | 모든 시크릿이 process.env 참조 |
| `--no-verify` 금지 | 통과 | 하네스 검증 가이드에 차단 테스트 포함 |
| `--force` 금지 | 통과 | 하네스 검증 가이드에 차단 테스트 포함 |

---

## 즉시 수정 필요 항목

### 1. [H-01] kubeconfig 파일 권한 644 -> 600

**파일**: `docs/framework/08-infra/k3s-wsl2/scripts/install-k3s.sh` 115행
**파일**: `docs/framework/08-infra/k3s-wsl2/cluster-setup-recipe.md` 114행

```bash
# 현재 (보안 취약)
--write-kubeconfig-mode 644

# 수정 (권장)
--write-kubeconfig-mode 600
```

**근거**: kubeconfig 파일은 클러스터 관리자 인증서를 포함. 644 권한은 시스템의 모든 사용자가 읽기 가능하여 CSAP-D08(접근 통제) 위반. 사용자 접근은 Step 5에서 `~/.kube/config` 복사로 처리되므로 원본 파일은 600이 적합.

### 2. [H-02] PII 마스킹 regex `test()` + `g` 플래그 버그

**파일**: `docs/framework/04-n2sf/domains/N05-data.md` 196~199행

```typescript
// 현재 (버그)
for (const [field, pattern] of Object.entries(PII_PATTERNS)) {
    if (pattern && pattern.test(maskedText)) {        // test()가 lastIndex 변경
        maskedText = maskedText.replace(pattern, ...)  // 첫 매칭 건너뛸 수 있음
    }
}

// 수정 (권장)
for (const [field, pattern] of Object.entries(PII_PATTERNS)) {
    if (pattern) {
        const replaced = maskedText.replace(pattern, `[${field}_MASKED]`)
        if (replaced !== maskedText) {
            maskedFields.push(field)
            maskedText = replaced
        }
    }
}
```

**근거**: JavaScript의 `g` 플래그가 있는 RegExp 객체는 `test()` 호출 시 `lastIndex`를 업데이트함. 이후 `replace()` 호출 시 `lastIndex` 위치부터 검색하여 첫 번째 매칭을 건너뛸 수 있음. PII 마스킹이 불완전해지면 N2SF N-05 위반으로 민감 데이터가 외부 AI API로 전송될 수 있음.

---

## 권고 개선사항

### 단기 (1주 이내)

1. **H-01, H-02 즉시 수정** -- 위 2건의 보안 이슈는 프레임워크 문서가 구현 가이드로 사용되므로 즉시 수정 필요
2. **M-01 테스트 시크릿 값 변경** -- `password=test123` -> `key=example-value` 변경
3. **M-06 Cosign 키 플레이스홀더** -- 키 생성 절차 및 주의사항 보강

### 중기 (Phase 2 구현 시)

4. **M-02 Rate limiter 메모리 관리** -- 실제 구현 시 Redis 기반 또는 정기 정리 로직 추가
5. **M-03 토큰 블랙리스트** -- Redis 기반 구현 코드 예시 병행 제공
6. **M-04 주민등록번호 regex 정밀화** -- 실제 구현 시 생년월일/성별 코드 검증 추가
7. **M-05 k3s 설치 스크립트 체크섬 검증** -- 실제 배포 시 스크립트 사전 다운로드 + 체크섬 검증 절차 추가

### 장기 (아키텍처 개선)

8. **L-04 검증 스크립트 분리** -- `10-cc-harness/` 내 Bash 검증 스크립트를 별도 `.sh` 파일로 추출하여 CI/CD 자동화 연계
9. **L-02 IP 기반 Egress -> FQDN 기반 전환** -- Anthropic API IP 하드코딩 대신 ExternalName Service 또는 FQDN 기반 정책 검토

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 코드 품질 분석 -- 22개 파일 분석, 12건 이슈 발견 (Critical 2, Important 6, Info 4) | Code Analyzer (Opus) |
