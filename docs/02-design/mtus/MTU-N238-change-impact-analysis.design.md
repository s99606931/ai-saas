# MTU-N238: 릴리스 변경 영향 분석 자동화 -- Design

> **버전**: 1.0 | **작성일**: 2026-04-10

## 분석 알고리즘

```
[Git Diff] → [파일 분류] → [위험도 가중치] → [영향 범위] → [종합 점수]
                                                 ↓
                                          [보고서 생성]
```

### 파일 분류 및 위험도 가중치

| 카테고리 | 패턴 | 기본 가중치 |
|---------|------|-----------|
| 보안 | **/security/**, auth/**, **/rbac/** | 5 (Critical) |
| 인프라 | infra/**, helm/**, k8s/** | 4 (High) |
| API | **/api/**, **/routes/** | 3 (High) |
| DB | **/migration/**, **/schema/** | 4 (High) |
| 비즈니스 로직 | src/services/**, packages/** | 2 (Medium) |
| 테스트 | tests/**, **/*.test.* | 1 (Low) |
| 문서 | docs/**, *.md | 0 (Info) |
| 설정 | *.yaml, *.json (비인프라) | 2 (Medium) |

### 종합 위험도 판정

- Score 0-5: Low (자동 배포 가능)
- Score 6-15: Medium (리뷰 필수)
- Score 16-30: High (시니어 리뷰 + 스테이징 검증 필수)
- Score 31+: Critical (보안팀 승인 + 전체 회귀 테스트 필수)
