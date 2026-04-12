# MTU-N94: 통합 릴리스 노트 + 마이그레이션 가이드 자동화 — Design

> **MTU ID**: MTU-N94
> **Plan 참조**: docs/01-plan/mtus/MTU-N94-release-migration-auto.plan.md
> **작성일**: 2026-04-10

---

## Design Anchor

| 항목 | 내용 |
|------|------|
| 목표 | 릴리스 노트 + 마이그레이션 가이드 + UAT 체크리스트 자동 생성 |
| 제약 | Conventional Commits 기반, Gitea API 호환 |
| 기술 스택 | Bash, Git, jq, Gitea Actions |

## 1. 릴리스 노트 자동 생성 흐름

```
git log --oneline v1.x..HEAD
  |
  ├── feat: → 신규 기능 섹션
  ├── fix: → 버그 수정 섹션
  ├── docs: → 문서 변경 섹션
  ├── refactor: → 리팩토링 섹션
  ├── security: → 보안 패치 섹션 (CVE 번호 추출)
  └── BREAKING CHANGE: → 파괴적 변경 섹션 (마이그레이션 필요)
```

## 2. 마이그레이션 가이드 자동 감지

- `BREAKING CHANGE:` 커밋 → 마이그레이션 단계 자동 생성
- Helm values 변경 → 차이점 자동 비교
- API 엔드포인트 변경 → 매핑 테이블 자동 생성
- 데이터베이스 스키마 변경 → 마이그레이션 스크립트 목록

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 설계 | PM Agent |
