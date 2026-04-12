# CSAP·보안 FAQ

> **문서 ID**: ONBOARD-11-CSAP
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **작성자**: Implementer (Sonnet)
> **대상**: 전체 팀원 (필수 숙지)
> **질문 수**: 20개

---

## CSAP 기본 개념

---

**Q1. CSAP가 뭐예요?**

A: **클라우드 서비스 보안인증제**(Cloud Security Assurance Program)입니다. 공공기관이 클라우드 서비스를 도입할 때 해당 서비스가 보안 기준을 충족하는지 확인하는 제도입니다.

과학기술정보통신부와 한국인터넷진흥원(KISA)이 운영하며, 세 가지 등급이 있습니다.

| 등급 | 대상 | 인증 항목 수 |
|------|------|-----------|
| 하 | 공개 데이터 처리 서비스 | 최소 기준 |
| 중 | 일반 공공 서비스 | 79개 통제항목 |
| 상 | 민감 정보 처리 서비스 | 79개 + 추가 항목 |

이 프로젝트는 **중/상 등급**을 목표로 합니다. 모든 개발자는 79개 통제항목을 준수해야 합니다.

```
CSAP 주요 통제 영역:
- D-08: 접근 통제 (인증·인가·세션 관리)
- D-09: 암호화 (저장·전송 데이터)
- D-06: 침해사고 대응 (감사 로그)
- D-12: 개발 보안 (입력 검증·SQL 인젝션 방지)
```

---

**Q2. N2SF는 뭐예요?**

A: **국가 정보보호 프레임워크**(National Security Framework)입니다. 공공기관이 외부 서비스(특히 AI/클라우드)를 활용할 때 데이터를 어떻게 취급해야 하는지 정의합니다.

이 프로젝트에서 N2SF의 핵심은 **데이터 등급 분류**입니다. AI API에 어떤 데이터를 보낼 수 있는지를 결정합니다.

---

**Q3. 감사 로그를 왜 써야 해요? 실제로 쓰는 사람이 있나요?**

A: CSAP D-06 통제항목으로 법적 의무입니다. 세 가지 실제 사용 사례가 있습니다.

1. **보안 사고 조사**: "누가 언제 어떤 데이터를 봤는가"를 추적합니다.
2. **감리 증거**: 연간 감리 시 감사 로그 완비 여부를 검증합니다.
3. **규정 준수 증명**: 개인정보 침해 의혹 발생 시 적절한 접근 통제 증거로 사용됩니다.

```typescript
// 감사 로그를 써야 하는 상황
await auditLog({
  actor: user.id,           // 누가
  action: 'USER_DELETE',    // 무엇을 했는지
  target: targetUserId,     // 대상
  timestamp: new Date().toISOString(),
  ip: getClientIP(),
});

// 감사 로그가 필요한 작업 목록
// - 사용자 생성/수정/삭제
// - 비밀번호 변경
// - 권한 변경
// - 관리자 기능 호출
// - 대량 데이터 조회
// - 파일 다운로드
```

---

**Q4. ISMS-P는 CSAP와 다른가요?**

A: 다른 인증입니다. 모두 알아야 하지만 이 프로젝트에서는 CSAP가 우선입니다.

| 인증 | 대상 | 초점 |
|------|------|------|
| CSAP | 클라우드 서비스 제공자 | 클라우드 인프라 보안 |
| ISMS-P | 정보 처리 사업자 | 정보보호 관리 체계 전반 |
| CC (공통평가기준) | IT 제품 | 제품 보안 기능 평가 |

---

## 데이터 등급

---

**Q5. C등급, S등급, O등급 차이가 뭐예요?**

A: N2SF에서 정의하는 데이터 보안 등급입니다.

| 등급 | 명칭 | 예시 | AI API 전송 |
|------|------|------|-----------|
| C | 기밀 (Confidential) | 주민등록번호, 비밀 계획서 | 절대 금지 |
| S | 민감 (Sensitive) | 개인 연락처, 내부 문서 | 절대 금지 |
| O | 공개 (Open) | 공개 데이터, 통계, 일반 문의 | PII 마스킹 후 가능 |

```typescript
// 코드에서 데이터 등급 확인 예시
enum DataGrade { C = 'C', S = 'S', O = 'O' }

async function sendToAI(data: any, grade: DataGrade) {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터 AI API 전송 금지 (N2SF N-05)`);
  }
  // O 등급만: PII 마스킹 후 전송
  const masked = await maskPII(data);
  return aiGateway.send(masked);
}
```

---

**Q6. AI API에 데이터를 보내도 돼요?**

A: 등급에 따라 다릅니다.

```
C등급 (기밀): 절대 불가
S등급 (민감): 절대 불가
O등급 (공개): PII 마스킹 후 전송 가능
```

**PII(개인식별정보) 마스킹 예시**:

```typescript
// 이름: "홍길동" → "홍**"
// 이메일: "user@example.com" → "us**@****.com"
// 전화번호: "010-1234-5678" → "010-****-5678"

const masked = await maskPII({
  content: userMessage,  // O등급 문의 내용
  // 실수로 포함된 PII도 자동 마스킹
});
```

AI API를 호출하는 코드를 작성할 때는 반드시 팀 리드 또는 보안팀의 검토를 받으십시오.

---

**Q7. AI 기능을 개발할 때 내부 AI Gateway를 반드시 써야 하나요?**

A: 예. 외부 AI API를 직접 호출하면 안 됩니다.

```typescript
// 금지: 외부 AI API 직접 호출
const openai = new OpenAI({ apiKey: 'sk-...' });
const response = await openai.chat.completions.create(...);

// 올바른 방법: 내부 AI Gateway 경유
import { aiGateway } from '@public-saas/ai-gateway';
const response = await aiGateway.chat({
  model: 'claude-opus-4-6',
  messages: [...],
  dataGrade: DataGrade.O,  // 등급 명시 필수
});
```

AI Gateway는 다음을 자동으로 처리합니다:
- 데이터 등급 검증
- PII 마스킹
- 감사 로그 기록
- 외부 API 호출 제한

---

## 코딩 보안 규칙

---

**Q8. 하드코딩된 키가 왜 안 돼요? 개발 환경에서도요?**

A: 세 가지 이유입니다.

1. **git 히스토리에 영구 보존**: `git rm`으로 파일을 지워도 git 히스토리에 남습니다. 저장소에 접근하는 사람 모두가 볼 수 있습니다.
2. **습관 형성**: "개발 환경에서는 괜찮다"는 생각이 실수로 프로덕션 시크릿을 하드코딩하는 습관을 만듭니다.
3. **CSAP D-09 위반**: 인증 심사에서 발견 시 즉각 감점됩니다.

```typescript
// 절대 금지
const API_KEY = 'sk-abc123...';
const DB_PASS = 'admin1234';

// 올바른 방법
const API_KEY = process.env['ANTHROPIC_API_KEY'];
if (!API_KEY) throw new Error('ANTHROPIC_API_KEY 환경 변수 필요');
```

---

**Q9. Zod 검증을 왜 모든 API에 적용해야 해요?**

A: 두 가지 이유입니다.

1. **SQL 인젝션·XSS 방지**: 사용자 입력을 검증하지 않으면 악의적 입력이 DB 쿼리나 HTML에 그대로 들어갑니다. CSAP D-12 요건입니다.
2. **타입 안전성**: `request.body as any`로 입력을 쓰면 런타임 오류가 발생하거나 예상치 못한 데이터가 DB에 저장됩니다.

```typescript
// 검증 없이 — 위험
const { email, role } = request.body as any;
// role에 "admin"을 넣어 권한 상승 가능

// Zod로 검증 — 안전
const schema = z.object({
  email: z.string().email(),
  // role은 사용자 입력에서 받지 않음 (서버가 결정)
});
const { email } = schema.parse(request.body);
```

---

**Q10. RBAC이 뭐예요? 모든 API에 다 붙여야 해요?**

A: RBAC(Role-Based Access Control, 역할 기반 접근 제어)는 사용자의 역할에 따라 API 접근을 제한하는 방법입니다.

**모든 비공개 API에 필수** (공개 엔드포인트 제외):

```typescript
// 공개 엔드포인트 (인증 불필요)
app.get('/health/ping', pingHandler);
app.post('/auth/login', loginHandler);

// 비공개 엔드포인트 (인증·인가 필수)
app.get('/users/me', { preHandler: [authMiddleware] }, getUserHandler);
app.delete('/admin/users/:id', { preHandler: [authMiddleware, adminGuard] }, deleteUserHandler);
```

```typescript
// authMiddleware: JWT 검증 (인증)
// adminGuard: admin 역할 확인 (인가)

export const adminGuard = async (request, reply) => {
  if (!hasPermission(request.user, 'admin:*')) {
    return reply.status(403).send({ error: 'FORBIDDEN' });
  }
};
```

---

## Q-Gate

---

**Q11. Q-Gate G6가 뭐예요?**

A: Q-Gate는 PR이 머지되기 위해 통과해야 하는 7단계 품질 게이트입니다. G6는 CSAP 준수 검증 단계입니다.

| 게이트 | 내용 | 담당 에이전트 |
|--------|------|-------------|
| G1 | FR ID 전수 확인 | Auditor |
| G2 | 설계 완전성 확인 | Auditor |
| G3 | 코드 품질 + 102 정적분석 규칙 | Reviewer |
| G4 | 테스트 커버리지 80%+ | Tester |
| G5 | OWASP Top10 통과 | Reviewer |
| G6 | CSAP 해당 Phase 100% | Auditor |
| G7 | 감사 추적 audit.jsonl 완비 | Auditor |

G6 실패 원인 대부분: `auditLog()` 누락, 하드코딩 시크릿, RBAC 없는 API.

---

**Q12. Q-Gate G7의 audit.jsonl은 뭐예요?**

A: Claude Code 에이전트가 수행한 모든 작업의 감사 추적 파일입니다.

```bash
# 감사 로그 확인
cat /data/ai-saas/.claude/audit.jsonl | head -5 | jq .
```

G7 실패 원인: 민감 작업을 수행했지만 `auditLog()` 호출이 누락된 경우. 코드를 검토하여 누락된 감사 로그를 추가하면 됩니다.

---

**Q13. Semgrep이 보안 오류를 잡았어요. 어떻게 고쳐요?**

A: 오류 유형별 해결 방법입니다.

```bash
# 로컬에서 Semgrep 실행
npx semgrep --config auto platform/services/auth-service/src/

# 결과 예시
# path/to/file.ts:42: [ERROR] sql-injection: SQL query constructed from user input
```

**자주 나오는 Semgrep 오류**:

| 규칙 | 원인 | 해결 방법 |
|------|------|---------|
| `sql-injection` | SQL 직접 결합 | 매개변수화 쿼리 사용 |
| `hardcoded-secret` | 코드에 시크릿 포함 | 환경 변수로 이전 |
| `missing-auth` | 인증 없는 엔드포인트 | authMiddleware 추가 |
| `eval-injection` | `eval()` 사용 | 대안 방법으로 교체 |

---

## 운영 보안

---

**Q14. 실수로 .env 파일을 커밋했어요. 어떻게 해요?**

A: **즉시** 다음 세 단계를 수행하십시오.

1. **시크릿 폐기 및 재발급**: 커밋된 모든 키, 비밀번호, 토큰을 즉시 무효화합니다.
2. **보안팀 보고**: 보안 사고로 처리됩니다. 숨기면 더 큰 문제가 됩니다.
3. **git 히스토리 정리** (보안팀 지시 후):

```bash
# BFG Repo-Cleaner로 히스토리에서 파일 제거
java -jar bfg.jar --delete-files .env
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force  # 팀 리드 승인 후 진행
```

**예방**: `.gitignore`에 `.env*` 패턴이 등록되어 있는지 확인하십시오.

```bash
cat .gitignore | grep env
# .env
# .env.local
# .env.*.local
```

---

**Q15. 코드 리뷰 중에 보안 취약점을 발견했어요. 어떻게 보고해요?**

A: 취약점 심각도에 따라 처리 방법이 다릅니다.

**즉각 블로킹 (HIGH)**:
- 하드코딩 시크릿
- SQL 인젝션
- RBAC 완전 누락
- 민감 데이터 AI API 전송

```
처리: Reviewer 에이전트가 PR 블로킹 → Implementer에게 수정 요청
```

**머지 전 수정 (MEDIUM)**:
- 입력 검증 누락
- 감사 로그 누락
- 에러 메시지 정보 노출

```
처리: 코드 리뷰 댓글로 수정 요청
```

**다음 PR에서 수정 (LOW)**:
- 불필요한 주석
- 타입 단언(`as any`) 사용

---

## 감사 및 컴플라이언스

---

**Q16. CSAP 감사 증거는 자동으로 수집돼요?**

A: 예. `csap-evidence.yml` 파이프라인이 매주 월요일 09:00 KST에 자동 실행됩니다.

```bash
# 수동으로 즉시 실행
# Gitea Web UI → Actions → csap-evidence → Run workflow

# 수집되는 증거 목록
# - D-08: 접근 로그 (로그인·로그아웃 이벤트)
# - D-09: 암호화 설정 스크린샷 (TLS 1.3 확인)
# - D-06: 감사 로그 샘플
# - D-12: Semgrep 스캔 결과
# - 취약점 스캔 결과 (Trivy)
```

---

**Q17. 감리원이 왔을 때 개발자가 준비해야 하는 것이 뭐예요?**

A: 세 가지를 준비하십시오.

1. **내 작업물의 FR 추적성**: 내가 구현한 기능의 FR ID → Plan 문서 → 코드 → 테스트 연결을 설명할 수 있어야 합니다.
2. **보안 패턴 설명**: `auditLog()`, `verifyToken()`, Zod 검증이 왜 있는지 설명할 수 있어야 합니다.
3. **Q-Gate 이력**: PR의 Q-Gate 통과 이력이 Gitea에 자동 보존됩니다.

---

**Q18. 개발자가 직접 감사 로그 파일을 수정할 수 있나요?**

A: 기술적으로는 가능하지만, 다음 이유로 절대 하면 안 됩니다.

1. 감사 로그는 append-only 구조입니다. 수정하면 무결성 검증에서 탐지됩니다.
2. 감사 로그 변조는 CSAP D-06 위반으로 인증 취소 사유입니다.
3. 수사 기관의 요청 시 법적 책임이 발생합니다.

---

## 자주 묻는 개념

---

**Q19. TLS 1.3이 왜 필요해요? TLS 1.2도 안 되나요?**

A: CSAP D-09 전송 암호화 요건은 TLS 1.3+ 이상을 요구합니다. TLS 1.2는 일부 취약점이 알려져 있어 공공기관 서비스에서는 허용되지 않습니다.

```bash
# Ingress에서 TLS 설정 확인
kubectl get ingress saas-ingress -n saas-platform -o yaml | grep tls

# TLS 버전 확인
openssl s_client -connect api.saas.local:443 -tls1_2
# should fail (TLS 1.2 비활성화)

openssl s_client -connect api.saas.local:443 -tls1_3
# should succeed (TLS 1.3 활성화)
```

---

**Q20. bcrypt rounds를 몇으로 설정해야 해요?**

A: 최소 10, 권장 12입니다.

| rounds | 해시 시간 (현대 CPU) | 보안 강도 |
|--------|-----------------|---------|
| 10 | ~100ms | CSAP 최소 요건 충족 |
| 12 | ~400ms | 권장 (이 프로젝트 표준) |
| 14 | ~1.6초 | 높은 보안, 성능 저하 |

```typescript
// 올바른 설정 (CSAP D-09)
const hashedPassword = await bcrypt.hash(password, 12);

// 너무 낮음 — 브루트포스에 취약
const hashedPassword = await bcrypt.hash(password, 4);   // CSAP 위반

// 너무 높음 — 로그인 응답이 1초 이상 걸림
const hashedPassword = await bcrypt.hash(password, 16);  // UX 저하
```

rounds를 높일수록 보안은 강해지지만 로그인 시간이 느려집니다. 12 rounds에서 하드웨어 업그레이드 주기에 맞춰 주기적으로 검토합니다.

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 초안 작성 (20개 질문) | Implementer (Sonnet) |
