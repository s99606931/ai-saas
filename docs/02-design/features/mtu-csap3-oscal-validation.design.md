# MTU-CSAP3 Design: OSCAL 검증 준비

> **버전**: 1.0.0 | **일자**: 2026-04-06 | **작성자**: PM Agent
> **Plan 참조**: docs/01-plan/features/mtu-csap3-oscal-validation.plan.md
> **아키텍처**: Option B — Pragmatic Balance

---

## Design Anchor

| 항목 | 결정 |
|------|------|
| OSCAL 버전 | v1.1.3 (NIST 최신 안정 릴리스) |
| 모델 유형 | Component Definition (컴포넌트 정의) |
| 파일 형식 | JSON (oscal-cli 기본 검증 대상) |
| 검증 도구 | oscal-cli (usnistgov/oscal-cli) |
| ID 매핑 | CSAP-DXX-YY → OSCAL control.id 직접 매핑 |

---

## 1. 아키텍처 개요

```
checklist-master.md (79항목)
    │
    ▼ [매핑 변환]
component-definition.json (OSCAL v1.1.3)
    │
    ├── metadata (문서 메타데이터)
    ├── components[] (플랫폼 구성 요소)
    │     ├── type: "software"
    │     ├── title: "공공기관 SaaS 프레임워크"
    │     └── control-implementations[]
    │           ├── source: "CSAP 표준등급"
    │           └── implemented-requirements[]
    │                 ├── control-id: "CSAP-D01-01"
    │                 ├── description: "정보보호 정책 수립"
    │                 └── statements[]
    │
    ▼ [검증]
oscal-cli validate component-definition.json
    │
    └── 결과: PASS / FAIL + 오류 상세
```

---

## 2. OSCAL Component Definition 구조

### 2.1 최상위 구조

```json
{
  "component-definition": {
    "uuid": "고유 UUID",
    "metadata": {
      "title": "공공기관 SaaS 프레임워크 CSAP 컴포넌트 정의",
      "version": "1.0.0",
      "oscal-version": "1.1.3",
      "published": "2026-04-06T00:00:00Z",
      "last-modified": "2026-04-06T00:00:00Z",
      "roles": [...],
      "parties": [...]
    },
    "components": [
      {
        "uuid": "컴포넌트 UUID",
        "type": "software",
        "title": "공공기관 SaaS 프레임워크",
        "description": "CSAP 표준등급 79항목 준수 SaaS 플랫폼",
        "control-implementations": [...]
      }
    ]
  }
}
```

### 2.2 Control Implementation 구조

13개 분야별로 control-implementations 배열 구성:
- D01 정보보호 정책 (4항목)
- D02 조직 보안 (3항목)
- D03 인적 보안 (4항목)
- D04 자산 관리 (5항목)
- D05 공급망 보안 (4항목)
- D06 침해사고 관리 (5항목)
- D07 재해 복구 (4항목)
- D08 접근 통제 (12항목)
- D09 암호화 (4항목)
- D10 네트워크 보안 (8항목)
- D11 가상화 보안 (8항목)
- D12 시스템 개발 보안 (10항목)
- D13 공공기관 추가 보호조치 (8항목)

### 2.3 implemented-requirement 예시

```json
{
  "uuid": "요건별 UUID",
  "control-id": "CSAP-D08-01",
  "description": "사용자 계정 관리: 사용자 등록·변경·삭제 절차 수립",
  "remarks": "RBAC 기반 접근 통제 구현. platform/services/auth-service/",
  "props": [
    {
      "name": "implementation-status",
      "value": "implemented"
    }
  ],
  "responsible-roles": [
    {
      "role-id": "security-officer"
    }
  ]
}
```

---

## 3. 검증 스크립트 설계

### 3.1 oscal-validate.sh

```bash
#!/bin/bash
# Plan SC: FR-CSAP3.3
# Design Ref: MTU-CSAP3 §3.1

OSCAL_FILE="docs/framework/02-csap/oscal/component-definition.json"

# 1. JSON 구문 검증
jq empty "$OSCAL_FILE" || exit 1

# 2. oscal-cli 검증 (설치되어 있는 경우)
if command -v oscal-cli &> /dev/null; then
  oscal-cli validate "$OSCAL_FILE"
else
  echo "[INFO] oscal-cli 미설치. JSON 구문 검증만 수행."
  echo "[INFO] 설치: docs/framework/02-csap/oscal/validation-guide.md 참조"
fi

# 3. 79항목 전수 확인
CONTROL_COUNT=$(jq '[.["component-definition"].components[].["control-implementations"][]?.["implemented-requirements"][]?] | length' "$OSCAL_FILE")
echo "매핑된 통제항목 수: $CONTROL_COUNT / 79"
```

---

## 4. Session Guide

### 구현 순서

1. `docs/framework/02-csap/oscal/` 디렉토리 생성
2. `component-definition.json` 작성 (79항목 전수 매핑)
3. `csap-oscal-mapping.md` ID 매핑 테이블 작성
4. `validation-guide.md` oscal-cli 설치/실행 가이드 작성
5. `scripts/oscal-validate.sh` 검증 스크립트 작성
6. JSON 구문 검증 (jq) 실행

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 최초 작성 | PM Agent |
