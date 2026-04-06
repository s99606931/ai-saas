# OSCAL 검증 가이드

> **문서 ID**: CSAP-OSCAL-VALIDATION
> **버전**: 1.0.0 | **일자**: 2026-04-06 | **작성자**: PM Agent
> **Plan SC**: FR-CSAP3.2 | **Design Ref**: MTU-CSAP3 Design 3.1
> **참조**: NIST OSCAL v1.1.3, usnistgov/oscal-cli

---

## 1. 개요

이 문서는 공공기관 SaaS 프레임워크의 CSAP 79항목을 OSCAL(Open Security Controls Assessment Language) 형식으로 정의한 `component-definition.json` 파일의 검증 방법을 안내합니다.

### 1.1 OSCAL이란?

OSCAL은 미국 NIST(National Institute of Standards and Technology)가 개발한 보안 통제 평가 표준 언어입니다. 보안 통제항목을 기계 판독 가능한 형식(JSON, XML, YAML)으로 정의하여 자동 검증 및 도구 연동을 가능하게 합니다.

### 1.2 적용 목적

| 목적 | 설명 |
|------|------|
| 기계 판독 | CSAP 79항목을 JSON 형식으로 자동 파싱 가능 |
| 자동 검증 | oscal-cli로 문서 구조 유효성 자동 검증 |
| 국제 표준 | NIST 국제 표준 준수로 글로벌 호환성 확보 |
| 도구 연동 | OSCAL 생태계 도구(Lula, Trestle 등)와 연동 |

---

## 2. oscal-cli 설치

### 2.1 사전 요구사항

- Java 11+ (OpenJDK 또는 Oracle JDK)
- 인터넷 접속 (최초 설치 시)

### 2.2 설치 방법

#### 방법 1: GitHub 릴리스에서 직접 다운로드

```bash
# 최신 릴리스 다운로드 (v2.x)
# https://github.com/usnistgov/oscal-cli/releases 에서 최신 버전 확인
OSCAL_CLI_VERSION="2.3.0"
curl -L -o oscal-cli.zip \
  "https://github.com/usnistgov/oscal-cli/releases/download/v${OSCAL_CLI_VERSION}/oscal-cli-${OSCAL_CLI_VERSION}-oscal-cli.zip"

# 압축 해제
unzip oscal-cli.zip -d oscal-cli

# PATH 등록
export PATH="$PATH:$(pwd)/oscal-cli/bin"

# 설치 확인
oscal-cli --version
```

#### 방법 2: 소스 빌드

```bash
# 저장소 클론
git clone --recurse-submodules https://github.com/usnistgov/oscal-cli.git
cd oscal-cli

# 빌드 (Gradle)
./gradlew installDist

# PATH 등록
export PATH="$PATH:$(pwd)/build/install/oscal-cli/bin"
```

### 2.3 설치 검증

```bash
# 버전 확인
oscal-cli --version

# 도움말 확인
oscal-cli validate --help
```

---

## 3. OSCAL 파일 검증

### 3.1 기본 검증

```bash
# component-definition.json 검증
oscal-cli validate \
  docs/framework/02-csap/oscal/component-definition.json
```

예상 출력:
```
Validating 'docs/framework/02-csap/oscal/component-definition.json' as component-definition.
Validation passed for 'docs/framework/02-csap/oscal/component-definition.json'.
```

### 3.2 JSON 구문 검증 (oscal-cli 미설치 시)

```bash
# jq를 이용한 JSON 구문 검증
jq empty docs/framework/02-csap/oscal/component-definition.json
echo $?  # 0이면 유효

# JSON 포맷 확인 및 예쁘게 출력
jq . docs/framework/02-csap/oscal/component-definition.json | head -20
```

### 3.3 79항목 전수 확인

```bash
# 매핑된 통제항목 수 확인
jq '[.["component-definition"].components[].["control-implementations"][]?.["implemented-requirements"][]?] | length' \
  docs/framework/02-csap/oscal/component-definition.json

# 예상 출력: 79

# 각 통제항목 ID 목록 추출
jq -r '[.["component-definition"].components[].["control-implementations"][]?.["implemented-requirements"][]?.["control-id"]] | .[]' \
  docs/framework/02-csap/oscal/component-definition.json | sort
```

### 3.4 구현 상태별 통계

```bash
# 구현 상태별 카운트
jq '[.["component-definition"].components[].["control-implementations"][]?.["implemented-requirements"][]?.props[]? | select(.name == "implementation-status") | .value] | group_by(.) | map({key: .[0], count: length}) | from_entries' \
  docs/framework/02-csap/oscal/component-definition.json
```

예상 출력:
```json
{
  "implemented": 38,
  "template": 10,
  "guide": 17,
  "organizational": 2,
  "not-applicable": 1
}
```

---

## 4. 자동 검증 스크립트

프로젝트에 포함된 `scripts/oscal-validate.sh`를 사용하여 자동 검증을 실행할 수 있습니다.

```bash
# 실행 권한 부여
chmod +x scripts/oscal-validate.sh

# 실행
./scripts/oscal-validate.sh
```

---

## 5. CI/CD 연동

### 5.1 Gitea Actions 통합

```yaml
# .gitea/workflows/oscal-validate.yml 예시
name: OSCAL 검증

on:
  push:
    paths:
      - 'docs/framework/02-csap/oscal/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: JSON 구문 검증
        run: |
          jq empty docs/framework/02-csap/oscal/component-definition.json

      - name: 79항목 전수 확인
        run: |
          COUNT=$(jq '[.["component-definition"].components[].["control-implementations"][]?.["implemented-requirements"][]?] | length' docs/framework/02-csap/oscal/component-definition.json)
          echo "매핑된 통제항목: $COUNT"
          if [ "$COUNT" -lt 79 ]; then
            echo "ERROR: 79항목 미달 ($COUNT)"
            exit 1
          fi
```

---

## 6. 문제 해결

### 6.1 일반적인 검증 오류

| 오류 | 원인 | 해결 방법 |
|------|------|---------|
| `Invalid JSON` | JSON 구문 오류 | `jq .` 으로 구문 확인 |
| `Missing required property: uuid` | 필수 필드 누락 | UUID 생성하여 추가 |
| `Unknown property` | 오타 또는 미지원 필드 | OSCAL 스키마 참조하여 수정 |
| `oscal-version mismatch` | OSCAL 버전 불일치 | `oscal-version` 필드 확인 |

### 6.2 UUID 생성

```bash
# Linux/macOS UUID 생성
uuidgen | tr '[:upper:]' '[:lower:]'

# Python UUID 생성
python3 -c "import uuid; print(uuid.uuid4())"
```

---

## 7. 참조 문서

- [NIST OSCAL 공식 문서](https://pages.nist.gov/OSCAL/)
- [OSCAL Component Definition v1.1.3 JSON Reference](https://pages.nist.gov/OSCAL-Reference/models/v1.1.3/component-definition/json-reference/)
- [oscal-cli GitHub](https://github.com/usnistgov/oscal-cli)
- [OSCAL Component Definition 개념](https://pages.nist.gov/OSCAL/learn/concepts/layer/implementation/component-definition/)

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 최초 작성 | PM Agent |
