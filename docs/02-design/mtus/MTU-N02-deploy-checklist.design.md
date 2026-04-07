# MTU-N02: 프로덕션 배포 체크리스트 -- Design 문서

> **버전**: 1.0.0 | **작성일**: 2026-04-08 | **작성자**: PM Lead
> **Plan 참조**: docs/01-plan/mtus/MTU-N02-deploy-checklist.plan.md

---

## 1. 설계 결정

프로덕션 배포 체크리스트를 `docs/deployment/` 하위에 Markdown 문서로 작성.
기존 k8s manifests + docker-compose + build/deploy 스크립트가 이미 완비되어 있으므로
신규 인프라 코드 없이 검증 + 문서화만 수행.

## 2. 산출물

- `docs/deployment/production-checklist.md` -- 프로덕션 배포 체크리스트
- `CHANGELOG.md` 업데이트 (이미 진행 중)

## 3. Design Anchor

- 기존 k8s/ 디렉토리의 매니페스트 검증
- scripts/security-audit.sh 실행 결과 반영
- 시크릿 커밋 여부 git 검증

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 최초 작성 | PM Lead |
