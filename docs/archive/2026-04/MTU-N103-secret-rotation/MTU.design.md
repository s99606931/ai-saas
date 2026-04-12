# MTU-N103: GitOps 시크릿 회전 -- Design

> **MTU ID**: MTU-N103
> **Plan 참조**: docs/01-plan/mtus/MTU-N103-secret-rotation.plan.md
> **작성일**: 2026-04-10

---

## Design Anchor

| 항목 | 내용 |
|------|------|
| 목표 | 시크릿 자동 교체 + 무중단 배포 + CSAP D-09 준수 |
| 제약 | Vault dev mode (로컬), 외부 KMS 사용 금지 |
| 검증 | 자동 교체 동작, 무중단 확인, 감사 로그 기록 |

## 아키텍처

```
[Vault] <-- 시크릿 저장 + 자동 회전 정책
   |
[SecretStore] -- ESO 연결
   |
[ExternalSecret] -- refreshInterval로 자동 동기화
   |
[Kubernetes Secret] -- Pod 자동 재시작 (annotations)
   |
[감사 로그] -- 교체 이벤트 기록
```

### 시크릿 교체 정책

| 시크릿 유형 | 교체 주기 | 방법 |
|-----------|----------|------|
| DB 비밀번호 | 30일 | Vault dynamic secret |
| API 키 | 90일 | Vault KV + rotation |
| TLS 인증서 | cert-manager 자동 | 30일 전 자동 갱신 |
| JWT 서명 키 | 90일 | Dual key rotation |
| MinIO 자격증명 | 60일 | Vault KV + ESO sync |

### Dual Secret 교체 패턴

```
1. Vault에서 새 시크릿 v2 생성
2. ESO가 v2를 Kubernetes Secret에 동기화
3. Pod annotation 변경 -> 롤링 업데이트
4. 구 시크릿 v1 유예 기간 (1시간)
5. v1 비활성화 + 감사 로그 기록
```

## 산출물

| # | 파일 | 설명 |
|---|------|------|
| 1 | infra/vault/install.yaml | Vault dev Helm values |
| 2 | infra/vault/secret-store.yaml | ESO SecretStore |
| 3 | infra/vault/rotation-policies.yaml | 교체 정책 |
| 4 | infra/vault/external-secrets/ | ExternalSecret 정의 |
| 5 | infra/vault/audit-webhook.yaml | 감사 이벤트 웹훅 |
| 6 | tests/e2e/test-secret-rotation.sh | E2E 테스트 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 설계 | PM Agent |
