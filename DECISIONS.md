# DECISIONS

Bright Path Learning Centre, take-home exercise 01.
Pinned "now": **2026-03-06 10:00 Asia/Ho_Chi_Minh** (Friday of the seed week, the busiest day in the export).

---

## 1. Read the situation

### Questions I would put to the owner first

| # | Question | If the answer is X | If the answer is Y |
|---|---|---|---|
| 1 | Is the "exam pair" (two students, one tutor, one room, one slot, half price) a real product or a rule Mai breaks? | Real product: I model it as an explicit `pair_id` and count the pair as one booking. **This is what I built.** | Rule break: the room and tutor overlap rules reject it, same as any other double booking. |
| 2 | When a **tutor** cancels inside 4 hours (L017, "tutor sick"), is the family charged? | No: cancellation needs a `cancelled_by` field and the charge rule only applies to `family`. | Yes: the rule is literal and the field is not needed. |
| 3 | L032 ran on a Monday, the closed day, "at the family's request". Does that happen with your blessing? | Never: closed Monday is a database constraint and the row is refused. **This is what I built.** | Sometimes: it becomes a warning on screen, not a constraint. |
| 4 | Does the 6-per-day cap count late cancellations, where the tutor is still paid? | Yes: cap counts everything not cancelled free. | No: cap counts rows with status `booked` or `no_show` only. **I assumed this.** |
| 5 | Does the tool send the WhatsApp messages, or does Mai keep doing that by hand? | Tool sends: the cut-off feature needs a message log and a delivery channel. | Mai sends: the tool only needs to show her what changed since cut-off. **I assumed this.** |
| 6 | The brief says 12 tutors and 6 rooms; the export has 3 of each. Is the export a slice, or is the brief out of date? | Slice: rooms and tutors are tables, not hard-coded lists. **I assumed this.** | Out of date: same design, smaller seed. |

### Where the brief does not hold together, and the reading I chose

- **"A room holds one lesson at a time" vs the exam pair.** The receptionist does it on purpose most weeks and the families like it. I read the pair as a legitimate exception that the system must name, not a violation. A pair is at most two students, same tutor, same room, same slot, and it counts once toward the tutor's daily cap.
- **The late-cancellation rule only imagines families cancelling.** L017 is a tutor calling in sick 1h20 before start. Charging the family under the literal rule is absurd. Reading: the 4-hour rule is about who initiated the cancellation. Not built, but the model leaves room for `cancelled_by`.
- **The cut-off rule needs to know when a booking was created or changed.** The export has no `created_at` or `updated_at`, so nothing in the data can say "changed after the tutor was told". Reading: the seed is imported as if created before the week, and every later change is an append-only event with a timestamp.
- **"Lessons run from mid-morning to mid-evening" is not a rule.** No times are given and L027 runs 20:30 to 21:30. Reading: not enforced anywhere.
- **"The smallest thing that takes the daily pain away" vs five rules plus messaging.** The brief lists more than one feature can hold. Reading: pick the one the owner called a dealbreaker (section 2).

### Assumptions I had to invent

- Timezone is Asia/Ho_Chi_Minh everywhere; times in the export are local wall-clock.
- A lesson occupies the half-open interval `[start, start + duration)`. Back-to-back lessons do not overlap.
- Seed rows are history, not requests. The importer applies the rules and reports what it refused instead of silently loading rule-breaking rows. First row wins when two rows conflict.
- The 16:00 cut-off for date D is `D-1 16:00`. A change to a lesson on D recorded after that instant is "after the tutor was told".
- The export's note column is free text. The importer only reads one phrase from it: `exam pair` marks the two paired rows.

---

## 2. Choose what to build

### Features this tool needs

1. **Conflict-safe booking**: refuse a booking that puts a student, tutor, or room in two places at once, breaks the 6-per-day cap, or lands on Monday. Exam pair as the named exception.
2. **Day view**: open the laptop and see today as a rooms-by-time grid. No scrolling.
3. **Cancellation with the 4-hour rule**: mark the lesson cancelled, record who cancelled and whether it is charged, free the room and slot.
4. **Change log after cut-off**: every move or cancellation after 16:00 the day before is listed so Mai knows exactly what to tell each tutor.
5. **Tutor daily message**: generate the text Mai pastes into WhatsApp, one per tutor, from the final schedule.
6. **Family waitlist**: when a slot frees, show which family asked for that time.

### The one I built, and why

**Feature 1, conflict-safe booking, with the day view as its screen.**

- It is the owner's stated dealbreaker: "if the system allows it, the system is broken."
- The seed week shows it happening three different ways: a student in two rooms (L007/L008), a tutor in two rooms (L033/L034), and a tutor with 7 bookings on Friday. It is not hypothetical.
- It is the only rule the database can make hard to break. Cancellation and cut-off are workflows on top of a booking store; this is the booking store.
- The day view is not a second feature. A booking is created by clicking an empty cell on today's grid, and a refused booking shows its reason in the same place. Without the grid the feature has no user.

### What stays broken by choosing it

- Cancellation still means editing status by hand. The 4-hour charge is not computed.
- Nothing tells Mai what changed after cut-off. Events are recorded (the model supports it) but there is no screen for them.
- Tutors still get their day by WhatsApp from Mai. Nothing is sent.
- No-shows are a status value with no behaviour.

---

## 3. Design and build that one

### Data model (the part this feature needs)

```
tutors        id, name, subject, phone
rooms         id                                  -- R1..R6 seeded
lessons       id, date, start_time, duration_min, student, tutor_id, room_id,
              status (booked|cancelled|no_show), pair_id, note,
              created_at, updated_at
              slot  = tsrange(date+start_time, date+start_time+duration)   -- generated
lesson_events id, lesson_id, at, kind (created|moved|cancelled|no_show),
              before (jsonb), after (jsonb), after_cutoff (bool)
```

**A booking cancelled or moved after the tutor was told** is a `lesson_events` row whose `after_cutoff` is true: `at > (lesson.date - 1 day) 16:00`. The `lessons` row always shows the current truth; the events row shows what the tutor was told before. Nothing is ever updated in place without an event, and nothing is deleted.

**Exam pair**: two lessons share a `pair_id`. The overlap rules treat rows with the same `pair_id` as one occupant of the room and tutor. The daily cap counts a pair once.

### Which rules live in the database, which in code, and why

| Rule | Where | Why |
|---|---|---|
| Room holds one lesson at a time | DB, `EXCLUDE` on `(room_id, slot)` ignoring same `pair_id` and cancelled rows | A range exclusion is exactly this rule, and it holds under concurrent requests and against anyone writing with psql. |
| Tutor in one room at a time | DB, `EXCLUDE` on `(tutor_id, slot)` same exceptions | Same reason. |
| Student in one place at a time | DB, `EXCLUDE` on `(student, slot)` ignoring cancelled | The owner's dealbreaker. Must survive any client. |
| Closed Monday | DB, `CHECK (extract(dow from date) <> 1)` | One line, no judgement needed. |
| Duration 60 or 90, status enum | DB, `CHECK` | Same. |
| Max 6 bookings per tutor per day | Code | It is an aggregate over rows, and "a pair counts once" is a business reading, not a shape. A trigger would hide that reading in SQL nobody will look at on Monday. |
| Exam pair is at most 2, same tutor, room, slot | Code | Same: judgement, not shape. |

The service does not pre-check the DB rules. It inserts and maps a violated constraint name to a reason. One place per rule.

### API shape

```
GET  /api/days/{date}          the day: lessons grouped by room, for the grid       BUILT
POST /api/lessons              create; 409 { reasons: [...] } when refused          BUILT
GET  /api/tutors               for the booking form                                  BUILT
POST /api/import               the export format, on demand; same rules, never deletes BUILT
POST /api/lessons/{id}/cancel  cancel, records event, charge decision                NOT BUILT
POST /api/lessons/{id}/move    move, records event with after_cutoff                 NOT BUILT
GET  /api/changes?since=       what to tell tutors                                   NOT BUILT
```

**Endpoint I rejected: `DELETE /api/lessons/{id}`.** A booking the tutor was told about cannot disappear. Deleting erases who was told what and whether the family owes money. Cancellation is a state and an event, never a removal.

### Stack

- Backend: Java 17, Spring Boot 3, Spring JDBC (`JdbcClient`), Flyway for schema. No JPA: the interesting rules are raw Postgres constraints and an ORM would only get in their way.
- Database: Postgres 16 in Docker (`btree_gist` for the exclusion constraints).
- Frontend: React 18 with Vite. One page, native `<input type="date">`, no component library.

---

## 4. Reflect

### Next, with another week

- `POST /api/lessons/{id}/cancel` and `/move` on top of `lesson_events`, with
  `cancelled_by` so the 4-hour charge can tell a family from a sick tutor.
- The "what changed since 16:00" screen. The events and the `after_cutoff` flag
  are already written on every insert; nothing reads them yet.
- The per-tutor message text Mai pastes into WhatsApp, generated from the day.

### What is weak

- First row wins on import is arbitrary. L008 is refused because L007 was read
  first; nobody at the centre chose that.
- The daily cap counts `booked` and `no_show` and ignores cancellations. If the
  tutor is still paid for a late cancellation, the cap is wrong (question 4).
- No authentication. Anyone who reaches port 8080 can book.
- The grid is desktop only. It does not fold below about 1200px.
- `after_cutoff` is recorded and never read.
- Cancelling still means editing a row by hand; there is no endpoint for it.

### Where the AI assistant helped

- Reading the brief and the export against each other, and finding the four rows
  that break the rules, was done by the assistant.
- The plan, the architecture diagrams and the proposal page were drafted by it.
- The code was written across several AI sessions and reviewed at each step:
  schema and service in the earlier ones, tests, the grid and this file in the
  last. Every phase was run and its output read before the next started.
- **The person submitting must rewrite this bullet in their own words before
  pushing.** It should say what they judged, not what the tool produced.

### One suggestion thrown away

Pre-checking the overlap rules in Java before the insert, so the API could
answer without touching the database. Rejected: it puts each rule in two places
that can drift, and it is a lie under concurrency, where only the constraint
decides. The database already says no with the constraint name; mapping that
name to a sentence is the whole job.
