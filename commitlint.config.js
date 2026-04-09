// =============================================================================
// Commitlint 설정 -- Conventional Commits 검증
// Design Ref: MTU-N42 Design
// Plan SC: FR-N42.4
//
// 커밋 메시지 형식:
//   type(scope): description
//   예: feat(csap): FR-2.1 표준등급 체크리스트 추가
//       fix(n2sf): 격리 영역 C등급 오류 수정
// =============================================================================

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 타입 허용 목록
    'type-enum': [
      2,
      'always',
      [
        'feat', // 신규 기능
        'fix', // 버그 수정
        'docs', // 문서
        'style', // 코드 스타일 (동작 변경 없음)
        'refactor', // 리팩토링
        'perf', // 성능 개선
        'test', // 테스트
        'ci', // CI/CD
        'chore', // 빌드/도구
        'revert', // 되돌리기
        'security', // 보안 수정 (CSAP/N2SF 관련)
      ],
    ],
    // scope: 소문자 + 하이픈 허용
    'scope-case': [2, 'always', 'lower-case'],
    // subject: 최소 5자
    'subject-min-length': [2, 'always', 5],
    // subject: 최대 100자
    'subject-max-length': [2, 'always', 100],
    // body: 최대 줄 길이 200자
    'body-max-line-length': [1, 'always', 200],
  },
};
