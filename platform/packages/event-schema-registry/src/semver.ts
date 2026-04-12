// Semantic Versioning 파싱/비교 (subset)
// Plan SC: FR-ESR.2

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

export function parse(version: string): SemVer {
  if (typeof version !== 'string') {
    throw new TypeError('semver must be a string');
  }
  const m = SEMVER_RE.exec(version);
  if (!m) {
    throw new Error(`Invalid semver: '${version}'`);
  }
  return {
    major: parseInt(m[1]!, 10),
    minor: parseInt(m[2]!, 10),
    patch: parseInt(m[3]!, 10),
  };
}

export function compare(a: string, b: string): -1 | 0 | 1 {
  const pa = parse(a);
  const pb = parse(b);
  if (pa.major !== pb.major) return pa.major < pb.major ? -1 : 1;
  if (pa.minor !== pb.minor) return pa.minor < pb.minor ? -1 : 1;
  if (pa.patch !== pb.patch) return pa.patch < pb.patch ? -1 : 1;
  return 0;
}

export function isMajorBump(oldV: string, newV: string): boolean {
  return parse(newV).major > parse(oldV).major;
}
