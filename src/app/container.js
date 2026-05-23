import db from '../db.js'
import logger from '../logger.js'
import * as manager from '../manager.js'
import { createPaymentsService } from '../domain/payments/service.js'
import { createSessionService } from '../domain/session/service.js'

export function createAppContainer(overrides = {}) {
  const deps = {
    db,
    logger,
    manager,
    now: () => new Date(),
    ...overrides,
  }

  return {
    ...deps,
    services: {
      payments: createPaymentsService({ db: deps.db, now: deps.now }),
      session: createSessionService({ db: deps.db }),
    },
  }
}

export const appContainer = createAppContainer()
