// Design Ref: MTU-ECO3 Design 2.2
// Plan SC: FR-ECO3.5

export const manifest = {
  id: 'public-data-integration',
  name: '공공데이터 연동',
  description: '공공데이터포털(data.go.kr) API 연동 플러그인',
  version: '1.0.0',
  port: 3021,
  routes: {
    prefix: '/api/v1',
    endpoints: [
      'GET    /datasets',
      'GET    /datasets/:id',
      'GET    /datasets/:id/data',
      'POST   /datasets/transform',
    ],
  },
  permissions: [
    'dataset:search',
    'dataset:read',
    'dataset:transform',
  ],
} as const;
