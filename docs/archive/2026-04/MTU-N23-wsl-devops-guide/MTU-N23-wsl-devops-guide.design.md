# MTU-N23: WSL DevOps 완전 가이드 문서 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-08 | **작성자**: PM Lead
> **Plan 참조**: docs/01-plan/mtus/MTU-N23-wsl-devops-guide.plan.md

---

## 1. 문서 아키텍처

### 3개 문서 체계

```
docs/08-infra/
  +-- wsl-devops-complete-guide.md    (메인 가이드, 단계별 상세)
  +-- wsl-quickstart.md              (빠른 시작, 5분 요약)
  +-- wsl-troubleshooting.md         (트러블슈팅, 문제별 해결)
```

---

## 2. 메인 가이드 구조 (wsl-devops-complete-guide.md)

### 목차

```
1. 개요
   1.1 이 가이드의 목적
   1.2 전체 아키텍처 개요
   1.3 CSAP/N2SF 컴플라이언스 매핑

2. 사전 요건
   2.1 Windows 요구사항
   2.2 WSL2 설치 및 설정
   2.3 Docker Desktop/Engine 설치
   2.4 시스템 자원 권장 사항

3. k3s 클러스터 구축
   3.1 k3s 설치
   3.2 kubectl 설정
   3.3 클러스터 검증
   3.4 CSAP D-11 가상화 보안 연계

4. Gitea (Git 서버 + CI/CD)
   4.1 Docker Compose 기동
   4.2 관리자 계정 설정
   4.3 저장소 생성
   4.4 Actions 활성화 및 Runner 등록
   4.5 CSAP D-12 개발보안 연계

5. Harbor (컨테이너 레지스트리)
   5.1 Harbor 설치
   5.2 프로젝트 생성
   5.3 k3s 레지스트리 미러 설정
   5.4 이미지 빌드/Push/Pull 테스트
   5.5 CSAP D-11-04 이미지 스캔 연계

6. Flux v2 (GitOps)
   6.1 Flux CLI 설치
   6.2 클러스터 부트스트랩
   6.3 Gitea 연동
   6.4 자동 배포 테스트

7. Prometheus + Grafana (모니터링)
   7.1 kube-prometheus-stack 배포
   7.2 Grafana 대시보드 접근
   7.3 알림 규칙 설정
   7.4 CSAP D-06 감사 로깅 연계

8. CI/CD 파이프라인 전체 흐름
   8.1 코드 Push → 빌드 → 배포 시나리오
   8.2 롤백 시나리오
   8.3 보안 스캔 통합

9. 운영 가이드
   9.1 서비스 시작/중지 명령어
   9.2 백업/복구
   9.3 모니터링 및 알림
   9.4 로그 확인
```

---

## 3. 빠른 시작 가이드 구조 (wsl-quickstart.md)

```
1. 원클릭 설치
   ./scripts/setup-wsl2-all.sh

2. 상태 확인
   ./scripts/setup-wsl2-all.sh --status

3. 접근 URL
   - Gitea: http://localhost:3001
   - Harbor: http://localhost:8080
   - Grafana: http://localhost:30302

4. 첫 번째 배포
   git push → Actions → Harbor → k3s
```

---

## 4. 트러블슈팅 가이드 구조 (wsl-troubleshooting.md)

```
WSL2 특유 이슈:
  - WSL2 네트워크 리셋 후 k3s 불통
  - WSL2 메모리 제한 (.wslconfig)
  - systemd 미지원 환경 대응
  - localhost vs host.docker.internal
  - Windows 방화벽 차단
  - WSL2 디스크 공간 회수
  - DNS 해석 실패
  - Docker Desktop vs Docker Engine 선택
  - k3s 인증서 만료
  - 포트 충돌 해결
```

---

## 5. 문서 품질 기준

| 기준 | 요구 사항 |
|------|----------|
| 언어 | 한국어 전용, 공공기관 표준 용어 |
| 명령어 | 모든 명령어에 예상 출력 포함 |
| 스크린샷 | 불필요 (CLI 기반, 출력 예시로 대체) |
| 버전 명시 | 모든 도구의 검증된 버전 명시 |
| CSAP 연계 | 각 섹션에 관련 CSAP 항목 번호 표기 |

---

## 6. Design Anchor

| 항목 | 참조 |
|------|------|
| Plan | docs/01-plan/mtus/MTU-N23-wsl-devops-guide.plan.md |
| MTU-N21 | 실제 구축 경험 기반 |
| MTU-N22 | 테스트 결과 기반 트러블슈팅 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 최초 작성 | PM Lead |
