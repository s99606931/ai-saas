# 개발자 CSAP 체크리스트

> **버전**: 1.0.0 | **작성일**: 2026-04-11
> **대상**: 매일 코드를 작성하는 모든 개발자
> **전제 조건**: `01-what-is-csap.md` 학습 완료
> **소요 시간**: 약 45분 (이후 일상 업무에서 참조)
> **CSAP**: D-06, D-08, D-09, D-12

---

## 목차

1. [코딩 중 확인해야 할 항목](#1-코딩-중-확인해야-할-항목)
2. [PR 제출 전 셀프 점검 스크립트](#2-pr-제출-전-셀프-점검-스크립트)
3. [자동화된 CSAP 증거 수집 방법](#3-자동화된-csap-증거-수집-방법)
4. [CSAP 관련 파일 구조](#4-csap-관련-파일-구조)

---

## 1. 코딩 중 확인해야 할 항목

### 1.1 새 API 엔드포인트를 만들 때

새로운 HTTP 엔드포인트를 작성할 때마다 다음을 확인합니다.

```
[ ] 인증 검사: verifyToken() 호출이 있는가?
    → 없으면 누구나 접근 가능 (D-08 위반)

[ ] 권한 검사: hasPermission() 호출이 있는가?
    → 없으면 인증된 사용자가 모든 기능 사용 가능 (D-08 위반)

[ ] 입력 검증: 요청 바디/쿼리를 Zod 스키마로 검증하는가?
    → 없으면 SQL 주입, XSS 취약점 가능 (D-12 위반)

[ ] 테넌트 격리: 쿼리에 tenantId 필터가 있는가?
    → 없으면 다른 테넌트 데이터 접근 가능 (D-08 위반)

[ ] 에러 처리: 에러 응답에 내부 정보가 없는가?
    → 스택 트레이스, DB 정보, 환경 변수 노출 금지 (D-09 위반)

[ ] 감사 로그: 민감 작업이라면 auditLog() 호출이 있는가?
    → 삭제, 수정, 권한 변경 등은 필수 (D-06 위반)
```

**빠른 확인 템플릿**:

```typescript
// 새 엔드포인트 작성 시 이 구조를 시작점으로 사용
export async function POST(req: Request) {
  // [D-08] 1. 인증 검사
  const user = await verifyToken(req.headers.get('authorization'));
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // [D-08] 2. 권한 검사
  if (!hasPermission(user, 'resource:action')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // [D-12] 3. 입력 검증
  const body = await req.json();
  const validated = requestSchema.safeParse(body);
  if (!validated.success) {
    return Response.json({ error: 'Validation failed', details: validated.error.errors }, { status: 400 });
  }

  try {
    // [D-06] 4. 감사 로그 (민감 작업인 경우)
    await auditLog({ actor: user.id, action: 'RESOURCE_CREATE', /* ... */ });

    // 5. 비즈니스 로직
    const result = await doBusinessLogic(validated.data, user.tenantId);
    return Response.json(result, { status: 201 });
  } catch (error) {
    // [D-09] 6. 안전한 에러 응답
    const errorId = randomUUID();
    logger.error({ errorId, error: error.message }, 'Operation failed');
    return Response.json({ error: 'Internal error', errorId }, { status: 500 });
  }
}
```

### 1.2 DB 쿼리를 작성할 때

```
[ ] 파라미터화 쿼리: 문자열 직접 결합이 없는가?
    ❌: `SELECT * FROM users WHERE id = '${userId}'`
    ✅: db.execute('SELECT * FROM users WHERE id = $1', [userId])
    ✅: db.users.findFirst({ where: { id: userId } })  // Prisma

[ ] 민감 데이터 암호화: 저장 전 암호화가 되는가?
    ❌: { ssn: '123-456-7890' }          (평문 저장)
    ✅: { ssn: await encrypt('123-456-7890') }  (암호화 후 저장)

[ ] 비밀번호 해시: bcrypt 사용 여부
    ❌: { password: plainPassword }        (평문 저장)
    ✅: { password: await bcrypt.hash(password, 12) }
```

### 1.3 비밀번호/시크릿을 다룰 때

```
[ ] 환경 변수 사용: 시크릿이 코드에 없는가?
    ❌: const secret = 'hardcoded-secret-value'
    ✅: const secret = process.env.SECRET_KEY

[ ] 환경 변수 존재 확인: 시작 시 누락 감지
    if (!process.env.SECRET_KEY) {
      throw new Error('SECRET_KEY 환경 변수가 설정되지 않았습니다');
    }

[ ] 로그에 시크릿 노출 확인
    ❌: logger.info({ password: user.password })
    ✅: logger.info({ userId: user.id })  // 비밀번호 제외
```

### 1.4 외부 AI API를 호출할 때

**N2SF 데이터 등급 확인이 필수입니다**:

```typescript
// [N2SF] AI API 호출 전 데이터 등급 확인
enum DataGrade { C = 'C', S = 'S', O = 'O' }

async function callAI(data: any, grade: DataGrade) {
  // ❌ C, S 등급 데이터는 절대 AI API 전송 금지
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }

  // ✅ O 등급만: PII 마스킹 후 AI Gateway 경유
  const masked = await maskPII(data);
  return aiGateway.send(masked);  // 직접 외부 API 호출 금지
}
```

---

## 2. PR 제출 전 셀프 점검 스크립트

PR을 제출하기 전에 다음 스크립트를 실행합니다.

```bash
#!/bin/bash
# 파일: scripts/csap-self-check.sh
# 사용법: ./scripts/csap-self-check.sh

echo "========================================="
echo " CSAP 셀프 점검 스크립트"
echo " 실행 시각: $(date)"
echo "========================================="
echo ""

FAIL=false

# ======================================================
# D-12: 코드 보안 검사
# ======================================================
echo "--- [D-12] 코드 보안 검사 ---"

# Lint 검사
echo "1. ESLint 실행..."
if pnpm run lint --silent 2>/dev/null; then
  echo "   ✅ Lint 통과"
else
  echo "   ❌ Lint 실패 — pnpm run lint 결과 확인"
  FAIL=true
fi

# TypeScript 검사
echo "2. TypeScript 타입 검사..."
if pnpm run typecheck --silent 2>/dev/null; then
  echo "   ✅ TypeScript 통과"
else
  echo "   ❌ TypeScript 실패 — pnpm run typecheck 결과 확인"
  FAIL=true
fi

# ======================================================
# D-09: 시크릿 탐지
# ======================================================
echo ""
echo "--- [D-09] 하드코딩 시크릿 탐지 ---"

# git diff에서 시크릿 패턴 탐지
echo "3. 시크릿 패턴 스캔..."
SECRET_PATTERNS=(
  'sk-[a-zA-Z0-9]{20,}'          # OpenAI API 키 패턴
  'password\s*=\s*["\x27][^"x27]+["\x27]'  # 하드코딩 비밀번호
  'secret\s*=\s*["\x27][^"x27]{8,}["\x27]' # 하드코딩 시크릿
  'api_key\s*=\s*["\x27][^"\x27]+["\x27]'  # API 키
)

CHANGED_FILES=$(git diff --name-only HEAD~1 2>/dev/null || git diff --name-only)

for file in $CHANGED_FILES; do
  if [[ "$file" == *.ts || "$file" == *.js || "$file" == *.env ]]; then
    if grep -qE 'password\s*=\s*["'"'"'][^"'"'"']+["'"'"']' "$file" 2>/dev/null; then
      echo "   ⚠️  $file: 하드코딩 값 의심 — 확인 필요"
    fi
  fi
done
echo "   ✅ 기본 시크릿 패턴 스캔 완료 (상세 스캔은 CI에서 실행)"

# ======================================================
# D-06: 감사 로그 확인
# ======================================================
echo ""
echo "--- [D-06] 감사 로그 확인 ---"

echo "4. 민감 작업에 auditLog() 호출 확인..."
SENSITIVE_WORDS="delete|destroy|remove|drop|truncate|admin|privilege|permission|role"
MISSING_AUDIT=false

for file in $CHANGED_FILES; do
  if [[ "$file" == *.ts ]]; then
    # 민감 단어가 있는 파일
    if grep -qiE "$SENSITIVE_WORDS" "$file" 2>/dev/null; then
      # auditLog 호출이 없는 경우
      if ! grep -q "auditLog" "$file" 2>/dev/null; then
        echo "   ⚠️  $file: 민감 작업이 있는 것 같지만 auditLog()가 없습니다"
        MISSING_AUDIT=true
      fi
    fi
  fi
done

if [ "$MISSING_AUDIT" = false ]; then
  echo "   ✅ 감사 로그 확인 완료"
fi

# ======================================================
# D-08: API 인증 확인
# ======================================================
echo ""
echo "--- [D-08] API 인증 확인 ---"

echo "5. 새 API 엔드포인트 인증 검사 확인..."
for file in $CHANGED_FILES; do
  if [[ "$file" == *route* || "$file" == *handler* || "$file" == *controller* ]]; then
    if grep -qE "export async function (GET|POST|PUT|DELETE|PATCH)" "$file" 2>/dev/null; then
      if ! grep -q "verifyToken\|authenticate\|requireAuth" "$file" 2>/dev/null; then
        echo "   ⚠️  $file: API 핸들러에 인증 검사가 없을 수 있습니다"
      fi
    fi
  fi
done
echo "   ✅ API 인증 패턴 확인 완료"

# ======================================================
# D-04: 의존성 취약점
# ======================================================
echo ""
echo "--- [D-04] 의존성 취약점 ---"

echo "6. npm 패키지 취약점 스캔..."
AUDIT_RESULT=$(pnpm audit --audit-level=high 2>&1)
if echo "$AUDIT_RESULT" | grep -q "vulnerabilities"; then
  echo "   ⚠️  HIGH/CRITICAL 취약점 발견 — 'pnpm audit' 결과 확인"
  echo "      해결: pnpm update [패키지명] 또는 pnpm audit --fix"
  FAIL=true
else
  echo "   ✅ 취약점 없음"
fi

# ======================================================
# 결과 요약
# ======================================================
echo ""
echo "========================================="
if [ "$FAIL" = true ]; then
  echo " ❌ 일부 항목 실패 — 위 내용 확인 후 수정"
  echo " PR 제출 전 모든 항목을 해결하십시오"
  exit 1
else
  echo " ✅ 기본 CSAP 셀프 점검 통과"
  echo " CI에서 추가 검사(G1-G7)가 실행됩니다"
fi
echo "========================================="
```

```bash
# 스크립트 실행 권한 부여
chmod +x scripts/csap-self-check.sh
```

### 2.1 코드 리뷰 시 체크리스트

PR을 리뷰할 때 다음 항목을 확인합니다.

```
보안 점검:
[ ] API 엔드포인트에 verifyToken() + hasPermission() 있는가?
[ ] 사용자 입력에 Zod 검증이 있는가?
[ ] SQL 쿼리에 파라미터화가 적용되었는가?
[ ] 시크릿이 코드에 하드코딩되지 않았는가?
[ ] 에러 응답에 내부 정보가 노출되지 않는가?
[ ] 민감 작업에 auditLog()가 있는가?
[ ] 데이터 등급 확인 없이 AI API를 직접 호출하지 않는가?

품질 점검:
[ ] 새 함수에 단위 테스트가 있는가?
[ ] 미사용 변수/함수/import가 없는가?
[ ] 함수가 80줄 이하인가?
[ ] 중첩 깊이가 4단계 이하인가?
```

---

## 3. 자동화된 CSAP 증거 수집 방법

CSAP 감사에서는 "준수했다"는 것을 증거로 보여줘야 합니다. 이 플랫폼은 대부분의 증거를 자동으로 수집합니다.

### 3.1 자동 수집되는 증거

| CSAP 항목 | 증거 | 수집 방법 |
|---------|------|---------|
| D-08 접근 통제 | API 인증 로그 | Loki 로그 자동 수집 |
| D-09 암호화 | TLS 인증서 | cert-manager 자동 갱신 |
| D-06 감사 로그 | auditLog() 기록 | `.claude/audit.jsonl` |
| D-12 개발 보안 | Semgrep 스캔 결과 | CI 파이프라인 자동 실행 |
| D-04 공급망 | SBOM 파일 | Syft 자동 생성 |
| D-11 이미지 서명 | Cosign 서명 | CI 파이프라인 자동 실행 |

### 3.2 csap-evidence.yml 워크플로우

`.gitea/workflows/csap-evidence.yml` 워크플로우가 주기적으로 CSAP 증거를 수집합니다.

```bash
# 수동으로 CSAP 증거 수집 트리거
# Gitea Actions → csap-evidence.yml → Run workflow

# 또는 CLI
gh workflow run csap-evidence.yml
```

### 3.3 감사 로그 수동 확인

```bash
# 최근 감사 로그 확인
tail -20 .claude/audit.jsonl | jq .

# 특정 작업 유형 필터링
jq '. | select(.action == "USER_DELETE")' .claude/audit.jsonl

# 특정 사용자의 작업 내역
jq ". | select(.actor == \"admin-user-id\")" .claude/audit.jsonl

# 날짜 범위 필터링
jq '. | select(.timestamp >= "2026-04-01" and .timestamp <= "2026-04-11")' .claude/audit.jsonl
```

### 3.4 CSAP 준수율 대시보드 확인

```
Grafana → Dashboards → CSAP Compliance Overview

주요 패널:
  - D-08 API 인증 실패율 (목표: < 0.1%)
  - D-09 암호화 미적용 데이터 (목표: 0개)
  - D-06 감사 로그 누락률 (목표: 0%)
  - D-12 Semgrep 발견 취약점 (목표: 0 CRITICAL)
```

---

## 4. CSAP 관련 파일 구조

CSAP 증거 및 설정 파일의 위치를 알아둡니다.

```
.claude/
├── audit.jsonl                  ← 감사 로그 (D-06)
└── rules/
    └── csap-compliance.md       ← CSAP 코딩 규칙

infra/monitoring/
├── csap-audit-monitoring-rules.yaml   ← CSAP 모니터링 규칙
├── csap-compliance-recording-rules.yaml
└── dashboards/
    └── csap-compliance.json    ← CSAP 대시보드

.gitea/workflows/
├── csap-evidence.yml           ← 증거 수집 워크플로우
├── quality-gate.yml            ← Q-Gate G6 CSAP 검증
└── devsecops.yml               ← SAST/DAST 보안 스캔

docs/
└── 02-design/csap/             ← CSAP 설계 문서
    ├── d06-audit-log-design.md
    ├── d08-access-control-design.md
    ├── d09-encryption-design.md
    └── d12-secure-coding-design.md
```

---

## CSAP 위반 시 Q-Gate 대응

| 위반 유형 | Q-Gate 단계 | 결과 |
|---------|------------|------|
| 인증 없는 API | G3 (AgentShield) | PR 머지 차단 |
| 하드코딩 시크릿 | G5 (Secret Scan) | PR 머지 차단 |
| 테스트 커버리지 부족 | G4 | PR 머지 차단 |
| Semgrep SAST 탐지 | G5 | PR 머지 차단 |
| 감사 로그 누락 | G7 | PR 머지 차단 |

**Q-Gate는 자동으로 차단합니다.** 가능하면 PR 제출 전 셀프 점검 스크립트로 미리 확인하십시오.

---

## 다음 단계

CSAP 체크리스트를 이해했습니다. 다음은 보안 코딩 패턴을 코드 예시와 함께 상세히 학습합니다.

`../coding/01-secure-patterns.md`로 이동하십시오.

---

> **참조**: `.claude/rules/csap-compliance.md` — 코드 레벨 CSAP 규칙 전문
> **참조**: `.gitea/workflows/quality-gate.yml` — Q-Gate 자동화 코드
> **CSAP 연관**: D-06, D-08, D-09, D-12 (개발자 직접 관련 전 항목)
