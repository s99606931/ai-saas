// 메뉴 서비스 라우트
// Design Ref: DESIGN-MTU-P05
// Plan SC: FR-P05.1~FR-P05.5

import type { FastifyInstance } from 'fastify';
import {
  getMenuTreeHandler,
  getFilteredMenuHandler,
  createMenuHandler,
  updateMenuHandler,
  deleteMenuHandler,
  reorderMenuHandler,
} from './handlers/menu.handler.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/menu/tree', getMenuTreeHandler);
  app.get('/menu/filtered', getFilteredMenuHandler);
  app.post('/menu', createMenuHandler);
  app.put('/menu/:id', updateMenuHandler);
  app.delete('/menu/:id', deleteMenuHandler);
  app.put('/menu/:id/order', reorderMenuHandler);
}
