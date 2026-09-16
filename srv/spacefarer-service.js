import cds from '@sap/cds'
import { certify, completeAssignment, enhanceCandidate, validateCandidate } from './lib/spacefarer-rules.js'

const LOG = cds.log('spacefarers')

/** Planet codes assigned to a user via the `planet` attribute (mocked users locally, XSUAA in production). */
const planetsOf = user => [].concat(user.attr?.planet ?? []).filter(Boolean)

/** A spacefarer's origin planet is fixed once they have launched. */
const rejectPlanetChange = req => req.reject(400, 'The origin planet of a spacefarer cannot be changed', 'originPlanet_code')

/** Key of the addressed spacefarer for UPDATE and draft PATCH requests. */
const keyOf = req => req.data.ID ?? (typeof req.params?.[0] === 'object' ? req.params[0].ID : req.params?.[0])

export class SpacefarerService extends cds.ApplicationService {
  init() {
    const { Spacefarers } = this.entities
    const { Spacefarers: SpacefarerRows, Planets, Positions } = cds.entities('galactic')

    // ------------------------------------------------------------------------------------------
    // Cosmic tenancy. @restrict `where` clauses filter READ/UPDATE/DELETE, but CAP Node.js does
    // not check the *input* of CREATE/UPDATE against them, so without this a manager from
    // Planet X could create a spacefarer "on" Planet Y. The same check guards new drafts and
    // draft edits, so a draft never violates the planet boundary either.
    // ------------------------------------------------------------------------------------------
    const assertPlanetAllowed = req => {
      const planets = planetsOf(req.user)
      const creating = req.event === 'NEW' || req.event === 'CREATE'
      if (creating && !req.data.originPlanet_code && planets.length === 1) req.data.originPlanet_code = planets[0]
      const planet = req.data.originPlanet_code
      if (req.event === 'CREATE' && !planet) return req.reject(400, 'Provide the origin planet', 'originPlanet_code')
      if (req.user.is('GalacticAdmin')) return
      if (planet && !planets.includes(planet)) {
        return req.reject(403, `Cosmic invader alert: you may not assign spacefarers to planet '${planet}'`, 'originPlanet_code')
      }
    }

    // @assert.unique only becomes a database index; check up front so a clash is a clean 400 on
    // the field instead of a raw constraint error, for drafts, direct creates and edits alike.
    const assertEmailAvailable = async (req, email, ownID) => {
      if (!email) return
      const clash = await SELECT.one.from(SpacefarerRows).columns('ID').where({ email })
      if (clash && clash.ID !== ownID) req.error(400, 'This email address is already registered with another spacefarer', 'email')
    }

    this.before('NEW', Spacefarers.drafts, req => {
      if (!req.data.spacesuitColor_code) req.data.spacesuitColor_code = 'SILVER'
      return assertPlanetAllowed(req)
    })
    this.before('PATCH', Spacefarers.drafts, async req => {
      if ('email' in req.data) await assertEmailAvailable(req, req.data.email, keyOf(req))
      if ('originPlanet_code' in req.data) {
        const draft = await SELECT.one.from(Spacefarers.drafts, keyOf(req)).columns('HasActiveEntity', 'originPlanet_code')
        if (draft?.HasActiveEntity && req.data.originPlanet_code !== draft.originPlanet_code) return rejectPlanetChange(req)
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
    this.before('CREATE', Spacefarers, async req => {
      const candidate = req.data
      const [planet, position] = await Promise.all([
        candidate.originPlanet_code ? SELECT.one.from(Planets, candidate.originPlanet_code) : null,
        candidate.position_ID ? SELECT.one.from(Positions, candidate.position_ID) : null,
      ])
      await assertEmailAvailable(req, candidate.email, candidate.ID)
      Object.assign(candidate, completeAssignment(candidate, position))
      for (const { field, message } of validateCandidate(candidate, position)) req.error(400, message, field)
      if (req.errors) return
      Object.assign(candidate, enhanceCandidate(candidate, planet ?? {}))
      LOG.info(`Candidate ${candidate.name} prepared for launch as ${candidate.callSign}`)
    })

    // Edits never move a spacefarer to another planet; assignments stay consistent (re-validate
    // the merged row) and the certification follows the skill.
    this.before('UPDATE', Spacefarers, async req => {
      const changes = req.data
      const touched = ['email', 'originPlanet_code', 'position_ID', 'department_ID', 'wormholeNavigationSkill'].some(field => field in changes)
      if (!touched) return
      const current = await SELECT.one.from(SpacefarerRows, keyOf(req))
      if (!current) return
      if ('originPlanet_code' in changes && changes.originPlanet_code !== current.originPlanet_code) return rejectPlanetChange(req)
      if ('email' in changes && changes.email !== current.email) await assertEmailAvailable(req, changes.email, current.ID)
      const merged = { ...current, ...changes }
      const position = merged.position_ID ? await SELECT.one.from(Positions, merged.position_ID) : null
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
    this.after('CREATE', Spacefarers, async (_result, req) => {
      const s = req.data
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
