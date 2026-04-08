# Cosign 이미지 서명 키 관리

<!-- Design Ref: MTU-N27 -->
<!-- Plan SC: FR-N27.1 -->

## 파일 목록

| 파일 | 설명 | 커밋 여부 |
|------|------|---------|
| cosign.pub | 공개키 (서명 검증용) | O (커밋 가능) |
| cosign.key | 개인키 (서명용) | X (절대 금지) |
| signing-config.json | 서명 설정 (tlog 비활성) | O (커밋 가능) |

## 키 관리 규칙

1. **cosign.key는 절대 git에 커밋하지 않습니다** (.gitignore에 등록)
2. 운영 환경에서는 Kubernetes Secret 또는 Vault에 보관합니다
3. 키 교체 주기: 최소 1년 (CSAP D-09 권장)

## 사용법

### 이미지 서명

```bash
COSIGN_PASSWORD="" cosign sign \
  --key cosign.key \
  --signing-config signing-config.json \
  --allow-insecure-registry \
  localhost:8080/public-saas/<이미지>:<태그>
```

### 이미지 검증

```bash
cosign verify \
  --key cosign.pub \
  --insecure-ignore-tlog \
  --allow-insecure-registry \
  localhost:8080/public-saas/<이미지>:<태그>
```

## CSAP 매핑

| 항목 | CSAP 통제 | 설명 |
|------|---------|------|
| 키 생성 | D-09-01 | 암호화 키 관리 |
| 이미지 서명 | D-05-03, D-12-08 | 공급망 보안, 무결성 검증 |
| 서명 검증 | D-08, D-12-08 | 접근 통제, 배포 전 검증 |
