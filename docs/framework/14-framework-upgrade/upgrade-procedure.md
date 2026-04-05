# 프레임워크 업그레이드 절차

> MTU-E3 | FR-8.6 | 적용 기준일: 2026-04-05
> 참조: MTU-A7 (N2SF 모니터링, 30일 SLA), MTU-I2 (Gitea CI/CD)

---

## 1. 개요

CSAP/N2SF/ISMS-P 규정 변경 탐지부터 프레임워크 업데이트, 검증, 배포, 롤백까지의 전체 절차입니다.
MTU-A7 모니터링 프로세스와 연동하여 30일 SLA를 준수합니다.

---

## 2. 업그레이드 파이프라인

```
[MTU-A7: 규정 변경 탐지]
    │
    ▼
[Phase 1: 영향 분석] (D+5)
    ├── 영향 없음 → 로그 기록 후 종료
    └── 영향 있음 → 변경 분류 (MAJOR/MINOR/PATCH)
        │
        ▼
[Phase 2: 설계/구현] (D+20)
    ├── PATCH → 즉시 수정 → PR
    ├── MINOR → Plan → Do → PR
    └── MAJOR → CTO 승인 → Plan → Design → Do → PR
        │
        ▼
[Phase 3: 검증] (D+25)
    ├── Reviewer 코드 검토
    ├── Auditor G6 검증 (CSAP 영향 항목 전수)
    └── Tester 회귀 테스트
        │
        ▼
[Phase 4: 배포] (D+28)
    ├── CHANGELOG 업데이트
    ├── Git 태그 생성
    └── 단계적 배포 (카나리)
        │
        ▼
[Phase 5: 확인] (D+30)
    ├── audit.jsonl 업데이트 이벤트 기록
    └── 사용 기관 알림 (MAJOR인 경우)
```

---

## 3. 상세 절차

### 3.1 Phase 1: 영향 분석

```yaml
# Gitea Issue 자동 생성 템플릿
name: 규정 변경 영향 분석
about: MTU-A7 규정 변경 탐지 시 자동 생성
labels: ["regulation-change", "priority-high"]
body:
  - type: input
    id: regulation-source
    attributes:
      label: 규정 출처
      placeholder: "국정원 N2SF v2.1 (2026-07-15)"
  - type: textarea
    id: change-summary
    attributes:
      label: 변경 요약
  - type: dropdown
    id: impact-level
    attributes:
      label: 영향 수준
      options:
        - MAJOR (하위 호환 불가)
        - MINOR (하위 호환)
        - PATCH (오류 수정)
        - NONE (영향 없음)
  - type: textarea
    id: affected-items
    attributes:
      label: 영향받는 항목
      placeholder: "CSAP-D08-03, N2SF-N01 등"
```

### 3.2 Phase 2: 설계/구현

**MAJOR 변경 시 필수 산출물**:
1. 영향 분석 보고서 (CTO 승인)
2. 변경 Plan 문서 (CLAUDE.md 3조 형식)
3. 변경 Design 문서 (3 옵션 평가)
4. 구현 (기존 문서 수정 + 신규 문서)

**MINOR 변경 시 산출물**:
1. 구현 (신규 문서 추가)
2. CHANGELOG 업데이트

### 3.3 Phase 3: 검증

```bash
# 업그레이드 검증 스크립트
#!/bin/bash
echo "=== 프레임워크 업그레이드 검증 ==="

# 1. 문서 무결성 (모든 산출물 존재 확인)
EXPECTED_FILES=73
ACTUAL_FILES=$(find docs/framework -name "*.md" | wc -l)
echo "[1] 산출물 파일: ${ACTUAL_FILES}/${EXPECTED_FILES}"

# 2. CSAP 79항목 전수 확인
CSAP_ITEMS=$(grep -c "CSAP-D" docs/framework/02-csap/standard-grade/checklist-master.md || echo 0)
echo "[2] CSAP 항목: ${CSAP_ITEMS}/79"

# 3. ISMS-P 101항목 전수 확인
ISMS_M=$(find docs/framework/07-isms-p/management-controls -name "*.md" | wc -l)
ISMS_P=$(find docs/framework/07-isms-p/protection-controls -name "*.md" | wc -l)
ISMS_I=$(find docs/framework/07-isms-p/privacy-controls -name "*.md" | wc -l)
echo "[3] ISMS-P 파일: 관리 ${ISMS_M}, 보호 ${ISMS_P}, 개인정보 ${ISMS_I}"

# 4. audit.jsonl 무결성
AUDIT_LINES=$(wc -l < .claude/audit.jsonl 2>/dev/null || echo 0)
echo "[4] 감사 로그 항목: ${AUDIT_LINES}"

echo "=== 검증 완료 ==="
```

### 3.4 Phase 4: 배포

```bash
# Git 태그 생성 및 배포
VERSION="v1.5.0"
PREV_TAG="v1.4.0"

# 1. 업그레이드 전 롤백 포인트 생성
git tag "${VERSION}-pre-upgrade" HEAD

# 2. CHANGELOG 업데이트 확인
grep -q "${VERSION}" CHANGELOG.md || echo "WARNING: CHANGELOG 미업데이트"

# 3. 태그 생성
git tag -a "${VERSION}" -m "프레임워크 ${VERSION} 릴리스"

# 4. 카나리 배포 (Flux GitOps 연동)
# MTU-I3 Flux 자동 동기화 트리거
```

---

## 4. 롤백 절차

### 4.1 롤백 조건

- Auditor Q-Gate G6 불통과
- 현장 서비스 오류 발생
- 기존 인증 영향 발견
- 사용 기관 긴급 보고

### 4.2 롤백 단계

```
[1] 서비스 긴급 알림 발송 (30분 이내)
    │
[2] Git 이전 태그로 복원
    │  git checkout vX.Y.Z-pre-upgrade
    │
[3] k3s 배포 롤백 (Flux GitOps)
    │  kubectl rollout undo deployment/app -n production
    │
[4] audit.jsonl 롤백 이벤트 기록
    │  {"action": "FRAMEWORK_ROLLBACK", "from": "vX.Y.Z", "to": "vX.Y.Z-1"}
    │
[5] Auditor 검증 재실행
    │
[6] 사후 원인 분석 보고서 (48시간 이내)
    │
[7] 팀 전체 공유 + 재발 방지 대책
```

### 4.3 롤백 완료 기준

| 기준 | 확인 방법 |
|------|---------|
| 서비스 정상화 | 헬스체크 통과 (HTTP 200) |
| Q-Gate 통과 | Auditor G6 재검증 |
| 증적 보존 | audit.jsonl 롤백 전후 항목 무결성 |
| 원인 분석 | 보고서 작성 및 팀 공유 완료 |

---

## 5. 공공기관 서비스 적용 절차

| 변경 수준 | 기관 통보 | 준비 기간 | 적용 방법 |
|---------|---------|---------|---------|
| PATCH | 자동 알림 | 즉시 | Flux 자동 동기화 |
| MINOR | 이메일 통보 | 1주일 | 기관 동의 후 적용 |
| MAJOR | 공문 발송 | 3개월 | 기관 협의 + 스테이징 검증 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — 업그레이드 5단계 파이프라인 + 롤백 절차 | Claude Code |
