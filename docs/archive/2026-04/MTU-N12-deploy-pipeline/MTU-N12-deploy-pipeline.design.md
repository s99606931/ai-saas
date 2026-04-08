# MTU-N12: Deploy 파이프라인 완성 Design

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N12 |
| Phase | Phase 3 Infrastructure |
| 버전 | 1.0.0 |
| 상태 | Approved |
| 작성일 | 2026-04-08 |
| 작성자 | PM Lead Agent (Claude Code) |
| 관련 Plan | docs/01-plan/mtus/MTU-N12-deploy-pipeline.plan.md |

---

## 1. deploy.yml 수정 설계

### 1.1 주요 변경사항

| 변경 | 기존 | 변경 후 |
|------|------|---------|
| runner | `runs-on: ubuntu-latest` | `runs-on: self-hosted` |
| registry push | 주석 처리 | 활성화 (Harbor 인증) |
| Harbor 인증 | 없음 | `docker login` + secrets |
| REGISTRY 환경변수 | `localhost:5000` | `localhost:8080` (Harbor) |

### 1.2 Harbor 인증 flow

```
1. docker login $REGISTRY -u $HARBOR_USERNAME -p $HARBOR_PASSWORD
2. docker build + tag
3. docker push $REGISTRY/$IMAGE_PREFIX/$SERVICE:$VERSION
4. helm upgrade --set global.imageRegistry=$REGISTRY
```

### 1.3 Gitea Secrets 필요 항목

| Secret 이름 | 설명 |
|------------|------|
| HARBOR_USERNAME | Harbor admin 사용자명 |
| HARBOR_PASSWORD | Harbor admin 비밀번호 |
| KUBECONFIG | k3s kubeconfig (base64) |

---

## 2. ci.yml 수정 설계

### 2.1 변경사항

- `runs-on` 에 `self-hosted` 옵션 추가
- 기존 `ubuntu-latest` 유지하되 `self-hosted` 라벨 병기
- services 블록은 self-hosted runner에서 Docker 직접 실행으로 전환

---

## 3. 파이프라인 전체 흐름

```
git push (stg/main)
  |
  v
Gitea Actions 트리거
  |
  v
Act Runner (self-hosted) 실행
  |
  +-> CI Job: lint + typecheck + build + test
  |
  +-> Build Job: Docker 이미지 빌드 (18개)
  |     +-> docker login Harbor
  |     +-> docker push Harbor
  |
  +-> Deploy Job: helm upgrade (k3s)
  |     +-> kubeconfig 설정
  |     +-> helm upgrade --install
  |
  +-> Notification Job: 배포 결과 로깅
```
