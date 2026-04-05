// CRM 서비스 라우트
// Design Ref: DESIGN-MTU-P09
// Plan SC: FR-P09.1~FR-P09.5

import type { FastifyInstance } from 'fastify';
import {
  listCustomersHandler,
  getCustomerHandler,
  createCustomerHandler,
  updateCustomerHandler,
  listContactsHandler,
  createContactHandler,
  listContractsHandler,
  createContractHandler,
  updateContractHandler,
  pipelineHandler,
} from './handlers/crm.handler.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/crm/customers', listCustomersHandler);
  app.get('/crm/customers/:id', getCustomerHandler);
  app.post('/crm/customers', createCustomerHandler);
  app.put('/crm/customers/:id', updateCustomerHandler);
  app.get('/crm/customers/:id/contacts', listContactsHandler);
  app.post('/crm/customers/:id/contacts', createContactHandler);
  app.get('/crm/contracts', listContractsHandler);
  app.post('/crm/contracts', createContractHandler);
  app.put('/crm/contracts/:id', updateContractHandler);
  app.get('/crm/pipeline', pipelineHandler);
}
