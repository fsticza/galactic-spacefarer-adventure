# Galactic Spacefarer Adventure: implementation plan (for review)

> **Status (2026-09-17):** implemented, then migrated to TypeScript. Everything in Steps 1–7 is
> done and verified (`npm test`: 6 files, 71 tests green; `npm run lint` clean — CDS model only,
> `.ts` files are outside its coverage, see the migration note below; `npm run typecheck` clean;
> `npm run build` produces gen/db HANA artifacts and gen/srv compiled from TypeScript). Deviations
> from the plan, all recorded in the review table below and in README.md: `@Core.Immutable` was
> dropped because the cds 10 runtime cleanses immutable fields from every draft PATCH (planet
> immutability lives in handlers, the UI uses a dynamic `Common.FieldControl`); `@mandatory` on
> `originPlanet` was dropped because the generic check runs before the handler can default the
> planet (the handler rejects a missing planet with a targeted 400); an explicit email-uniqueness
> pre-check was added because `@assert.unique` is only a database index; the Fiori app was
> generated headlessly with yo 4 and generator 1.32 on the first attempt; `cds add http` fails in
> cds-dk 10.1.1, so the sample requests are hand-written; the approuter lives in
> `.deploy/app-router` (cds-dk 10 convention) and the MTA has no HTML5 module, so the UI is not
> deployed by it (documented as a next step). README, sample requests, commits and the GitHub
> repository are done. `srv/` and `test/` (all still JavaScript when the above was written) were
> later converted to TypeScript; `app/spacefarers` was left as JavaScript. See "Later change:
> TypeScript migration" at the end of this document for what moved and why.

## Review outcome (Codex `gpt-5.6-sol`, 2026-09-16) and resulting revisions

Full review: `PLAN-REVIEW-codex.md`. Findings were re-verified on a scratch copy against the
installed cds 10.1 compiler. The revisions below supersede the corresponding lines in the steps
that follow.

| # | Finding | Revision |
|---|---|---|
| R1 | `@restrict where: (originPlanet_code = …)` does not compile ("Element originPlanet_code has not been found"). Verified. | Use the association path: `where: (originPlanet.code = $user.planet)` in both privileges. |
| R2 | `cds add xsuaa` emits a separate `userattributes` role template carrying `planet`; the app role templates get empty `attribute-references`, and the attribute is `valueRequired: false`. Verified. | After generating `xs-security.json`, add `"attribute-references": ["planet"]` to `SpacefarerViewer` and `SpacefarerManager`; keep `userattributes` for admins of the cockpit; document in README that an empty attribute fully restricts the user. |
| R3 | `before NEW` only defaults the planet; a Planet X manager can hold a draft that says Planet Y until activation fails. | One `assertPlanetAllowed(req)` used in `NEW` (drafts), `CREATE` and `UPDATE`. |
| R4 | Bonus can push `stardustCollection` past the declared maximum (999,950 + 100), and range checks ran before the handler. | `enhanceCandidate` caps at `MAX_STARDUST = 1_000_000`; a unit test covers the cap. |
| R5 | `UPDATE` recomputes certification but never re-checks position/department compatibility or minimum skill, although those fields are editable. | On `UPDATE`, read the current row, merge the payload, run `validateCandidate` on the merged row. |
| R6 | A position without a department is accepted. | Derive `department_ID` from the position when missing; reject a mismatch when both are given. |
| R7 | `awardStardust` is unrelated to the assessment and bypasses input validation. | Removed. No bound action. |
| R8 | Fiori Elements is more reliable with scalar foreign-key paths than association paths in `DataField`s. | `LineItem`, `SelectionFields` and `FieldGroup`s use `originPlanet_code`, `spacesuitColor_code`, `department_ID`, `position_ID`. Element annotations (`Common.Text`, `TextArrangement`, `ValueListWithFixedValues`, `FieldControl`) had to go on the associations instead: annotating the generated `*_code`/`*_ID` elements directly is silently dropped by the compiler ("Element … has not been found" warning), while annotations on the association propagate to the foreign key in `$metadata`. |
| R9 | Planets, Departments, Positions and colors are readable by everyone, only the roster is isolated. | Kept as global reference data, stated explicitly in README (the requirement concerns spacefarers' data). |
| R10 | `SpacefarerService` declares `event SpacefarerLaunched` but never emits it. | Producer emits it in-process in `after CREATE` (`this.emit`). `NotificationService` subscribes once all services are served (`cds.on('served')`) and relays into its own queue: `cds.queued(this).send('deliverWelcomeMail', briefing)`, declared as `action deliverWelcomeMail(briefing : CosmicLaunchBriefing)`. The mail still leaves only after commit; the event is now a real part of the service API. |
| R11 | Tests should be adversarial and not timing-sensitive. | Add: Y draft created by `xavier` is rejected at `NEW`; navigation/`$expand` from a foreign row is 404; users with no, empty or two planet attributes; overflow cap. Failing-mail test sets `cds.requires.queue.maxAttempts: 1` via test config or calls the handler directly instead of polling for five seconds. Metadata test asserts each value list maps to the intended collection/property. |
| R12 | Three transports and retry theatre are a lot for one email. | Keep JSON transport (default) and SMTP via `SMTP_URL`; drop Ethereal. The queue stays, as transactional delivery is a deliberate highlight of Task 3. |
| R13 | Two roles would be leaner than three. | Decision left to the project owner; recommendation is to keep Viewer as a read-only least-privilege showcase (cost: one role template and two tests). |
| R14 | "Dead letter" is imprecise for cds 10 queues. | Wording: after `maxAttempts` the row stays in `cds.outbox.Messages` as exhausted and can be revived. |

## Context

Take-home assessment for an SAP BTP Full Stack role (PDF dated 08.08.2026). Deliverable: a public
GitHub repository with an SAP CAP (Node.js) service and an SAP Fiori Elements List Report +
Object Page app for a `Spacefarers` entity:

- Task 1 data model (stardust collection, wormhole navigation skill, origin planet, spacesuit
  color, departments, positions).
- Task 2 protected CAP service with CRUD.
- Task 3 `before CREATE` (validate + enhance stardust and wormhole skill) and `after CREATE`
  (congratulation email) handlers.
- Task 4/5 List Report with status + spacesuit color and sorting/filtering/pagination; Object
  Page with editable stardust collection and spacesuit color.
- Extras: SQLite locally, only authorized users, Planet X users must not see Planet Y data,
  hosted on GitHub.

`/Users/monad/Work/aldi` started empty and is not a git repository; no sibling project has CAP
code to reuse.

### Decisions made with the project owner

| Decision | Choice |
|---|---|
| CAP runtime | `@sap/cds` 10.1 (ESM project, Node 22+) |
| GitHub | public repo `galactic-spacefarer-adventure` under `fsticza`, created with `gh` at the end |
| BTP deployment | XSUAA + mta.yaml + approuter config generated and verified with `cds build`, no deployment |

### Verified facts (2026-09-16)

- `@sap/cds` latest 10.1.0; `@sap/cds-dk` 10.1.1 exists but npm's `latest` tag for cds-dk still
  points at 9.9.6. Pin `@10` in every tooling call and keep cds-dk as a devDependency so npm
  scripts use the local CLI.
- `@cap-js/sqlite` 3.1.1 uses Node's built-in `node:sqlite` (Node here is 24.16); its plugin
  config already defaults development to an in-memory DB.
- `@cap-js/cds-test` 1.0.2: Vitest-compatible, axios-like `{ data, status, headers }`, throws on
  non-2xx unless the request passes `validateStatus: () => true`; `data.reset` wipes all rows
  including drafts and `cds.outbox.Messages`, then redeploys CSVs.
- `@sap/generator-fiori` 1.32.0 headless mode: `yo @sap/fiori:headless <config> --force --skipInstall`;
  the bundled sub-generator rejects any config whose `version` is not `"0.2"`; SAP's own tooling
  runs it with `yo@4`. UI5 1.152.x is current, 1.148.x is long-term maintenance.
- ESM service implementation form documented by CAP: `import cds from '@sap/cds'` and a named
  export `export class SpacefarerService extends cds.ApplicationService { init() { …; return super.init() } }`;
  `npx cds add handler` scaffolds that file.
- cds 10 behaviours relied upon: generic CREATE returns a lazy array with `.affected` (use
  `req.data`, which carries the generated `ID`); activating a new draft fires the active entity's
  `before/after CREATE`; `cds.fiori.bypass_draft` is on, so `POST … { IsActiveEntity: true }` creates
  an active row directly; calculated elements are computed in drafts; read-only fields must be
  set in CREATE handlers (generic input handlers, including `@readonly` stripping and `@assert`
  checks, always run before custom `before` handlers regardless of registration order);
  Node.js does NOT check CREATE/UPDATE input against `@restrict where`, so the planet boundary
  needs a handler; `cds.queued(srv)` persists `emit/send` in `cds.outbox.Messages` inside the
  current transaction and dispatches after commit (`maxAttempts` 10); `await cds.flush()`
  resolves once the queue runner is idle; mocked users take `attr: { planet: [...] }` and
  `$user.planet` is a list, empty meaning fully restricted.

## Repository layout

```
/Users/monad/Work/aldi
├── package.json                 ESM, scripts, cds config (auth users, queue, mail profiles)
├── vitest.config.js             include test/**/*.test.js, pool forks, fileParallelism false
├── .env.example                 SMTP_URL / MAIL_TRANSPORT
├── db/schema.cds                domain model, namespace galactic
├── db/data/galactic-*.csv       Planets(6) SpacesuitColors(8) Departments(6) Positions(12) Spacefarers(60)
├── srv/spacefarer-service.cds   SpacefarerService: draft-enabled Spacefarers, code lists, auth, paging, event
├── srv/spacefarer-service.js    NEW / CREATE / UPDATE handlers, email enqueue, awardStardust action
├── srv/lib/spacefarer-rules.js  pure functions: enhance, certify, validate (unit-testable)
├── srv/notification-service.cds internal (@protocol: 'none') service consuming event SpacefarerLaunched
├── srv/notification-service.js  nodemailer transport selection + mail template
├── app/spacefarers/             generated FE V4 LROP app (webapp/manifest.json, ui5.yaml, annotations.cds)
├── app/router/                  from cds add approuter
├── test/{rules,auth,create,draft,notifications,metadata}.test.js
├── xs-security.json, mta.yaml   from cds add xsuaa,mta (build-verified only)
├── .github/workflows/ci.yml     npm ci, lint, test, build
└── README.md, .gitignore, PLAN.md
```

## Step 1: scaffold (done)

```
cd /Users/monad/Work/aldi
npx -y -p @sap/cds-dk@10 cds init --nodejs --add lint,http   # http facet needs a model, rerun later
npm i nodemailer
npm i -D @sap/cds-dk@10 @cap-js/sqlite@3 @cap-js/cds-test vitest
```

Scripts to add: `start` (`cds-serve`), `watch` (`cds watch`), `test` (`vitest run`), `lint` (`cds lint`),
`build` (`cds build --production`). `engines.node >= 22`. Then `git init -b main` and a first commit.

## Step 2: data model (`db/schema.cds`, written)

`using { cuid, managed, sap.common.CodeList } from '@sap/cds/common'`, namespace `galactic`.

- `Planets : CodeList { key code : String(10); galaxy : String(60); hazardLevel : Integer }`
  with codes `X`, `Y`, `ZOG`, `KEPLER`, `VEGA`, `ORION`. `code` is the tenancy key matched against `$user.planet`.
- `SpacesuitColors : CodeList { key code : String(10); hex : String(7) }` (RED, BLUE, GOLD, VIOLET,
  SILVER, EMERALD, BLACK, WHITE). Code list rather than enum so Fiori gets a dropdown for free.
- `Departments : cuid, managed { name @mandatory; description; headquarters : Association to Planets;
  positions; spacefarers }` with `@cds.odata.valuelist`.
- `Positions : cuid { title @mandatory; rank : Integer; minWormholeSkill : Integer default 1;
  department : Association to Departments }` with `@cds.odata.valuelist`.
- `Spacefarers : cuid, managed` annotated `@assert.unique: { email: [email] }`:
  - `name : String(100) @mandatory`
  - `email : String(255) @mandatory @assert.format: '^[^@\s]+@[^@\s]+\.[^@\s]+$'`
  - `stardustCollection : Integer default 0 @assert.range: [0, 1000000]`
  - `wormholeNavigationSkill : Integer default 1 @assert.range: [1, 10]`
  - `originPlanet : Association to Planets @mandatory @assert.target`
  - `spacesuitColor : Association to SpacesuitColors @mandatory @assert.target`
  - `department : Association to Departments @assert.target; position : Association to Positions @assert.target`
  - `bio : LargeString`
  - set by handlers, client-read-only: `callSign : String(30) @readonly; launchedAt : Timestamp @readonly;
    onboardingBonus : Integer default 0 @readonly; wormholeCertification : String(20) @readonly` (Cadet / Navigator / Master)
  - calculated on-read (filterable, sortable, computed in drafts):
    `stardustStatus : String(20) = case when stardustCollection >= 10000 then 'Legendary' when >= 1000 then 'Thriving' when >= 100 then 'Collecting' else 'Depleted' end`
    and `stardustCriticality : Integer` with 5 / 3 / 2 / 1 for the same bands (UI.CriticalityType: 1 negative, 2 critical, 3 positive, 5 information).
- `@title` on every element so labels need no UI annotations.
- CSVs: 60 spacefarers (24 on X, 20 on Y, 16 elsewhere), stardust spanning all four bands,
  unique emails, some without department/position. 60 rows exceed the default page of 20 so
  `@odata.nextLink` appears; the X/Y split demonstrates tenancy.

## Step 3: services (written)

`srv/spacefarer-service.cds`:

```cds
using { galactic as db } from '../db/schema';
using { CosmicLaunchBriefing } from './notification-service';

@path: 'spacefarers'                                   // -> /odata/v4/spacefarers
@requires: ['SpacefarerViewer', 'SpacefarerManager', 'GalacticAdmin']
@cds.query.limit: { default: 20, max: 100 }
service SpacefarerService {

  @odata.draft.enabled
  @restrict: [
    { grant: 'READ', to: 'SpacefarerViewer',  where: (originPlanet_code = $user.planet) },
    { grant: '*',    to: 'SpacefarerManager', where: (originPlanet_code = $user.planet) },
    { grant: '*',    to: 'GalacticAdmin' }
  ]
  entity Spacefarers as projection on db.Spacefarers
    actions { action awardStardust(amount : Integer @mandatory) returns Spacefarers; };

  @readonly entity Planets         as projection on db.Planets;
  @readonly entity SpacesuitColors as projection on db.SpacesuitColors;
  @readonly entity Departments     as projection on db.Departments;
  @readonly entity Positions       as projection on db.Positions;

  /** Cosmic custom event, raised once a new spacefaring candidate has successfully launched. */
  event SpacefarerLaunched : CosmicLaunchBriefing;
}
annotate SpacefarerService.Spacefarers with {
  name @Core.Immutable; email @Core.Immutable; originPlanet @Core.Immutable;   // settable on create, frozen afterwards
};
```

Service-level `@requires` turns a role-less authenticated user into 403. Draft privileges derive
from CREATE/UPDATE automatically. `awardStardust` is the small creative extra
(`UPDATE(req.subject).with({ stardustCollection: { '+=': amount } })`; cds 10.1 enforces
`@restrict.where` on bound actions).

`srv/notification-service.cds`: a shared `type CosmicLaunchBriefing { ID, name, email, callSign,
originPlanet, stardustCollection, wormholeNavigationSkill, wormholeCertification, launchedAt }` and

```cds
@protocol: 'none'
service NotificationService {
  event SpacefarerLaunched : CosmicLaunchBriefing;
}
```

Open point for review: whether `event X : <named type>` compiles; fallback is inlining the elements.

## Step 4: handlers (written, not yet executed)

`srv/spacefarer-service.js` (named ESM export, handlers registered before `return super.init()`,
the standard pattern; generic input handlers still run first):

- `before('NEW', Spacefarers.drafts)`: for non-admins default `originPlanet_code` to the user's
  single planet; default `spacesuitColor_code = 'SILVER'`.
- `before(['CREATE','UPDATE'], Spacefarers)` planet boundary: skip for `req.user.is('GalacticAdmin')`;
  `planets = [].concat(req.user.attr?.planet ?? [])`; default `originPlanet_code` on CREATE when
  missing and exactly one planet; reject with `req.reject(403, …, 'originPlanet_code')`
  when the payload names a planet outside the list.
- `before('CREATE', Spacefarers)` prepare the candidate (logic in `srv/lib/spacefarer-rules.js`):
  validate that a given position belongs to the given department and that
  `minWormholeSkill <= wormholeNavigationSkill` (`req.error(400, …, field)` so Fiori shows it on
  the field); then enhance: `onboardingBonus = 100` (+50 for `hazardLevel >= 4`),
  `stardustCollection += onboardingBonus`, `wormholeNavigationSkill = min(10, skill + (hazardLevel >= 4 ? 1 : 0))`,
  `wormholeCertification = certify(skill)` (<4 Cadet, <8 Navigator, else Master),
  `callSign = <PLANET>-<INITIALS>-<4 hex>`, `launchedAt = now`.
- `before('UPDATE', Spacefarers)`: recompute `wormholeCertification` when the skill changes.
- `after('CREATE', Spacefarers, async (_, req) => …)`: connect lazily
  (`cds.queued(await cds.connect.to('NotificationService'))`), then
  `await queued.emit('SpacefarerLaunched', {...req.data fields})`. The message lands in
  `cds.outbox.Messages` in the insert's transaction: a later failure rolls it back, a commit
  dispatches it in a fresh root transaction, and a transport error leaves it queued with
  `attempts + 1` and `lastError` for retry (dead letter after `maxAttempts`).

`srv/notification-service.js`: `export class NotificationService extends cds.ApplicationService`;
`init()` picks the transport from env / `cds.env.mail`: `SMTP_URL` or `MAIL_TRANSPORT=smtp` -> SMTP;
`MAIL_TRANSPORT=ethereal` -> `nodemailer.createTestAccount()` and log the preview URL;
otherwise `{ jsonTransport: true }` and log the rendered mail via `cds.log('notifications')`.
The transporter lives on `this.transporter` so tests can swap it. `on('SpacefarerLaunched')`
renders subject "Welcome aboard, <name>! Your cosmic journey begins" with call sign, stardust and certification.

Design note: the queue targets `NotificationService` (no `@requires`) rather than the emitting
service, so the queue runner's dispatch is never blocked by the SpacefarerService role check.

## Step 5: Fiori Elements app

Generate BEFORE writing annotations (the generator overwrites `annotations.cds`). Config in the
scratchpad:

```json
{ "version": "0.2", "floorplan": "FE_LROP",
  "project": { "name": "spacefarers", "namespace": "galactic", "title": "Galactic Spacefarers",
    "description": "Spacefarer roster across the SAP galaxy", "ui5Version": "1.152.0",
    "localUI5Version": "1.152.0", "sapux": true, "enableEslint": false, "enableTypeScript": false },
  "service": { "servicePath": "/odata/v4/spacefarers/",
    "capService": { "projectPath": "/Users/monad/Work/aldi", "serviceName": "SpacefarerService",
      "serviceCdsPath": "srv/spacefarer-service.cds", "capType": "Node.js" } },
  "entityConfig": { "mainEntity": { "entityName": "Spacefarers" },
    "generateLROPAnnotations": false, "generateFormAnnotations": false } }
```

```
npx -y -p yo@4 -p @sap/generator-fiori@1.32.0 yo @sap/fiori:headless <scratchpad>/spacefarers.json --force --skipInstall
```

Expected output: `app/spacefarers/` with `webapp/manifest.json` (`sap.fe.templates.ListReport` /
`ObjectPage`, routes `:?query:` and `Spacefarers({key}):?query:`), `index.html`, `ui5.yaml`
(`fiori-tools-proxy` to `http://localhost:4004`), `annotations.cds`; root `package.json` gains
`sapux` and a `watch-spacefarers` script. Review the diff, keep only those edits.

Fallback if the generator fails: hand-write `manifest.json` (dataSource `mainService` at
`/odata/v4/spacefarers/`, OData 4.0; default model with `operationMode: Server`, `autoExpandSelect`,
`earlyRequests`; libs `sap.ui.core`, `sap.fe.templates`; targets `SpacefarersList` with
`contextPath: /Spacefarers`, `variantManagement: Page`, `initialLoad: Enabled` and
`SpacefarersObjectPage`), `Component.js` extending `sap/fe/core/AppComponent`, `index.html` with
CDN bootstrap and `ComponentSupport`. `cds watch` serves `app/` statically, so no ui5.yaml is
needed locally.

`app/spacefarers/annotations.cds`:

- `UI.HeaderInfo` (Spacefarer / Spacefarers, Title `name`, Description `callSign`).
- `UI.SelectionFields: [originPlanet_code, spacesuitColor_code, department_ID, stardustStatus]`.
- `UI.LineItem`: name, origin planet, stardust collection,
  `{ Value: stardustStatus, Criticality: stardustCriticality }`, spacesuit color, wormhole skill, department.
- `UI.PresentationVariant` default sort `stardustCollection desc`.
- `UI.HeaderFacets`: `UI.DataPoint #Stardust` (criticality) and `UI.DataPoint #Skill`
  (`Visualization: #Rating`, `TargetValue: 10`).
- `UI.Facets` / `UI.FieldGroup`s: Cosmic Identity (name, email, originPlanet, callSign,
  wormholeCertification), Cosmic Skills (stardustCollection, stardustStatus,
  wormholeNavigationSkill, spacesuitColor, onboardingBonus), Assignment (department, position),
  Launch Log (launchedAt, createdAt, createdBy, modifiedAt).
- `Common.Text` + `TextArrangement: #TextOnly` on the four associations,
  `Common.ValueListWithFixedValues` on planet and color; `ID` and `stardustCriticality` `@UI.Hidden`.
- Stardust and spacesuit color stay editable; `@Core.Immutable` freezes name/email/planet after
  creation; the `@readonly` fields render read-only.

Run: `npm run watch`, open http://localhost:4004, follow the app link, log in as a mocked user
(switch users via a private window). Sorting and filtering are server-side (`$orderby`,
`$filter`), paging shows as growing requests capped by `@cds.query.limit`.

## Step 6: security configuration

`cds.requires.auth` in `package.json`:

```json
"[development]": { "kind": "mocked", "users": {
  "xavier": { "password": "planetx", "roles": ["SpacefarerManager"], "attr": { "planet": ["X"] } },
  "yvonne": { "password": "planety", "roles": ["SpacefarerManager"], "attr": { "planet": ["Y"] } },
  "vera":   { "password": "vera",    "roles": ["SpacefarerViewer"],  "attr": { "planet": ["X"] } },
  "zed":    { "password": "galaxy",  "roles": ["GalacticAdmin"] },
  "nobody": { "password": "nobody",  "roles": [] },
  "*": false } },
"[production]": { "kind": "xsuaa" }
```

Custom mail settings live under a top-level `cds.mail` key (`transport`, `from`), outside
`cds.requires`, so cds does not treat them as a required service.

BTP config (build-verified only), run last because the facets edit `package.json`:
`npx cds add xsuaa,mta,approuter,hana`. Check `xs-security.json` for the three role templates,
an attribute `planet`, and `attribute-references` on the two planet-bound templates
(`npx cds compile srv --to xsuaa` shows the generated descriptor). `npm run build` must produce
`gen/db` and `gen/srv`. Confirm `npx cds env requires.db --profile development` is unchanged.

## Step 7: tests (Vitest + `@cap-js/cds-test`)

`vitest.config.js`: `{ test: { include: ['test/**/*.test.js'], pool: 'forks', fileParallelism: false, testTimeout: 20000, hookTimeout: 60000 } }` (written).
Each server test starts with
`import cds from '@sap/cds'; const { GET, POST, PATCH, DELETE, expect, data } = cds.test(import.meta.dirname + '/..'); beforeEach(data.reset)`
and asserts errors via `{ validateStatus: () => true }`. Never import `srv/*.js` statically in tests.

- `rules.test.js`: pure enhancement math, certification bands, validation rules.
- `auth.test.js`: anonymous 401; `nobody` 403; `xavier` sees only X rows and `$count` 24,
  `yvonne` 20, `zed` 60; `xavier` GET of a Y row 404; `xavier` PATCH of a Y row 403/404;
  `vera` PATCH 403; `GET Planets` works for every role.
- `create.test.js`: `xavier` `POST { IsActiveEntity: true, … }` -> 201 with planet defaulted to X,
  bonus applied, `callSign`, `launchedAt`, `wormholeCertification`, `stardustStatus`; a
  client-supplied `callSign` is ignored; `originPlanet_code: 'Y'` -> 403; bad email, skill 11,
  negative stardust, duplicate email, skill below the position's minimum -> 400; `zed` creates
  for any planet; `awardStardust` adds stardust and respects the planet;
  `$orderby=stardustStatus` and `$filter=stardustStatus eq 'Legendary'` work; admin list returns
  20 rows plus `@odata.nextLink`.
- `draft.test.js`: `POST Spacefarers {}` -> draft; PATCH fields; `POST …/draftActivate` -> active row
  with enhancements (CREATE handlers ran); `draftEdit` an X row, patch `spacesuitColor_code`,
  activate; `yvonne` cannot `draftEdit` an X row.
- `notifications.test.js`: swap `notif.transporter` for a recorder; create a spacefarer;
  `await cds.flush()` (fallback: poll `cds.outbox.Messages` until empty, max 5 s); assert the
  recorded mail's recipient and subject and an empty outbox; a 400 create sends nothing; a
  throwing transporter leaves the message queued with `attempts >= 1`.
- `metadata.test.js`: `$metadata` has `Common.ValueList` for `spacesuitColor_code`,
  `originPlanet_code`, `department_ID`, the draft `IsActiveEntity` key, and `Capabilities` restrictions on `Planets`.

## Step 8: README, CI, GitHub

README: purpose; prerequisites (Node 22+, no global cds); quick start; user table (name,
password, role, planet); task-to-code map (Tasks 1–5 -> files); domain diagram from
`npx cds compile db --to mermaid`; security model and curl recipe for the X/Y isolation; email
(transports, queue semantics, retries, `.env.example`); tests; optional persistent SQLite
profile (`cds deploy --to sqlite` + `[persist]` profile); BTP readiness (`xs-security.json`,
`mta.yaml`, role collections carrying the `planet` attribute); design decisions.

`.github/workflows/ci.yml`: Node 24, `npm ci`, `npm run lint`, `npm test`, `npm run build`.
Commit per step; finally
`gh repo create galactic-spacefarer-adventure --public --source . --push --description "SAP CAP + Fiori Elements take-home: Galactic Spacefarer Adventure"`.

## Verification

| Check | Command | Expected |
|---|---|---|
| Model compiles | `npx cds compile srv --to edmx-v4 \| grep -c ValueList` | >= 3, no errors |
| Lint | `npm run lint` | clean |
| Tests | `npm test` | all green |
| Isolation | `curl -u xavier:planetx 'localhost:4004/odata/v4/spacefarers/Spacefarers?$count=true'` vs `yvonne` | 24 vs 20, anonymous 401 |
| Handlers | `curl -u xavier:planetx -X POST … -d '{"IsActiveEntity":true,…}'` | 201, enhanced fields, log line from notifications |
| Fiori | open the app as `xavier`: create, save, edit stardust + color, filter by planet, sort by stardust | works; `yvonne` sees other rows |
| BTP build | `npm run build` | `gen/` produced; `xs-security.json` has `planet` attribute |
| Repo | `gh repo view fsticza/galactic-spacefarer-adventure --web` | public repo with README and CI |

## Risks and mitigations

- cds-dk `latest` is 9.x: pin `@10`; local devDependency in scripts.
- Fiori generator on a cds 10 ESM project: run via `npx` with `yo@4` and config version `0.2`;
  fall back to the hand-written app in Step 5; review its `package.json` edits.
- Generator overwrites `annotations.cds`: generate first, annotate second.
- `cds add` facets edit `package.json` profiles: run them last and re-check the development profile.
- `@assert.unique` on email: seed CSV must have unique emails or deployment fails.
- Calculated elements in `$filter`/`$orderby`: supported by `@cap-js/sqlite`; if a case fails,
  persist the status in the handlers instead.
- Queue in the in-memory dev DB is lost on restart: acceptable; README documents the file-DB profile.
- Mocked basic auth in browsers caches credentials: use private windows to switch users.
- `@Core.Immutable` rendering in edit drafts: if Fiori still shows the field editable, accept it,
  the server enforces the boundary anyway. Note: `@Core.Immutable` also makes CAP ignore
  `originPlanet_code` in UPDATE input, so an attempted planet move may return 200 with the
  planet unchanged rather than 403; tests should assert the row is unchanged.
- `node:sqlite` may print an experimental warning on Node 24: harmless; do not install
  `better-sqlite3`, it would be picked instead.

## Questions a reviewer could usefully answer

1. Is queuing the event on `NotificationService` (consumer) rather than emitting on
   `SpacefarerService` (producer) the right trade-off, or should the producer emit through a
   configured `local-messaging` service?
2. Three roles (Viewer, Manager, Admin) versus two: is the read-only role worth the extra
   surface in `xs-security.json` and tests?
3. Are the enhancement rules (bonus, skill bump, certification) a sensible reading of
   "validating and enhancing their stardust collection and wormhole navigation skills"?
4. Anything in the cds 10 specifics above that looks wrong or outdated?

## Later change: TypeScript migration (2026-09-17)

Everything above this section is the plan and review as they stood before this change and is
left as written. After Steps 1–8 were implemented and reviewed, the CAP service and its test
suite were converted from JavaScript to TypeScript, as a further hardening pass on top of an
already-working, already-reviewed implementation. `app/spacefarers` (generated Fiori Elements
app) was left as JavaScript — the migration is about the hand-written service code, not the
generated UI.

**What moved:** `srv/spacefarer-service.js` → `.ts`, `srv/notification-service.js` → `.ts`,
`srv/lib/spacefarer-rules.js` → `.ts`, all six `test/*.test.js` → `.ts`, `vitest.config.js` →
`.ts`. New: `tsconfig.json` (scoped to `srv` + `@cds-models`, so `cds build` — which compiles
everything `tsconfig.json` includes — does not pull the tests into `gen/srv`),
`tsconfig.typecheck.json` (extends it, widens `include` to `test`, `noEmit`), `srv/lib/cds.ts`
(loads the `@sap/cds` singleton synchronously; see below), `test/helpers.ts` (shared
request-option constants and `ODataCollection`/`ODataError`/`SpacefarerRow` types with boundary-
cast helpers, replacing duplicated setup across the test files). New devDependencies: `typescript`
7, `@cap-js/cds-types`, `@cap-js/cds-typer`, `@types/node`, `@types/nodemailer`, `tsx`. New
scripts: `generate-types` (`cds-typer "*"`, writes the gitignored `@cds-models/`) and `typecheck`
(`tsc --noEmit -p tsconfig.typecheck.json`). CI now runs `npm ci`, `generate-types`, `lint`,
`typecheck`, `test`, `build`, in that order, on Node 24.

**Decisions, condensed** (full rationale in README.md, "Design decisions and trade-offs"):

- Plain Node's native type stripping runs the sources, not the `tsx` loader — relative imports
  keep an explicit `.ts` extension (`allowImportingTsExtensions` +
  `rewriteRelativeImportExtensions`) that `tsc` rewrites to `.js` on emit. Measured: `tsx` took
  37.7s to run the suite, native stripping 5.0s. `erasableSyntaxOnly` is on to keep it that way.
- `tsc` is wired into `cds build` (via the cds-typer build task) and fails the build on type
  errors, so `npm run build` is a second, independent check of what `npm run typecheck` reports.
- The `@sap/cds` types `paths` mapping must point at
  `./node_modules/@cap-js/cds-types/dist/cds-types.d.ts` itself, now recorded in a `"//"` comment
  in `tsconfig.json`. What `cds add typescript` generates points at the package directory instead,
  which doesn't resolve under `moduleResolution: NodeNext` (the package only has `typings`, no
  `exports`) and cascades into `TS7016` / "Property 'before' does not exist" on every service
  class — not something a version bump fixes, either: `@cap-js/cds-types` 0.19 still ships no
  `types`/`exports` field (0.18.0 is installed here).
- Tests set `CDS_TYPESCRIPT: 'true'` in `vitest.config.ts` explicitly, because tests boot the
  server in-process rather than through the `cds` CLI (which would set it itself when it sees a
  `tsconfig.json`). `test/helpers.ts`, imported by every server test file, now throws immediately
  if the variable is unset, so the previous silent failure — cds serving the entities with no
  custom handlers, tests failing on puzzling status codes instead of a load error — can't recur
  unnoticed.
- New file `srv/lib/cds.ts` requires the `@sap/cds` singleton synchronously
  (`createRequire(import.meta.url)('@sap/cds')`) instead of a static ESM import, and both service
  files import `{ cds, type CDS }` from it. `@sap/cds` is CommonJS; `cds serve` loads the two
  service modules concurrently, and a plain `import cds from '@sap/cds'` in either one can bind to
  an empty object that never fills in, so `class X extends cds.ApplicationService` throws `Class
  extends value undefined` at module evaluation, and deferring every access into `init()` still
  fails later with `cds.log is not a function`. Verified 6/6 clean starts with the fix, 5/5
  failures without. The same race is why `#cds-models/*` is imported with `import type` only: the
  generated `@cds-models/_/index.js` itself value-imports `@sap/cds`, so a runtime import of a
  generated entity proxy would drag the broken import back in; entities still come from
  `this.entities` / `cds.entities(...)`.
- No `prepare` script for type generation: `cds build` copies `scripts` into
  `gen/srv/package.json`, where a `prepare` hook would re-run during the production `npm ci`.
- While touching `xs-security.json` for other reasons, confirmed its three scope `description`s
  must stay exactly as `cds` generates them (`"SpacefarerViewer"`, `"SpacefarerManager"`,
  `"GalacticAdmin"`) — cds matches scopes by description, and a custom one made `cds build` append
  a duplicate scope on every rebuild. The role-template descriptions and `attribute-references`
  are matched by name and stay hand-written, unaffected.
- Known gap: `typescript-eslint` 8.70 supports TypeScript `>=4.8.4 <6.1.0`, and there is no release
  yet for TypeScript 7, so `.ts` files have no ESLint rule set at all (`npm run lint` covers only
  the CDS model). `npm run typecheck` and `npm run build` are what gate the TypeScript sources.
