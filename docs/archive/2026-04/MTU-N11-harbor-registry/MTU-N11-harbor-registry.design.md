# MTU-N11: Harbor 로컬 레지스트리 구성 Design

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N11 |
| Phase | Phase 3 Infrastructure |
| 버전 | 1.0.0 |
| 상태 | Approved |
| 작성일 | 2026-04-08 |
| 작성자 | PM Lead Agent (Claude Code) |
| 관련 Plan | docs/01-plan/mtus/MTU-N11-harbor-registry.plan.md |

---

## 1. 아키텍처 설계

### 1.1 Harbor 설치 방식

Harbor 공식 offline installer 사용 (Docker Compose 기반 자동 생성).

```
Harbor 구성요소:
  +-- nginx (reverse proxy, port 8080)
  +-- core (Harbor API)
  +-- portal (Harbor Web UI)
  +-- jobservice (비동기 작업)
  +-- registry (Docker Registry v2)
  +-- database (PostgreSQL)
  +-- redis (캐시)
  +-- trivy-adapter (이미지 스캔, 선택)
```

### 1.2 포트 할당

| 서비스 | 호스트 포트 | 용도 |
|--------|-----------|------|
| Harbor Web/API | 8080 | HTTP (개발 환경) |

### 1.3 k3s 연동

k3s의 `/etc/rancher/k3s/registries.yaml`에 Harbor를 insecure registry로 등록.

```yaml
mirrors:
  "localhost:8080":
    endpoint:
      - "http://localhost:8080"
configs:
  "localhost:8080":
    auth:
      username: admin
      password: <Harbor 비밀번호>
```

---

## 2. 설치 스크립트 설계

### 2.1 setup-harbor-wsl2.sh

```
실행 흐름:
1. 사전 요건 확인 (docker, docker-compose, openssl)
2. Harbor offline installer 다운로드 (v2.11+)
3. harbor.yml 설정:
   - hostname: localhost
   - http.port: 8080
   - https 비활성화
   - harbor_admin_password: 환경변수
   - data_volume: /data/harbor
4. install.sh 실행
5. Harbor 준비 대기 (health check)
6. public-saas 프로젝트 생성 (Harbor API)
7. Docker insecure-registry 설정 안내
8. k3s registries.yaml 설정
```

---

## 3. 보안 설계

- Harbor admin 비밀번호: 환경변수 관리
- HTTP 모드: 개발 환경 전용 (운영 환경에서는 TLS 필수)
- 이미지 스캔: Trivy 연동 (선택 사항)
- CSAP D-11-04: 이미지 취약점 스캔 지원
