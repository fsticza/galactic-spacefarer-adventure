import cds from '@sap/cds'
import type { Planet, Position, Spacefarer } from '#cds-models/galactic'
import { type Candidate, certify, completeAssignment, enhanceCandidate, validateCandidate } from './lib/spacefarer-rules.ts'

// `@sap/cds` also publishes itself as `global.cds`. When this module is dynamically imported
// concurrently with a sibling service module (both loaded as native ESM/TS by `cds serve`), the
// default import above can resolve to an empty placeholder that Node hands out before the
// `@sap/cds` CommonJS module has actually finished evaluating. `global.cds` is assigned
// synchronously inside that module and is always the fully-initialized singleton by the time a
// service's `init()` runs, so the runtime facade is read from there, falling back to the plain
// import (e.g. under test runners that don't exhibit the race). Type positions (`cds.Request`,
// `cds.User`, ...) keep referring to the static import, which is resolved at compile time and is
// unaffected by which object the import binds to at runtime.
const facade: typeof cds = (globalThis as { cds?: typeof cds }).cds ?? cds

/** Planet codes assigned to a user via the `planet` attribute (mocked users locally, XSUAA in production). */
const planetsOf = (user: cds.User): string[] =>
  ([] as string[]).concat((user.attr?.planet as string | string[] | undefined) ?? []).filter(Boolean)

/** A spacefarer's origin planet is fixed once they have launched. */
const rejectPlanetChange = (req: cds.Request) =>
  req.reject(400, 'The origin planet of a spacefarer cannot be changed', 'originPlanet_code')

/** Key of the addressed spacefarer for UPDATE and draft PATCH requests. */
const keyOf = (req: cds.Request): string | undefined => {
  const data = req.data as Candidate
  const param = req.params?.[0]
  return data.ID ?? (typeof param === 'object' ? (param as { ID?: string }).ID : (param as string | undefined))
}

export class SpacefarerService extends facade.ApplicationService {
  override init() {
    // `cds.log`/`cds.ql` are only populated once the runtime has bootstrapped, so they are read
    // here rather than at module scope (a module-scope access crashes the server at load).
    const LOG = facade.log('spacefarers')
    const { SELECT } = facade.ql
    const Spacefarers = this.entities.Spacefarers! // registered from spacefarer-service.cds
    const SpacefarerDrafts = Spacefarers.drafts! // present because Spacefarers carries @odata.draft.enabled
    const galactic = facade.entities('galactic')
    const SpacefarerRows = galactic.Spacefarers! // the underlying db.Spacefarers entity
    const Planets = galactic.Planets!
    const Positions = galactic.Positions!

    // ------------------------------------------------------------------------------------------
    // Cosmic tenancy. @restrict `where` clauses filter READ/UPDATE/DELETE, but CAP Node.js does
    // not check the *input* of CREATE/UPDATE against them, so without this a manager from
    // Planet X could create a spacefarer "on" Planet Y. The same check guards new drafts and
    // draft edits, so a draft never violates the planet boundary either.
    // ------------------------------------------------------------------------------------------
    const assertPlanetAllowed = (req: cds.Request) => {
      const data = req.data as Candidate
      const planets = planetsOf(req.user)
      const creating = req.event === 'NEW' || req.event === 'CREATE'
      if (creating && !data.originPlanet_code && planets.length === 1) data.originPlanet_code = planets[0]
      const planet = data.originPlanet_code
      if (req.event === 'CREATE' && !planet) return req.reject(400, 'Provide the origin planet', 'originPlanet_code')
      if (req.user.is('GalacticAdmin')) return
      if (planet && !planets.includes(planet)) {
        return req.reject(403, `Cosmic invader alert: you may not assign spacefarers to planet '${planet}'`, 'originPlanet_code')
      }
    }

    // @assert.unique only becomes a database index; check up front so a clash is a clean 400 on
    // the field instead of a raw constraint error, for drafts, direct creates and edits alike.
    const assertEmailAvailable = async (req: cds.Request, email: string | null | undefined, ownID: string | undefined) => {
      if (!email) return
      const clash = (await SELECT.one.from(SpacefarerRows).columns('ID').where({ email })) as Pick<Spacefarer, 'ID'> | null
      if (clash && clash.ID !== ownID) req.error(400, 'This email address is already registered with another spacefarer', 'email')
    }

    this.before('NEW', SpacefarerDrafts, (req: cds.Request) => {
      const data = req.data as Candidate
      if (!data.spacesuitColor_code) data.spacesuitColor_code = 'SILVER'
      return assertPlanetAllowed(req)
    })
    this.before('PATCH', SpacefarerDrafts, async (req: cds.Request) => {
      const data = req.data as Candidate
      if ('email' in data) await assertEmailAvailable(req, data.email, keyOf(req))
      if ('originPlanet_code' in data) {
        const draft = (await SELECT.one
          .from(SpacefarerDrafts, keyOf(req))
          .columns('HasActiveEntity', 'originPlanet_code')) as { HasActiveEntity?: boolean; originPlanet_code?: string } | null
        if (draft?.HasActiveEntity && data.originPlanet_code !== draft.originPlanet_code) return rejectPlanetChange(req)
      }
      return assertPlanetAllowed(req)
    })
    this.before(['CREATE', 'UPDATE'], Spacefarers, assertPlanetAllowed)

    // ------------------------------------------------------------------------------------------
    // Task 3 @Before: prepare the spacefaring candidate for their cosmic journey.
    // Runs for direct POSTs and when a new Fiori draft is activated. The declarative checks
    // (@mandatory, @assert.*) have already run at this point. Eligibility for a position is
    // checked against the candidate's own skill, before the hazard bump is applied.
    // ------------------------------------------------------------------------------------------
    this.before('CREATE', Spacefarers, async (req: cds.Request) => {
      const candidate = req.data as Candidate
      const [planet, position] = (await Promise.all([
        candidate.originPlanet_code ? SELECT.one.from(Planets, candidate.originPlanet_code) : null,
        candidate.position_ID ? SELECT.one.from(Positions, candidate.position_ID) : null,
      ])) as [Planet | null, Position | null]
      await assertEmailAvailable(req, candidate.email, candidate.ID)
      Object.assign(candidate, completeAssignment(candidate, position))
      for (const { field, message } of validateCandidate(candidate, position)) req.error(400, message, field)
      if (req.errors) return
      Object.assign(candidate, enhanceCandidate(candidate, planet ?? {}))
      LOG.info(`Candidate ${candidate.name} prepared for launch as ${candidate.callSign}`)
    })

    // Edits never move a spacefarer to another planet; assignments stay consistent (re-validate
    // the merged row) and the certification follows the skill.
    this.before('UPDATE', Spacefarers, async (req: cds.Request) => {
      const changes = req.data as Candidate
      const touched = ['email', 'originPlanet_code', 'position_ID', 'department_ID', 'wormholeNavigationSkill'].some(field => field in changes)
      if (!touched) return
      const current = (await SELECT.one.from(SpacefarerRows, keyOf(req))) as Spacefarer | null
      if (!current) return
      if ('originPlanet_code' in changes && changes.originPlanet_code !== current.originPlanet_code) return rejectPlanetChange(req)
      if ('email' in changes && changes.email !== current.email) await assertEmailAvailable(req, changes.email, current.ID)
      const merged: Candidate = { ...current, ...changes }
      const position = merged.position_ID ? ((await SELECT.one.from(Positions, merged.position_ID)) as Position | null) : null
      Object.assign(changes, completeAssignment(merged, position))
      Object.assign(merged, changes)
      for (const { field, message } of validateCandidate(merged, position)) req.error(400, message, field)
      if (req.errors) return
      if (changes.wormholeNavigationSkill != null) changes.wormholeCertification = certify(changes.wormholeNavigationSkill)
    })

    // ------------------------------------------------------------------------------------------
    // Task 3 @After: after a successful launch, raise the cosmic event. The NotificationService
    // subscribes to it and queues the congratulation email inside this very transaction, so the
    // mail is only sent once the launch has been committed, and never if it fails.
    // ------------------------------------------------------------------------------------------
    this.after('CREATE', Spacefarers, async (_result: unknown, req: cds.Request) => {
      const s = req.data as Candidate
      await this.emit('SpacefarerLaunched', {
        ID: s.ID,
        name: s.name,
        email: s.email,
        callSign: s.callSign,
        originPlanet: s.originPlanet_code,
        stardustCollection: s.stardustCollection,
        wormholeNavigationSkill: s.wormholeNavigationSkill,
        wormholeCertification: s.wormholeCertification,
        launchedAt: s.launchedAt,
      })
    })

    return super.init()
  }
}
