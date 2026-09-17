import type { Spacefarer } from '#cds-models/galactic'

/** Base path of the Galactic Spacefarer Service. */
export const BASE = '/odata/v4/spacefarers'

/** Request options for the mocked users declared in package.json. */
export const asXavier = { auth: { username: 'xavier', password: 'planetx' } }
export const asYvonne = { auth: { username: 'yvonne', password: 'planety' } }
export const asVera = { auth: { username: 'vera', password: 'vera' } }
export const asZed = { auth: { username: 'zed', password: 'galaxy' } }
export const asNobody = { auth: { username: 'nobody', password: 'nobody' } }

/** Keeps a non-2xx response as a value instead of letting the client throw. */
export const throwing = { validateStatus: () => true }

/** Shape of an OData V4 collection response. */
export interface ODataCollection<T> {
  value: T[]
  '@odata.count'?: number
  '@odata.nextLink'?: string
}

/** Shape of an OData V4 error response. */
export interface ODataError {
  error: {
    code: string
    message: string
    target?: string
    details?: { code: string; message: string; target?: string }[]
  }
}

/** A spacefarer as returned by the service, including the draft and calculated elements. */
export type SpacefarerRow = Spacefarer & {
  IsActiveEntity?: boolean
  HasActiveEntity?: boolean
  stardustStatus?: string | null
  stardustCriticality?: number | null
}

/** Casts a response body to a single spacefarer row. */
export const asSpacefarerRow = (res: { data: unknown }) => res.data as SpacefarerRow

/** Casts a response body to an OData collection of spacefarer rows. */
export const asSpacefarerCollection = (res: { data: unknown }) => res.data as ODataCollection<SpacefarerRow>

/** Casts a response body to an OData error payload. */
export const asODataError = (res: { data: unknown }) => res.data as ODataError
