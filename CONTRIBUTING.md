# 기여 가이드 (Contributing Guide)

> 공공기관 SaaS 프레임워크에 기여해 주셔서 감사합니다.
> 이 문서는 프로젝트에 기여하는 방법을 안내합니다.

---

## 1. 기여 방법

### 1.1 이슈 등록

- **버그 신고**: 재현 절차 + 예상 동작 + 실제 동작 포함
- **기능 요청**: 사용 사례 + 제안 구현 방법 포함
- **문서 개선**: 오류/누락 내용 + 개선 제안 포함

### 1.2 PR 제출 절차

1. 이슈 먼저 등록 (또는 기존 이슈 확인)
2. 저장소 포크
3. 브랜치 생성 (`feat/`, `fix/`, `docs/`, `refactor/` 접두사)
4. 변경 사항 구현
5. 테스트 통과 확인
6. PR 제출 (이슈 번호 연결)

### 1.3 코드 리뷰

- 모든 PR은 최소 1명의 리뷰어 승인 필요
- 보안 관련 변경: 추가로 보안 담당자 리뷰 필수
- CSAP/ISMS-P 관련 변경: 감사 담당자 리뷰 필수

---

## 2. 개발 환경 설정

### 2.1 필수 도구

| 도구 | 버전 | 설명 |
|------|------|------|
| Node.js | 20 LTS | 런타임 |
| pnpm | 9.x | 패키지 관리자 |
| Docker | 24.0+ | 컨테이너 환경 |
| Git | 2.40+ | 형상 관리 |

### 2.2 설치

```bash
# 저장소 클론
git clone https://github.com/your-org/public-saas-framework.git
cd public-saas-framework

# 의존성 설치
pnpm install

# 환경 변수 설정
cp docs/env.example .env

# 인프라 기동
docker compose up -d

# DB 마이그레이션
pnpm prisma migrate deploy
```

### 2.3 로컬 실행 확인

```bash
# 포털 기동
pnpm --filter @public-saas/portal dev

# 서비스 기동 (예: user-service)
pnpm --filter @public-saas/user-service dev

# 테스트 실행
pnpm test
```

---

## 3. 커밋 컨벤션

**Conventional Commits** 형식을 필수로 사용합니다.

### 3.1 접두사

| 접두사 | 용도 | 예시 |
|--------|------|------|
| `feat` | 새 기능 | `feat(user): 소프트 삭제 기능 추가` |
| `fix` | 버그 수정 | `fix(auth): JWT 토큰 만료 검증 오류 수정` |
| `docs` | 문서 변경 | `docs(csap): D-08 증적 매핑 업데이트` |
| `refactor` | 리팩토링 | `refactor(api): 중복 미들웨어 통합` |
| `test` | 테스트 추가/수정 | `test(user): 비밀번호 재설정 테스트 추가` |
| `chore` | 빌드/설정 | `chore(docker): PostgreSQL 16 업그레이드` |

### 3.2 커밋 메시지 형식

```
<접두사>(<범위>): <설명>

<본문> (선택)

<꼬리말> (선택)
```

### 3.3 주의사항

- `git commit --no-verify` 사용 금지 (Git 훅 우회 금지)
- `git push --force` 사용 금지 (감사 추적 파괴 방지)
- 시크릿 파일 커밋 금지 (`.env`, `secrets.*`, `*credential*`)

---

## 4. PDCA 워크플로우

### 4.1 기능 추가 시 필수 절차

```
Plan → Design → Do → Check → Report
```

1. **Plan**: `docs/01-plan/features/{feature}.plan.md` 작성
2. **Design**: `docs/02-design/features/{feature}.design.md` 작성
3. **Do**: Plan + Design 완료 후 구현 착수
4. **Check**: Q-Gate 7단계 검증 통과
5. **Report**: 결과 보고서 작성

### 4.2 Q-Gate 통과 기준

| 게이트 | 기준 |
|--------|------|
| G1 | 요구사항 FR ID 전수 추적 |
| G2 | 설계 완전성 확인 |
| G3 | 코드 품질 (ESLint 오류 0건) |
| G4 | 테스트 커버리지 80%+ |
| G5 | OWASP Top 10 통과 |
| G6 | CSAP 해당 항목 100% |
| G7 | 감사 로그 완비 |

### 4.3 중요

- **Plan + Design 없이 PR 제출 불가** (감리 기준 위반)
- 구현 주석에 설계 참조 필수: `// Design Ref: 섹션명`
- Plan 주석 필수: `// Plan SC: FR-XX.X`

---

## 5. 코드 스타일

### 5.1 TypeScript/JavaScript

- 들여쓰기: 2칸
- 함수 크기: 80줄 이하
- 파일 크기: 800줄 이하
- 줄 길이: 120자 이하
- 중첩 깊이: 4단계 이하
- 주석: "무엇"이 아닌 "왜"를 설명

### 5.2 보안 필수 사항

```typescript
// 모든 API 입력은 Zod 스키마 검증 필수
const schema = z.object({ email: z.string().email() });
const validated = schema.parse(body);

// 모든 API 엔드포인트에 RBAC 검사 필수
if (!hasPermission(user, 'resource:read')) {
  return Response.json({ error: 'Forbidden' }, { status: 403 });
}

// SQL 매개변수화 쿼리 필수 (직접 문자열 결합 금지)
const user = await db.execute('SELECT * FROM users WHERE id = $1', [id]);
```

---

## 6. 보안 취약점 보고

보안 취약점을 발견한 경우 **공개 이슈로 등록하지 마십시오**.

### 비공개 보고 절차

1. 이메일로 보안 취약점 상세 내용 전송
2. 48시간 내 확인 및 대응 계획 안내
3. 패치 적용 후 보안 공지 게시
4. 보고자 크레딧 부여 (동의 시)

---

## 7. 행동 강령

- 모든 참여자에게 존중과 친절을 기반으로 소통
- 건설적인 피드백 제공
- 다양한 관점과 경험 존중
- 프로젝트 커뮤니티에 집중

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 최초 작성 | PM Agent |
