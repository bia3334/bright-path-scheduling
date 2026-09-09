# Build plan

Executable plan for the build session. Every decision is already made in
`DECISIONS.md` and `docs/architecture.md`; this file turns them into steps.
Do not redesign. If something here is impossible, do the smallest deviation,
note it in the commit message, and carry on.

## Ground rules for the executing agent

- **Time box: 120 minutes wall clock.** Budget per phase is below. If a phase
  runs over by more than 10 minutes, cut scope inside that phase (the "cut
  first" line), never a later phase.
- **Pinned now: `2026-03-06T10:00` Asia/Ho_Chi_Minh.** Seed rows are created
  at `2026-03-02T12:00`. Never call the real clock in application code.
- **One commit per phase, sometimes two.** Messages are given. Never squash.
  Commit message body says what and why, two to four lines.
- **No extra dependencies** beyond the list in Phase 1. No JPA, Lombok,
  MapStruct, OpenCSV, component libraries, CSS frameworks.
- **Names are honest.** A method called `create` creates. A 409 says why.
- **Verify every phase with the command given** before committing. If the
  expected output does not appear, fix before moving on.
- Do not touch `DECISIONS.md` sections 1 to 3, `docs/architecture.md`,
  `docs/proposal.html`, or the CSVs. Section 4 of `DECISIONS.md` is written in
  Phase 6.
- Run from the repo root unless a step says otherwise. The root already holds
  `lessons_export.csv`, `tutors.csv`, `DECISIONS.md`, `docs/`.

## Budget

| Phase | What | Minutes | Running |
|---|---|---|---|
| 0 | Layout, Docker Compose, gitignore | 5 | 5 |
| 1 | Spring skeleton, Flyway schema | 15 | 20 |
| 2 | Service, repository, API, 409 mapping | 25 | 45 |
| 3 | Seed importer, run and read the log | 15 | 60 |
| 4 | One integration test class | 15 | 75 |
| 5 | React day grid | 25 | 100 |
| 6 | README, close DECISIONS.md | 10 | 110 |
| — | Buffer | 10 | 120 |

---

## Phase 0 · Layout and database (5 min)

Files:

```
docker-compose.yml
.gitignore            (append)
backend/              (empty for now)
frontend/             (empty for now)
```

`docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: brightpath
      POSTGRES_USER: brightpath
      POSTGRES_PASSWORD: brightpath
    ports: ["5432:5432"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U brightpath"]
      interval: 2s
      retries: 15
```

Append to `.gitignore`: `backend/target/`, `frontend/node_modules/`, `frontend/dist/`, `.idea/`, `*.iml`, `.vscode/`.

Verify:

```
docker compose up -d db && docker compose ps
```

Expected: `db` is `healthy` within ~10 s.

Commit: `Add Postgres 16 via Docker Compose`
Body: Single database service, credentials are local-only. The rest of the stack runs on the host.

---

## Phase 1 · Spring Boot skeleton and schema (15 min)

Generate the backend with Maven, no Spring Initializr download needed. Files:

```
backend/pom.xml
backend/src/main/java/com/brightpath/booking/BookingApplication.java
backend/src/main/resources/application.yml
backend/src/main/resources/db/migration/V1__schema.sql
```

`pom.xml`: parent `spring-boot-starter-parent` **3.3.5**, Java 17, artifact `booking`. Dependencies, exactly:

- `spring-boot-starter-web`
- `spring-boot-starter-jdbc`
- `spring-boot-starter-validation`
- `org.flywaydb:flyway-core`
- `org.flywaydb:flyway-database-postgresql`
- `org.postgresql:postgresql` (runtime)
- `spring-boot-starter-test` (test)
- `spring-boot-testcontainers` (test)
- `org.testcontainers:postgresql` (test)
- `org.testcontainers:junit-jupiter` (test)

Plugin: `spring-boot-maven-plugin`.

`application.yml`:

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/brightpath
    username: brightpath
    password: brightpath
  flyway:
    enabled: true
app:
  now: 2026-03-06T10:00:00          # pinned, see DECISIONS.md
  seed-created-at: 2026-03-02T12:00:00
  seed-dir: ..                      # where lessons_export.csv and tutors.csv live
```

`BookingApplication.java`: standard `@SpringBootApplication` plus one bean:

```java
@Bean Clock clock(@Value("${app.now}") LocalDateTime now) {
  var zone = ZoneId.of("Asia/Ho_Chi_Minh");
  return Clock.fixed(now.atZone(zone).toInstant(), zone);
}
```

`V1__schema.sql`, verbatim:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE tutors (
  id      text PRIMARY KEY,
  name    text NOT NULL,
  subject text NOT NULL,
  phone   text
);

CREATE TABLE rooms (id text PRIMARY KEY);
INSERT INTO rooms VALUES ('R1'),('R2'),('R3'),('R4'),('R5'),('R6');

CREATE SEQUENCE lesson_seq START 1000;

CREATE TABLE lessons (
  id           text PRIMARY KEY,
  date         date NOT NULL,
  start_time   time NOT NULL,
  duration_min int  NOT NULL,
  student      text NOT NULL,
  tutor_id     text NOT NULL REFERENCES tutors(id),
  room_id      text NOT NULL REFERENCES rooms(id),
  status       text NOT NULL DEFAULT 'booked',
  pair_id      text,
  note         text,
  created_at   timestamp NOT NULL,
  updated_at   timestamp NOT NULL,
  slot tsrange GENERATED ALWAYS AS (
    tsrange(date + start_time,
            date + start_time + duration_min * interval '1 minute', '[)')
  ) STORED,

  CONSTRAINT lessons_status_chk   CHECK (status IN ('booked','cancelled','no_show')),
  CONSTRAINT lessons_duration_chk CHECK (duration_min IN (60, 90)),
  CONSTRAINT lessons_closed_monday CHECK (extract(dow FROM date) <> 1),

  -- a room holds one lesson at a time; rows sharing a pair_id are one occupant
  CONSTRAINT lessons_room_busy EXCLUDE USING gist
    (room_id WITH =, coalesce(pair_id, id) WITH <>, slot WITH &&)
    WHERE (status <> 'cancelled'),

  -- a tutor is in one room at a time; same pair exception
  CONSTRAINT lessons_tutor_busy EXCLUDE USING gist
    (tutor_id WITH =, coalesce(pair_id, id) WITH <>, slot WITH &&)
    WHERE (status <> 'cancelled'),

  -- a student is in one place at a time; no exception
  CONSTRAINT lessons_student_busy EXCLUDE USING gist
    (student WITH =, slot WITH &&)
    WHERE (status <> 'cancelled')
);

-- append-only. after_cutoff = at > (date - 1 day) 16:00, computed in code.
CREATE TABLE lesson_events (
  id           bigserial PRIMARY KEY,
  lesson_id    text NOT NULL REFERENCES lessons(id),
  at           timestamp NOT NULL,
  kind         text NOT NULL CHECK (kind IN ('created','moved','cancelled','no_show')),
  before       jsonb,
  after        jsonb,
  after_cutoff boolean NOT NULL
);
```

Verify:

```
cd backend && mvn -q spring-boot:run
```

Expected: Flyway logs `Successfully applied 1 migration`, app starts on 8080. Stop it. Then:

```
docker compose exec db psql -U brightpath -c "\d lessons" | grep -c EXCLUDE
```

Expected: `3`.

This SQL was run verbatim against `postgres:16` on 2026-09-09 during planning.
It applies cleanly, and with three tutors inserted: an exam pair is accepted,
a student double fails on `lessons_student_busy`, a tutor double on
`lessons_tutor_busy`, a room clash on `lessons_room_busy`, a Monday row on
`lessons_closed_monday`, a cancelled row frees its slot, and back-to-back
lessons do not collide. Do not spend time re-testing the constraints by hand;
Phase 4 covers them.

Commit: `Spring Boot skeleton with the booking schema`
Body: Flyway V1 holds every rule the database owns: three EXCLUDE range constraints, closed Monday, duration and status checks. Clock is pinned to 2026-03-06 10:00. No JPA; the constraints are the model.

---

## Phase 2 · Service, repository, API (25 min)

Files, all under `backend/src/main/java/com/brightpath/booking/`:

```
Lesson.java          record: id, date, start, durationMin, end, student, tutorId, tutorName, roomId, status, pairId, note
NewLesson.java       record: @NotNull date, @NotNull start, @NotNull durationMin, @NotBlank student, @NotBlank tutorId, @NotBlank roomId, pairId, note
Refused.java         RuntimeException carrying List<String> reasons
LessonRepository.java
LessonService.java
ApiController.java
ApiErrors.java       @RestControllerAdvice
```

### LessonRepository (JdbcClient)

- `List<Lesson> byDate(LocalDate)` — join tutors for `tutor_name`, order by room_id, start_time.
- `long distinctBookingsForTutorOnDay(String tutorId, LocalDate date, String excludingKey)` —
  `SELECT count(DISTINCT coalesce(pair_id, id)) FROM lessons WHERE tutor_id=:t AND date=:d AND status<>'cancelled' AND coalesce(pair_id, id) <> :k`
- `List<Lesson> byPairId(String)`
- `String nextId()` — `'L' || nextval('lesson_seq')`
- `void insert(Lesson, LocalDateTime createdAt)` — inserts `lessons` row then a `lesson_events` row with kind `created`, `after = row as json`, `after_cutoff = createdAt > lesson.date.minusDays(1).atTime(16,0)`. Build the json with `ObjectMapper.writeValueAsString` and cast `::jsonb` in SQL.
- `List<Tutor> tutors()` — tiny record `Tutor(id, name, subject)`, can live inside the repository file.

### LessonService

```java
Lesson create(NewLesson in)                       // uses clock.now() as createdAt
Lesson create(NewLesson in, LocalDateTime createdAt) // used by the importer
```

`create`, in order:

1. `List<String> reasons = new ArrayList<>()`.
2. **Pair shape** (code rule): if `pairId != null`, load `byPairId`. If size ≥ 2: reason `exam pair {pairId} already has two students`. If size == 1 and the existing row differs in date, start, durationMin, tutorId or roomId: reason `exam pair must share tutor, room and time with {existing.id}`.
3. **Daily cap** (code rule): `distinctBookingsForTutorOnDay(tutorId, date, coalesce(pairId, "new"))`. If ≥ 6: reason `tutor {tutorId} already has 6 bookings on {date}`.
4. If reasons not empty: `throw new Refused(reasons)`.
5. `@Transactional` insert. Catch `DataIntegrityViolationException`, unwrap to `org.postgresql.util.PSQLException`, read `getServerErrorMessage().getConstraint()`, map:

| constraint | reason |
|---|---|
| `lessons_room_busy` | `room {roomId} is already taken at {start} on {date}` |
| `lessons_tutor_busy` | `tutor {tutorId} is already teaching at {start} on {date}` |
| `lessons_student_busy` | `{student} is already booked at {start} on {date}` |
| `lessons_closed_monday` | `{date} is a Monday, the centre is closed` |
| `lessons_duration_chk` | `duration must be 60 or 90 minutes` |
| anything else | rethrow |

Throw `Refused(List.of(reason))`.

Note: the DB rules are **not** pre-checked in code. That is deliberate (DECISIONS.md §3).

### ApiController

```
GET  /api/days/{date}   -> { "date": "...", "rooms": [ { "id": "R1", "lessons": [Lesson...] } ... ] }
                           all six rooms always present, in id order, even when empty
POST /api/lessons       -> 201 Lesson  |  409 { "reasons": [...] }  |  400 { "reasons": [...] }
GET  /api/tutors        -> [ { "id", "name", "subject" } ]
```

New lessons from the API are always `booked`; `status` is not accepted on input.

### ApiErrors

- `Refused` → 409 `{"reasons": [...]}`
- `MethodArgumentNotValidException` → 400 `{"reasons": ["student must not be blank", ...]}` built from field errors.

Verify (app running, DB empty):

```
curl -s localhost:8080/api/days/2026-03-06 | head -c 200
curl -s -X POST localhost:8080/api/lessons -H 'content-type: application/json' \
  -d '{"date":"2026-03-09","start":"10:00","durationMin":60,"student":"Test","tutorId":"T1","roomId":"R1"}'
```

Expected: first returns six rooms with empty lesson arrays. Second fails on the tutor foreign key because tutors are empty; that is fine here, the real check is Phase 3. If time allows, insert `T1` by psql and confirm the Monday POST returns `409 {"reasons":["2026-03-09 is a Monday, the centre is closed"]}`.

Commit: `Booking service and API: refuse conflicts with a reason`
Body: Daily cap and exam-pair shape are checked in code; overlap and closed-Monday come back from the database as constraint names and are mapped to plain-language reasons. 409 carries every reason found. DELETE deliberately absent.

Cut first if over budget: the 400 handler (let validation fall through as a default 400).

---

## Phase 3 · Seed importer (15 min)

File: `backend/src/main/java/com/brightpath/booking/SeedImporter.java`, an `ApplicationRunner`.

- Skip entirely if `SELECT count(*) FROM lessons` > 0.
- Read `${app.seed-dir}/tutors.csv` and `${app.seed-dir}/lessons_export.csv` with `Files.readAllLines`, skip header, `split(",", -1)`. No quoting in the data; do not add a CSV library.
- Insert tutors directly with JdbcClient.
- For each lesson row **in file order**:
  - `pairId = note.contains("exam pair") ? date + "_" + start + "_" + tutorId : null`
  - Build `NewLesson`, call `service.create(in, seedCreatedAt)`.
  - **Keep the original `lesson_id`**: add a package-private overload or a `preferredId` field so seed rows keep `L001`… New bookings from the API use `nextId()`.
  - Seed rows carry their `status` and `cancelled_at`: insert cancelled rows as `status='cancelled'` (they then take no slot because of the `WHERE` on the constraints) and add a second event `kind='cancelled'` at `cancelled_at`, `after_cutoff` computed from that time. `no_show` rows: status `no_show`, one `created` event only.
  - On `Refused`, collect `(lessonId, reasons)`.
- At the end, log at INFO, one line per refusal plus a summary:

```
Seed: 30 lessons loaded, 4 refused
Seed refused L008: Le Minh Chau is already booked at 09:00 on 2026-03-04
Seed refused L027: tutor T1 already has 6 bookings on 2026-03-06
Seed refused L032: 2026-03-09 is a Monday, the centre is closed
Seed refused L034: tutor T1 is already teaching at 09:00 on 2026-03-10
```

Verify:

```
docker compose down -v && docker compose up -d db && sleep 5
cd backend && mvn -q spring-boot:run 2>&1 | grep -E "^.*Seed"
```

Expected: exactly the five lines above (loaded count 30, refused 4, those four ids). If a different row is refused, the constraint or the order is wrong; fix, do not adjust the expectation. Copy the actual log lines into a scratch file for the README.

Then:

```
curl -s localhost:8080/api/days/2026-03-06 | python3 -m json.tool | grep -c '"id": "L'
```

Expected: `6` (L018, L021, L022, L024, L025, L026; L027 refused).

Commit: `Import the front-desk export through the same rules`
Body: Runs once on an empty database, in file order, first row wins. Refused rows are logged with the same reason the API would return. Exam pair is detected from the note.

---

## Phase 4 · One integration test (15 min)

File: `backend/src/test/java/com/brightpath/booking/BookingRulesTest.java`.

`@SpringBootTest` + `@Testcontainers` + `@Container @ServiceConnection static PostgreSQLContainer<?> db = new PostgreSQLContainer<>("postgres:16")`. Set `app.seed-dir` to the repo root via `@TestPropertySource(properties = "app.seed-dir=..")` so the importer runs against the container.

Tests, each a few lines, all against `LessonService` directly:

1. `seedRefusesExactlyTheFourKnownRows` — after startup, `lessons` has 30 rows and `L008, L027, L032, L034` are absent. (Expose the refusal list from `SeedImporter` as a field, or just assert absence.)
2. `studentCannotBeInTwoRooms` — create Le Minh Chau, 2026-03-06 14:30 R2 T2, then same student 14:30 R3 T3 → `Refused` with a reason containing `already booked`.
3. `examPairIsAllowed` — two lessons, same pairId, same tutor/room/time, different students → both succeed.
4. `seventhBookingIsRefused` — T1 on 2026-03-06 already has 6 after seed; one more → reason contains `already has 6`.
5. `mondayIsRefused` — 2026-03-09 → reason contains `Monday`.

Verify:

```
cd backend && mvn -q test
```

Expected: `Tests run: 5, Failures: 0`. Docker must be running for Testcontainers.

Commit: `Test the five rules against a real Postgres`
Body: One class, Testcontainers. The seed refusals are asserted by id so a change to a constraint that lets a bad row through fails the build.

Cut first if over budget: tests 2 and 5 (the seed test already covers both constraints).

---

## Phase 5 · React day grid (25 min)

From the repo root:

```
npm create vite@latest frontend -- --template react
cd frontend && npm install
```

Delete the scaffold's `App.css` contents and `assets/`. Files to write:

- `frontend/vite.config.js` — add `server: { proxy: { '/api': 'http://localhost:8080' } }`.
- `frontend/src/App.jsx` — the whole UI, target ≤ 180 lines.
- `frontend/src/App.css` — ≤ 80 lines, plain CSS, no library.

`App.jsx` behaviour:

- State: `date` (default `"2026-03-06"`), `day` (API response), `tutors`, `draft` (`null` or `{roomId, start}`), `reasons` (`[]`).
- On mount and when `date` changes: `GET /api/days/{date}` and `GET /api/tutors`.
- Header: title "Bright Path", `<input type="date">` bound to `date`, weekday name next to it.
- Grid: CSS grid, one row per room from the response (six), columns = 25 half-hour slots from 09:00 to 21:30. Time labels along the top every hour.
- Each lesson renders as a chip spanning `durationMin / 30` columns, showing student, tutor name, and `pair` when `pairId` set. Cancelled: dashed outline. No-show: faded.
- Clicking an empty cell sets `draft = {roomId, start}` and shows a small panel: student (text), tutor (select from `tutors`), duration (60/90), "exam pair" checkbox. When checked, `pairId = ${date}_${start}_${tutorId}`.
- Submit: `POST /api/lessons`. On 201: clear draft, refetch day. On 409 or 400: set `reasons`, render them in red inside the panel, keep the form.
- Nothing else. No routing, no cancel button, no edit.

Verify: backend running with seed, `npm run dev`, open `http://localhost:5173`.

- Friday 6 March shows six chips for Ngoc Anh across R1 and the others in R2/R3.
- Click R2 at 09:00, book "Le Minh Chau" with Pham Duc: refused, reason shown.
- Click R1 at 14:00 on 2026-03-07, book anyone with Ngoc Anh: accepted, chip appears.
- Change date to 2026-03-09: grid empty (Monday, nothing loaded). Booking refused with the Monday reason.

Commit: `Day grid: see today, click to book, see why a booking was refused`
Body: One page. The grid is the feature's only screen. Refusals are shown in place, not as an alert.

Cut first if over budget: the exam-pair checkbox (the API still supports it, the test covers it).

---

## Phase 6 · README and reflection (10 min)

Leave `README.txt` as received. Add `README.md` at root:

- One paragraph: what this is, link to `DECISIONS.md`, `docs/architecture.md`, `docs/proposal.html`.
- **Run it**, exactly:

```
docker compose up -d db
cd backend && mvn spring-boot:run          # applies schema, imports the export, port 8080
cd frontend && npm install && npm run dev  # port 5173, proxies /api
cd backend && mvn test                     # needs Docker for Testcontainers
```

- **What we saw when the export loaded**: paste the real five log lines from Phase 3.
- **Pinned date**: 2026-03-06 10:00, where it is set (`app.now`).
- **API** in five lines, and the rejected endpoint in one.

Then write **section 4 of `DECISIONS.md`**, replacing the placeholder, four short bullet lists:

- *Next with another week*: cancel and move endpoints on top of `lesson_events`, then the "what changed since 16:00" screen, then the tutor message text.
- *What is weak*: first-row-wins on import is arbitrary; the cap ignores late cancellations, which may be wrong; no auth; the grid is desktop only; `after_cutoff` is recorded but nothing reads it.
- *Where the AI assistant helped*: reading the brief and the data against each other, drafting the EXCLUDE constraints and the diagrams, generating the timetable in the proposal from the CSV. **The person submitting must rewrite this bullet in their own words before pushing.**
- *One suggestion thrown away*: pre-checking the overlap rules in Java before the insert. Rejected because it duplicates the constraint in a second place that can drift; the database already says no, and mapping its answer is enough.

Commit 1: `README: how to run it and what the import said`
Commit 2: `Close DECISIONS.md: next steps, weaknesses, what was thrown away`

Optional third commit if time remains: `Add build-plan.md used to drive the build` (this file), so the history shows the plan the code was built from.

---

## Definition of done

- `docker compose up -d db`, `mvn spring-boot:run`, `npm run dev` from a fresh clone works with no manual steps.
- Import log shows 30 loaded, 4 refused, the four ids above.
- `mvn test` green.
- Grid shows Friday 6 March on open; a refused booking shows its reason in place.
- Eight or more atomic commits, none squashed.
- `DECISIONS.md` section 4 written, AI bullet rewritten by the submitter.
