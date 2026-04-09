# Sealed Secrets + External Secrets Operator 역할 분리

> Design Ref: MTU-N66.design.md §2
> Plan SC: FR-N66.5

## 역할 매트릭스

| 시점 | 도구 | 용도 | 장점 |
|------|------|------|------|
| 배포 시점 | Sealed Secrets | Git에 암호화된 시크릿 저장 | GitOps 호환, Git 기록 |
| 런타임 | External Secrets Operator | 시크릿 자동 동기화/회전 | 중앙 관리, 자동 갱신 |

## 시크릿 흐름

```
1. 개발자가 시크릿 값 생성
2. kubeseal로 SealedSecret 암호화 → Git 커밋
3. Flux가 SealedSecret 배포 → saas-secrets 네임스페이스
4. ESO SecretStore가 saas-secrets 참조
5. ESO ExternalSecret이 saas 네임스페이스에 Secret 동기화
6. 1시간마다 자동 동기화 (refreshInterval: 1h)
```

## 운영 가이드

### 시크릿 추가 절차
1. `kubectl create secret generic {name} -n saas-secrets --from-literal=KEY=VALUE`
2. `kubeseal < secret.yaml > sealed-secret.yaml`
3. Git 커밋 + Flux 배포
4. ExternalSecret 리소스 추가 (data 섹션에 새 키 참조)

### 시크릿 회전 절차
1. saas-secrets 네임스페이스의 소스 Secret 값 업데이트
2. ESO가 1시간 이내 자동 동기화
3. Pod 재시작 필요 시: `kubectl rollout restart deployment/{name} -n saas`

### 미래 마이그레이션
온프레미스 Vault 도입 시:
1. SecretStore provider를 `kubernetes` → `vault`로 변경
2. ExternalSecret remoteRef 경로를 Vault 경로로 업데이트
3. 서비스 코드 변경 불필요 (동일 Secret 이름 유지)
