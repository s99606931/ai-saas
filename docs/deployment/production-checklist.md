# 프로덕션 배포 체크리스트

> **프로젝트**: 공공기관 SaaS 프레임워크 v1.0.0
> **작성일**: 2026-04-08 | **CSAP**: D-09, D-10, D-11, D-12
> **Design Ref**: MTU-N02

---

## 1. 사전 조건

- [ ] Node.js 22+ 설치
- [ ] pnpm 9+ 설치
- [ ] Docker 24+ 설치
- [ ] kubectl 설치 + k3s 클러스터 연결 확인
- [ ] 도메인 및 TLS 인증서 준비 (CSAP D-09)

## 2. 코드 품질 검증

- [x] 전체 테스트 751개 ALL PASS (51 파일)
  - 단위 테스트: 596개 (42 파일)
  - E2E 통합 테스트: 155개 (7 파일)
- [x] TypeScript 타입 체크 PASS (17개 서비스)
- [x] Dead code 0건
- [x] CSAP 79항목 100% 커버리지
- [x] N2SF 6개 영역 100% 커버리지
- [x] Q-Gate G1~G7 전체 PASS

## 3. 보안 검증 (CSAP D-08, D-09, D-12)

- [x] `.env` 파일 git 미포함
- [x] `secrets.*` 파일 git 미포함
- [x] 하드코딩된 시크릿 0건
- [x] `.gitignore`에 시크릿 패턴 등록
- [x] pre-commit hook 활성화 (시크릿 차단)
- [x] pnpm audit: HIGH 취약점 0건
- [x] bcrypt -> bcryptjs 마이그레이션 완료 (tar HIGH 4건 해결)
- [x] 모든 API 엔드포인트 RBAC 검사 (D-08-05)
- [x] 모든 입력 Zod 스키마 검증 (D-12)
- [x] JWT 접근 15분 / 갱신 7일 만료 설정 (D-08)
- [x] 감사 로그 append-only + SHA-256 무결성 (D-06)

## 4. 컨테이너 빌드 (CSAP D-11)

```bash
# 전체 빌드 (16개 서비스 + 1개 포털)
./scripts/build-all.sh

# 또는 병렬 빌드
./scripts/build-all.sh --parallel
```

- [x] 16개 서비스 Dockerfile 존재
- [x] 포털 Dockerfile 존재
- [x] 컨테이너 non-root 실행 (runAsUser: 1001)
- [x] readOnlyRootFilesystem: true
- [x] capabilities.drop: ["ALL"]

## 5. k8s 배포 (CSAP D-10, D-11)

```bash
# 전체 배포
./scripts/deploy-k8s.sh

# 상태 확인
./scripts/deploy-k8s.sh --status
```

### 배포 전 필수 작업

1. **Secret 생성** (CSAP D-09)
   ```bash
   cp k8s/config/secrets.example.yaml k8s/config/secrets.yaml
   # base64로 실제 값 인코딩하여 교체
   ```

2. **네트워크 정책 확인** (CSAP D-10)
   - `k8s/config/network-policy.yaml` 적용
   - API 게이트웨이만 외부 진입점
   - 서비스 간 최소 권한 접근

3. **리소스 제한 확인**
   - 모든 서비스: CPU 100m~500m, 메모리 128Mi~256Mi
   - 인프라: PostgreSQL, Redis, MinIO 별도 설정

### 배포 순서

| 단계 | 대상 | 매니페스트 |
|------|------|-----------|
| 1 | Namespace | `k8s/config/namespace.yaml` |
| 2 | Secrets | `k8s/config/secrets.yaml` |
| 3 | ConfigMap | `k8s/config/configmap.yaml` |
| 4 | NetworkPolicy | `k8s/config/network-policy.yaml` |
| 5 | 인프라 | `k8s/infra/` (PostgreSQL, Redis, MinIO) |
| 6 | 마이크로서비스 | `k8s/services/microservices.yaml` (15종) |
| 7 | 포털 | `k8s/portal/portal.yaml` |

## 6. 배포 후 검증

- [ ] `kubectl get pods -n saas-platform` - 전 Pod Running 확인
- [ ] `kubectl get svc -n saas-platform` - 전 서비스 정상 확인
- [ ] API 게이트웨이 헬스체크: `curl http://<gateway>:3000/health`
- [ ] 다운스트림 헬스: `curl http://<gateway>:3000/health/services`
- [ ] 로그인 테스트: `curl -X POST http://<gateway>:3000/api/v1/auth/login`
- [ ] 감사 로그 확인: `kubectl logs -n saas-platform -l app=audit-service`

## 7. 모니터링 설정

- [ ] Prometheus 알림 규칙 22개 적용 (`k8s/monitoring/prometheus-alerts.yaml`)
- [ ] Grafana 대시보드 10개 패널 배포
- [ ] DB 백업 CronJob 활성화 (`k8s/infra/db-backup-cronjob.yaml`)

## 8. 롤백 절차

```bash
# 이전 버전으로 롤백
kubectl rollout undo deployment/<service-name> -n saas-platform

# 전체 삭제 (주의)
./scripts/deploy-k8s.sh --delete
```

---

## 서비스 포트 매핑

| 서비스 | 포트 | 비고 |
|--------|------|------|
| api-gateway | 3000 | 유일한 외부 진입점 |
| auth-service | 3001 | |
| user-service | 3002 | |
| tenant-service | 3003 | |
| menu-service | 3004 | |
| catalog-service | 3005 | |
| subscription-service | 3006 | |
| billing-service | 3007 | |
| crm-service | 3008 | |
| ai-service | 3009 | |
| notification-service | 3010 | |
| file-service | 3011 | |
| audit-service | 3012 | replicas: 3 (HA) |
| compliance-service | 3013 | |
| security-monitor | 3014 | |
| portal | 4000 | NodePort 30400 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 최초 작성 | PM Lead |
