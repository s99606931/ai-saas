// Node.js 글로벌 타입 선언 (플러그인 빌드 시 @types/node 미설치 환경 대비)
declare const process: {
  stdout: { write: (str: string) => boolean };
  stderr: { write: (str: string) => boolean };
  env: Record<string, string | undefined>;
};
