/**
 * Business rules for preparing a spacefaring candidate for their cosmic journey.
 * Pure functions without CAP dependencies, so they can be unit-tested in isolation.
 */

export const ONBOARDING_BONUS = 100
export const HAZARD_BONUS = 50
export const HAZARD_THRESHOLD = 4
export const MIN_SKILL = 1
export const MAX_SKILL = 10
export const MAX_STARDUST = 1_000_000

/** Wormhole certification band for a navigation skill (1..10). */
export function certify(skill) {
  if (skill >= 8) return 'Master'
  if (skill >= 4) return 'Navigator'
  return 'Cadet'
}

/** Generates a call sign such as `X-AV-1A2B` from planet code and name initials. */
export function callSignFor(name = '', planetCode = 'UNK', random = Math.random) {
  const initials = name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 3) || 'SF'
  const suffix = Math.floor(random() * 0x10000).toString(16).padStart(4, '0').toUpperCase()
  return `${String(planetCode).toUpperCase()}-${initials}-${suffix}`
}

/**
 * Completes a candidate's assignment: a position implies its department when none is given.
 * Returns the fields to merge into the candidate (empty when nothing needs completing).
 */
export function completeAssignment(candidate, position) {
  if (position?.department_ID && !candidate.department_ID) return { department_ID: position.department_ID }
  return {}
}

/**
 * Validation rules beyond the declarative `@assert` constraints of the model. They are checked
 * against the candidate's own skill, before any enhancement is applied.
 * Returns a list of `{ field, message }` problems; an empty list means the candidate qualifies.
 */
export function validateCandidate(candidate, position) {
  const problems = []
  if (!position) return problems
  if (candidate.department_ID && position.department_ID && position.department_ID !== candidate.department_ID) {
    problems.push({
      field: 'position_ID',
      message: `Position '${position.title}' belongs to a different department`,
    })
  }
  const skill = candidate.wormholeNavigationSkill ?? MIN_SKILL
  const required = position.minWormholeSkill ?? MIN_SKILL
  if (skill < required) {
    problems.push({
      field: 'wormholeNavigationSkill',
      message: `Position '${position.title}' requires a wormhole navigation skill of ${required} or higher`,
    })
  }
  return problems
}

/**
 * Enhancements applied to a new candidate on launch:
 *  - an onboarding stardust bonus, larger for hazardous home planets (capped at MAX_STARDUST),
 *  - a wormhole skill bump for candidates from hazardous planets (capped at MAX_SKILL),
 *  - the resulting certification, a call sign and the launch timestamp.
 * Does not mutate its inputs.
 */
export function enhanceCandidate(candidate, planet = {}, now = () => new Date()) {
  const hazardous = (planet.hazardLevel ?? 0) >= HAZARD_THRESHOLD
  const onboardingBonus = ONBOARDING_BONUS + (hazardous ? HAZARD_BONUS : 0)
  const baseSkill = candidate.wormholeNavigationSkill ?? MIN_SKILL
  const wormholeNavigationSkill = Math.min(MAX_SKILL, baseSkill + (hazardous ? 1 : 0))
  return {
    onboardingBonus,
    stardustCollection: Math.min(MAX_STARDUST, (candidate.stardustCollection ?? 0) + onboardingBonus),
    wormholeNavigationSkill,
    wormholeCertification: certify(wormholeNavigationSkill),
    callSign: callSignFor(candidate.name, planet.code ?? candidate.originPlanet_code),
    launchedAt: now().toISOString(),
  }
}
