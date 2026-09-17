import { createRequire } from 'node:module'
import type CDS from '@sap/cds'

/**
 * The cds runtime facade, loaded synchronously.
 *
 * `@sap/cds` is a CommonJS module and `cds serve` imports the service implementations
 * concurrently. An ESM `import cds from '@sap/cds'` inside one of them can then bind to an empty
 * object that never fills in, so `cds.ApplicationService` is undefined while the module is being
 * evaluated ("Class extends value undefined") and `cds.log` is still missing later, inside
 * `init()`. Requiring the module synchronously always yields the finished singleton and keeps the
 * service implementations out of that race altogether.
 *
 * Import the value from here; take the types from `CDS` (`CDS.Request`, `CDS.User`, ...), which
 * is a type-only re-export and contributes nothing at runtime.
 *
 * The same race is why `#cds-models` may only ever be imported with `import type`: the generated
 * `@cds-models/_/index.js` imports `@sap/cds` the ESM way, so pulling it in at runtime reintroduces
 * exactly the problem this module exists to avoid. Entities come from `cds.entities(...)` or
 * `this.entities` instead.
 */
export const cds = createRequire(import.meta.url)('@sap/cds') as typeof CDS

export type { CDS }
