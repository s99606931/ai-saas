# PRD: MTU-N39 Sealed Secrets GitOps 시크릿 관리

> **버전**: 1.0.0 | **작성일**: 2026-04-09

---

## WHY

현재 k3s 클러스터의 시크릿이 kubectl create secret 수동 명령으로 관리되어 GitOps 원칙에 위배.
Sealed Secrets를 도입하여 암호화된 SealedSecret을 Git에 안전하게 저장하고, Flux GitOps로 자동 배포.
CSAP D-09(암호화) 준수 및 감리 증적 자동화.

## WHO

- DevOps 엔지니어: 시크릿 안전한 Git 저장 및 자동 배포
- 보안 담당자: 시크릿 관리 감사 추적
- 감리관: CSAP D-09 암호화 증적

## SUCCESS

| ID | 기준 |
|----|------|
| SC-N39.1 | SealedSecret CRD 설치 및 동작 확인 |
| SC-N39.2 | kubeseal로 시크릿 암호화 -> Git 저장 가능 |
| SC-N39.3 | Flux와 연동하여 자동 배포 확인 |
| SC-N39.4 | 키 로테이션 절차 문서화 |
| SC-N39.5 | CVE-2026-22728 대응 (namespace 스코프 강제) |

## SCOPE

### In Scope
- Sealed Secrets 컨트롤러 Helm 설치
- kubeseal CLI 설치 가이드
- Flux 연동 SealedSecret 자동 배포
- 키 로테이션 절차
- CVE-2026-22728 보안 패치 확인

### Out of Scope
- External Secrets Operator (ESO) -- 폐쇄망에서 외부 시크릿 저장소 없음
- HashiCorp Vault (별도 인프라 필요)
