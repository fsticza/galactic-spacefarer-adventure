Overall: one CDS compile blocker, one production-authorization trap, and several correctness gaps. With the `@restrict` expression corrected, the existing CDS compiles in memory; the named event type and all JavaScript files parse successfully. I made no file changes.

## 1. Blocking issues

- [srv/spacefarer-service.cds:17](/Users/monad/Work/aldi/srv/spacefarer-service.cds:17) and [line 18](/Users/monad/Work/aldi/srv/spacefarer-service.cds:18): `originPlanet_code` is not resolvable inside `@restrict`. Running the installed CDS 10.1 compiler produces `Element “originPlanet_code” has not been found`. Annotation expressions use the association path, while request payloads use the generated foreign key. Fix both predicates to `originPlanet.code = $user.planet`. An in-memory compile with that replacement succeeded.

- [package.json:15](/Users/monad/Work/aldi/package.json:15), PLAN Step 6: the current project has neither the planned mocked users nor `test`, `lint`, `watch`, and `build` scripts. CAP therefore supplies its default users (`alice`, `bob`, etc.), none of which has these roles, so the service is effectively unusable. This is acknowledged as unfinished, but it blocks running the current tree. Add the planned `cds.requires.auth`, mail configuration, scripts, and Node engine.

- PLAN Step 6, lines 299–303: the expected XSUAA output is wrong and can leave production users without `planet`. The installed `cds-dk` generator creates a separate `userattributes` role template containing `"planet"`; Viewer and Manager templates get empty `attribute-references`. I confirmed this by compiling the corrected model through the installed XSUAA transformer. Fix `xs-security.json` so Viewer and Manager templates reference `planet`, or deliberately assign the generated `userattributes` role alongside each application role and document that provisioning requirement.

No active-row draft isolation bypass was apparent after inspecting CDS 10’s draft and authorization handlers: `draftEdit` reads the active row through authorization, and activation reaches the active `CREATE` handler. This still needs integration tests.

## 2. Important improvements

- [srv/spacefarer-service.js:19](/Users/monad/Work/aldi/srv/spacefarer-service.js:19): the comment claims the boundary covers drafts, but `NEW` only defaults values—it accepts a Planet X manager’s draft containing `originPlanet_code: 'Y'`. Activation should fail later, but the draft temporarily violates the invariant. Reuse one planet-check function in draft `NEW` and active `CREATE`; also register it for draft updates if tenant keys ever become mutable.

- [srv/spacefarer-rules.js:64](/Users/monad/Work/aldi/srv/lib/spacefarer-rules.js:64): a valid input of 999,950 stardust becomes 1,000,050 after the bonus. CAP’s range validation runs before the custom handler, so the enhanced value is not revalidated. Reject or cap the post-enhancement total before assigning it.

- [srv/spacefarer-service.js:55](/Users/monad/Work/aldi/srv/spacefarer-service.js:55): updates recompute certification but do not recheck position/department compatibility or minimum skill. The planned Object Page leaves skill, position, and department editable. Either validate a merged current-row/payload on update, or make those fields immutable/read-only if only stardust and suit color should be editable.

- [srv/lib/spacefarer-rules.js:32](/Users/monad/Work/aldi/srv/lib/spacefarer-rules.js:32): supplying a position without a department is accepted even when the position belongs to one. Either derive `department_ID` from the position, or require the pair and reject incomplete assignments.

- [srv/spacefarer-service.js:86](/Users/monad/Work/aldi/srv/spacefarer-service.js:86): `awardStardust` bypasses service input validation through an internal database update and can exceed the declared one-million maximum. Check the resulting total, ideally atomically with a guarded update.

- PLAN Step 5, lines 261–275: use scalar foreign-key paths in `UI.DataField` and field groups (`originPlanet_code`, `spacesuitColor_code`, `department_ID`, `position_ID`), then put `Common.Text`/`TextArrangement` on those properties. Association-valued fields are less reliable in Fiori Elements. Also, `@cds.odata.valuelist` generates value help, not necessarily a dropdown; the planned `ValueListWithFixedValues` is what supplies the fixed-values hint.

- [srv/spacefarer-service.cds:28](/Users/monad/Work/aldi/srv/spacefarer-service.cds:28): reference entities are global. Thus X users can read Planet Y and Y-headquartered department records, although Spacefarers are isolated. If “must not see Planet Y data” is literal, restrict `Planets` and any tenant-owned reference data too. Otherwise explicitly document that catalogs are global and only the roster is isolated.

- PLAN Step 7: add adversarial tests for creating a Y draft as Xavier, activating it, navigation/`$expand` access, bound actions on Y records, missing/empty/multiple `planet` attributes, and post-bonus/action range overflow. For the failing-mail test, configure `maxAttempts: 1` or isolate the queue; polling for five seconds against ten retry attempts is timing-sensitive.

- PLAN Step 7 metadata test: test semantic annotations, not string presence alone—for example, that each value-list local property maps to the intended collection/property and that immutable/read-only fields emit the expected metadata.

The CSVs are internally consistent: 60 rows, X=24, Y=20, unique emails, valid references, matching departments/positions, and no seed candidate below the position minimum.

## 3. Answers to the reviewer questions

1. Queuing `NotificationService` works as a transactional asynchronous command and avoids producer authorization during dispatch. Do not add `local-messaging` for this take-home. However, [srv/spacefarer-service.cds:34](/Users/monad/Work/aldi/srv/spacefarer-service.cds:34) declares a producer event that is never emitted. Either remove it and describe the consumer call as a queued notification command, or adopt genuine pub/sub consistently.

2. Viewer/Manager/Admin is defensible and demonstrates least privilege, but it is not necessary for the assessment. Since XSUAA configuration is not written yet, Manager plus Admin is the leaner choice. Keep Viewer only if read-only authorization is an intentional showcase.

3. The enhancement rules are a sensible, testable interpretation. The hazard bonus and certification bands are pleasantly concrete. Fix the post-enhancement range issue and clearly state that position eligibility is checked before the hazard skill bump.

4. Most CDS 10 facts are correct and match installed sources: generic validation precedes custom handlers; draft activation reaches active `CREATE`; direct `IsActiveEntity: true` works because bypass-draft defaults on; user attributes may be arrays; `cds.flush()` exists; and the named event type compiles. Corrections:

   - `@restrict` must use `originPlanet.code`, not `originPlanet_code`.
   - XSUAA generates a separate `userattributes` template, not attribute references on Viewer/Manager.
   - “Dead letter” is imprecise: after `maxAttempts`, the persistent row remains exhausted; there is no separate dead-letter queue.
   - UPDATE targets are authorization-filtered, but new assignment values are not generally validated against the predicate—the plan’s input handler remains necessary.

## 4. Over-engineering that could be cut

- [srv/spacefarer-service.cds:22](/Users/monad/Work/aldi/srv/spacefarer-service.cds:22): remove `awardStardust`; it is unrelated to the assessment and adds authorization, draft, side-effect, and range-testing surface.
- PLAN Steps 4 and 7: Ethereal, real SMTP, JSON transport, persistent retries, failure-state tests, and queue polling are a lot for one congratulatory email. Keep JSON plus one injectable transport; retain the queue only if transactional delivery is a deliberate highlight.
- PLAN Step 6: drop Viewer if schedule is tight.
- PLAN Step 7: metadata tests and detailed queue-internal assertions can be reduced in favor of end-to-end security, draft, create, and Fiori smoke tests.

I could not validate generator output or actual Fiori rendering because the app files do not yet exist; those observations are necessarily plan-level.