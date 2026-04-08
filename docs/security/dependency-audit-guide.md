# 의존성 보안 감사 가이드

> Plan SC: FR-N20.3
> Design Ref: D-N20.3
> CSAP: D-12-04 취약점 점검 및 조치

| 항목 | 내용 |
|------|------|
| 버전 | 1.0.0 |
| 작성일 | 2026-04-08 |
| 도구 | pnpm audit |
| 대상 | 전체 모노레포 (pnpm workspace) |

---

## 1. 실행 방법

### 기본 감사 (HIGH 이상)

```bash
# HIGH 이상 취약점만 확인 (CI/CD 권장)
pnpm audit --audit-level=high

# 종료 코드:
# 0 = HIGH/CRITICAL 없음 (PASS)
# 1 = HIGH/CRITICAL 존재 (FAIL)
```

### 전체 감사 (모든 심각도)

```bash
# 모든 심각도 확인
pnpm audit
```

### JSON 리포트 생성

```bash
# 감리 증적용 JSON 리포트
mkdir -p reports/vulnerability
pnpm audit --json > reports/vulnerability/npm-audit-$(date +%Y%m%d).json
```

---

## 2. 현재 상태 (2026-04-08 기준)

| 심각도 | 건수 | 상세 |
|--------|------|------|
| CRITICAL | 0 | - |
| HIGH | 0 | bcrypt -> bcryptjs 마이그레이션 완료 (tar HIGH 4건 제거) |
| MODERATE | 2 | 개발 전용 의존성 (프로덕션 무영향) |
| LOW | 0 | - |

### 조치 이력

| 일자 | 취약점 | 패키지 | 조치 | CSAP |
|------|--------|--------|------|------|
| 2026-04-07 | tar HIGH 4건 | bcrypt -> bcryptjs | 대체 패키지 마이그레이션 | D-12-04 |

---

## 3. 취약점 발견 시 조치 절차

### 3.1 심각도 평가

```bash
# 취약점 상세 확인
pnpm audit

# 출력 예시:
# ┌─────────────────────────────┐
# │ high    │ Prototype Pollution │
# ├─────────────────────────────┤
# │ Package │ package-name        │
# │ Fix     │ 1.2.3               │
# └─────────────────────────────┘
```

### 3.2 영향 분석

1. **프로덕션 의존성인지 확인**
   ```bash
   # devDependencies에만 있으면 프로덕션 무영향
   grep "package-name" package.json
   ```

2. **실제 사용 코드 경로 확인**
   ```bash
   # 취약 함수가 실제 호출되는지 확인
   grep -r "vulnerableFunction" platform/
   ```

### 3.3 조치 방법

| 상황 | 조치 | 명령 |
|------|------|------|
| 패치 버전 존재 | 업데이트 | `pnpm update package-name` |
| 메이저 버전만 수정 | 호환성 테스트 후 업데이트 | `pnpm update package-name@latest` |
| 패치 없음 | 대체 패키지 검토 | `pnpm remove old && pnpm add alternative` |
| 개발 전용 | 리스크 수용 | 보고서에 사유 기록 |

### 3.4 조치 후 검증

```bash
# 1. 업데이트 후 재감사
pnpm audit --audit-level=high

# 2. 테스트 실행
pnpm test

# 3. 빌드 확인
pnpm build

# 4. CHANGELOG 기록
```

---

## 4. CI/CD 통합

### Gitea Actions 워크플로우

```yaml
# .gitea/workflows/ci.yml 내 추가
- name: Dependency Audit
  run: pnpm audit --audit-level=high
  # HIGH 이상 발견 시 CI 실패
```

### 정기 감사 스케줄

| 주기 | 대상 | 도구 | 기준 |
|------|------|------|------|
| 매 커밋 | 전체 의존성 | pnpm audit | HIGH 0건 |
| 매주 | 전체 의존성 | pnpm audit + Trivy FS | MEDIUM 이하 추적 |
| 매월 | 전체 의존성 | npm audit + Snyk (선택) | 보고서 생성 |

---

## 5. 예외 처리

### .pnpmauditrc (특정 취약점 무시)

```json
{
  "ignore": {
    "advisory-id-123": {
      "reason": "개발 전용 의존성, 프로덕션 미포함",
      "expires": "2026-07-01"
    }
  }
}
```

> **주의**: 예외 처리 시 반드시 사유와 만료일을 기록. CSAP D-12 감리 시 예외 사유 확인 대상.

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 초안 작성 | PM Lead Agent |
