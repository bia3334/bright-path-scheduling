# Bright Path booking

A take-home build for a small tutoring centre. It does one thing: it refuses a
booking that would put a student, a tutor or a room in two places at once, break
a tutor's six-a-day cap, or land on the closed Monday, and it says why in plain
language. The day grid is that feature's screen. Why this feature and not the
other five is in [DECISIONS.md](DECISIONS.md); the model and the request path are
drawn in [docs/architecture.md](docs/architecture.md); the same thing written for
a non-technical reader is [docs/proposal.html](docs/proposal.html), and the plan
the code was built from is [docs/build-plan.md](docs/build-plan.md).

Java 17, Spring Boot 3.3, Spring JDBC, Flyway, Postgres 16, React with Vite. No
JPA: the interesting rules are Postgres `EXCLUDE` constraints and an ORM would
only stand between them and the reasons the API returns.

## Run it

Short path, from the repo root:

```
./dev-up.sh          # Postgres in Docker, backend on 8080, frontend on 5173
./dev-down.sh        # stop them (--reset also drops the database volume)
```

`dev-up.sh` prints the seed lines from the backend log. Logs live in `.dev/`.

Long path, the same thing by hand:

```
docker compose up -d db
cd backend && mvn spring-boot:run          # applies schema, imports the export, port 8080
cd frontend && npm install && npm run dev  # port 5173, proxies /api
cd backend && mvn test                     # needs Docker for Testcontainers
```

Open http://localhost:5173. It opens on Friday 6 March 2026, the busiest day in
the export.

## What we saw when the export loaded

The importer runs every row of `lessons_export.csv` through the same rules a live
booking goes through, in file order, first row wins. Four rows in the front
desk's export break the rules, and the log says which and why:

```
Seed: 30 lessons loaded, 4 refused
Seed refused L008: Le Minh Chau is already booked at 09:00 on 2026-03-04
Seed refused L027: tutor T1 already has 6 bookings on 2026-03-06
Seed refused L032: 2026-03-09 is a Monday, the centre is closed
Seed refused L034: tutor T1 is already teaching at 09:00 on 2026-03-10
```

These are not made up for the demo: they are the double-booked student, the
seventh Friday lesson, the Monday lesson, and the tutor in two rooms that are
already in the data the centre sent. `mvn test` asserts these four ids, so a
constraint that stops working fails the build.

## Pinned date

"Now" is **2026-03-06 10:00 Asia/Ho_Chi_Minh**, the Friday of the seed week. It
is set in `backend/src/main/resources/application.yml` as `app.now` and reaches
the code as a fixed `java.time.Clock` bean, so nothing calls the real clock.
Seed rows are created at `app.seed-created-at`, 2026-03-02 12:00, as history.

## API

```
GET  /api/days/{date}   the day for the grid: every room, in order, even when empty
POST /api/lessons       create a booking; 201 with the lesson, or 409 {"reasons":[...]}
GET  /api/tutors        id, name and subject, for the booking form
```

400 `{"reasons":[...]}` when the body is missing a field. Every refusal, in code
or from a database constraint, comes back the same shape: a list of sentences a
receptionist can read out.

**Rejected: `DELETE /api/lessons/{id}`.** A booking a tutor was told about cannot
disappear; cancellation is a status and an event, never a removal.
