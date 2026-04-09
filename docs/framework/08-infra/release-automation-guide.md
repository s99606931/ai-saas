# 릴리스 자동화 운영 가이드

> **버전**: 1.0.0 | **작성일**: 2026-04-09
> **Design Ref**: MTU-N42 Design

---

## 1. Conventional Commits 규칙

| 접두사 | 용도 | 버전 영향 | 예시 |
|--------|------|---------|------|
| `feat` | 신규 기능 | minor (1.x.0) | `feat(csap): D-08 RBAC 구현` |
| `fix` | 버그 수정 | patch (1.0.x) | `fix(auth): JWT 만료 검증 오류` |
| `security` | 보안 수정 | patch | `security(n2sf): C등급 데이터 유출 차단` |
| `perf` | 성능 개선 | patch | `perf(api): 응답 시간 30% 개선` |
| `refactor` | 리팩토링 | patch | `refactor(infra): 중복 코드 제거` |
| `docs` | 문서 | 없음 | `docs(audit): T01 템플릿 업데이트` |
| `ci` | CI/CD | 없음 | `ci(pipeline): 캐싱 최적화` |
| `chore` | 빌드/도구 | 없음 | `chore(deps): pnpm 9.16 업데이트` |
| `BREAKING CHANGE` | 호환성 파괴 | major (x.0.0) | footer에 `BREAKING CHANGE:` |

## 2. 릴리스 흐름

```
feat/fix 커밋 → main push → semantic-release 분석
  → 버전 결정 → CHANGELOG 생성 → Git 태그 → 릴리스
```

## 3. 수동 릴리스

```bash
# semantic-release 로컬 실행 (dry-run)
npx semantic-release --dry-run

# 실제 릴리스 (main 브랜치에서만)
npx semantic-release
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
