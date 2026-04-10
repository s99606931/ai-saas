# MTU-N91: Semgrep 코드 품질 게이트 + 기술 부채 측정 — Design

> **MTU ID**: MTU-N91
> **Plan 참조**: docs/01-plan/mtus/MTU-N91-semgrep-quality-gate.plan.md
> **작성일**: 2026-04-10

---

## Design Anchor

| 항목 | 내용 |
|------|------|
| 목표 | Semgrep SAST 자동화 + 공공기관 규칙 + 기술 부채 측정 |
| 제약 | 에어갭 호환 (로컬 규칙 사용), SonarQube 대비 경량 |
| 기술 스택 | Semgrep OSS, Bash, Gitea Actions |

## 1. 커스텀 Semgrep 규칙 (15개)

### CSAP 보안 규칙
1. `hardcoded-secret` — 하드코딩 시크릿 탐지 (D-09)
2. `sql-injection` — SQL 직접 결합 탐지 (D-12)
3. `xss-raw-html` — 새니타이제이션 없는 HTML 출력 (D-12)
4. `missing-auth-check` — API 엔드포인트 인증 누락 (D-08)
5. `plaintext-password` — 평문 비밀번호 저장 (D-09)
6. `missing-audit-log` — 민감 작업 감사 로그 누락 (D-06)
7. `n2sf-data-leak` — C/S등급 데이터 외부 전송 (N2SF N-05)

### 코드 품질 규칙
8. `function-too-long` — 80줄 초과 함수 탐지
9. `deep-nesting` — 4단계 초과 중첩
10. `todo-stale` — 3개월 초과 TODO
11. `unused-import` — 미사용 import
12. `error-swallow` — 에러 무시 패턴

### 공공기관 특화 규칙
13. `pii-exposure` — PII 로그 출력 탐지
14. `encryption-required` — 암호화 없는 PII 저장
15. `force-push-attempt` — force push 관련 코드 패턴

## 2. 기술 부채 계산 공식

```
기술 부채 점수 = (함수 복잡도 > 10 개수 * 3)
              + (80줄 초과 함수 * 2)
              + (미사용 코드 * 1)
              + (TODO/FIXME 3개월+ * 1)
              + (Semgrep 경고 * 2)
등급: A(0-10), B(11-30), C(31-60), D(61-100), E(100+)
```

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 설계 | PM Agent |
