// @public-saas/cidr — CIDR / IP Range 유틸리티
// Design Ref: SVC-CIDR-R54.design.md
// Plan: SVC-CIDR-R54.plan.md

export { parseIpv4, parseIpv6, detectFamily, type IpFamily } from './parse.js';
export {
  parseCidr,
  matchCidr,
  IpRangeMatcher,
  isIpInRange,
  type ParsedCidr,
} from './cidr.js';
