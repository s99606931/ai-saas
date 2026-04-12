# MTU-N136: 변경 관리 자동화 — Design

> 버전: 1.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Design Anchor

| 항목 | 내용 |
|------|------|
| Plan 참조 | docs/01-plan/mtus/MTU-N136.plan.md |
| 아키텍처 선택 | Pragmatic Balance — Git diff + 경로 기반 서비스 매핑 |
| 핵심 결정 | 파일 경로 기반 영향 분석, 4단계 위험도 분류 |

## 1. 변경 영향 분석 모델

### 1.1 파일 카테고리 분류

| 카테고리 | 경로 패턴 | 위험도 가중치 |
|---------|----------|-------------|
| 인프라 | infra/** | HIGH (x3) |
| 보안 | **/security/**, **/auth/** | CRITICAL (x4) |
| 데이터베이스 | **/migrations/**, **/schema/** | CRITICAL (x4) |
| 서비스 코드 | platform/services/** | MED (x2) |
| 라이브러리 | platform/packages/** | MED (x2) |
| CI/CD | .gitea/workflows/** | HIGH (x3) |
| 문서 | docs/** | LOW (x1) |
| 설정 | *.yaml, *.json (infra) | HIGH (x3) |
| 테스트 | **/*.test.*, **/*.spec.* | LOW (x1) |

### 1.2 위험도 계산

```
위험 점수 = SUM(변경 파일 수 * 카테고리 가중치)
  CRITICAL: >= 50
  HIGH:     >= 30
  MED:      >= 15
  LOW:      < 15
```

### 1.3 롤백 계획 템플릿

```
1. Git 롤백: git revert {커밋 해시}
2. Helm 롤백: helm rollback {릴리스} {리비전}
3. K8s 롤백: kubectl rollout undo deployment/{이름}
4. DB 롤백: 마이그레이션 다운 명령
```

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 초기 설계 | PM Lead |
