// Design Ref: MTU-ECO3 Design 2.1
// Plan SC: FR-ECO3.1

/**
 * 전자결재 플러그인 ServiceManifest
 * 공공기관 전자결재 업무를 위한 기안/결재/조회 기능 제공
 */
export const manifest = {
  id: 'electronic-approval',
  name: '전자결재',
  description: '공공기관 전자결재 플러그인 (기안/결재선/승인/반려/보류)',
  version: '1.0.0',
  port: 3020,
  routes: {
    prefix: '/api/v1',
    endpoints: [
      'POST   /drafts',
      'GET    /drafts',
      'GET    /drafts/:id',
      'PUT    /drafts/:id',
      'DELETE /drafts/:id',
      'POST   /drafts/:id/lines',
      'POST   /drafts/:id/approve',
      'POST   /drafts/:id/reject',
      'POST   /drafts/:id/hold',
      'GET    /documents',
    ],
  },
  permissions: [
    'draft:create',
    'draft:read',
    'draft:update',
    'draft:delete',
    'approval:process',
    'document:read',
  ],
} as const;
