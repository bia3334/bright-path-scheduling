# Architecture

Diagrams are Mermaid. GitHub renders them inline.

## C4 level 1: system context

```mermaid
C4Context
  title Bright Path scheduling tool, system context

  Person(mai, "Mai, receptionist", "Opens the laptop at 07:00, books lessons, tells tutors their day")
  Person(owner, "Owner", "Wants to see today at a glance and never see a double booking")
  Person(tutor, "Tutor", "Receives the day by WhatsApp, off-screen")

  System(tool, "Scheduling tool", "Shows the day as a rooms-by-time grid and refuses conflicting bookings")
  System_Ext(whatsapp, "WhatsApp", "Mai still sends messages by hand. Out of scope.")
  System_Ext(sheet, "Front-desk spreadsheet", "Source of the one-off seed export. Retired after import.")

  Rel(mai, tool, "Views a day, books a lesson", "browser")
  Rel(owner, tool, "Views today", "browser")
  Rel(sheet, tool, "CSV export loaded once as seed")
  Rel(mai, whatsapp, "Pastes each tutor's day")
  Rel(whatsapp, tutor, "Daily schedule")
```

## C4 level 2: containers

```mermaid
C4Container
  title Bright Path scheduling tool, containers

  Person(mai, "Mai / Owner", "browser")

  Container_Boundary(tool, "Scheduling tool") {
    Container(web, "Day grid", "React 18, Vite", "One page. Rooms by time. Click an empty cell to book, refused bookings show their reason in place.")
    Container(api, "Booking API", "Java 17, Spring Boot 3, Spring JDBC", "GET /api/days/{date}, POST /api/lessons, GET /api/tutors. Enforces the 6-per-day cap and exam-pair shape. Maps constraint names to 409 reasons.")
    ContainerDb(db, "Postgres 16", "Docker, btree_gist", "Owns the hard rules: EXCLUDE on room, tutor, student vs slot; CHECK closed Monday. Append-only lesson_events.")
  }

  System_Ext(csv, "lessons_export.csv + tutors.csv", "Seed, imported at first start through the same rules")

  Rel(mai, web, "Uses", "HTTPS")
  Rel(web, api, "JSON", "HTTP")
  Rel(api, db, "SQL", "JDBC")
  Rel(csv, api, "Read on startup when lessons is empty")
```

## Use cases

Mermaid has no use-case diagram type, so this is a flowchart in use-case shape.
Solid edges are built. Dashed edges are in the data model but have no code or screen.

```mermaid
flowchart LR
  mai(["Mai, receptionist"])
  owner(["Owner"])
  seed(["Seed importer"])

  subgraph system["Scheduling tool"]
    uc1(["See a day as a grid"])
    uc2(["Book a lesson"])
    uc3(["Book an exam pair"])
    uc4(["Be refused with a reason"])
    uc5(["Cancel a lesson"])
    uc6(["Move a lesson"])
    uc7(["See what changed after cut-off"])
    uc8(["Load the export, report refused rows"])
  end

  mai --> uc1
  mai --> uc2
  mai --> uc3
  owner --> uc1
  seed --> uc8
  uc2 -. includes .-> uc4
  uc3 -. includes .-> uc4
  uc8 -. includes .-> uc4
  mai -.-> uc5
  mai -.-> uc6
  mai -.-> uc7

  classDef later stroke-dasharray: 5 5,color:#777
  class uc5,uc6,uc7 later
```

| Use case | Actor | Rules exercised | Built |
|---|---|---|---|
| See a day as a grid | Mai, Owner | none, read only | yes |
| Book a lesson | Mai | room, tutor, student overlap; closed Monday; 6 per day | yes |
| Book an exam pair | Mai | same, with `pair_id` exception; pair max 2, same tutor/room/slot | yes |
| Be refused with a reason | system | constraint name to reason mapping | yes |
| Load the export | importer | all of the above, first row wins | yes |
| Cancel a lesson | Mai | 4-hour rule, who cancelled, after_cutoff event | model only |
| Move a lesson | Mai | overlap rules again, after_cutoff event | model only |
| See what changed after cut-off | Mai | events where after_cutoff | model only |

## Sequence: book a lesson

```mermaid
sequenceDiagram
  autonumber
  actor Mai
  participant Web as Day grid (React)
  participant API as Booking API (Spring)
  participant DB as Postgres

  Mai->>Web: click empty cell (room R1, 14:30)
  Web->>Mai: form: student, tutor, duration, exam pair?
  Mai->>Web: submit
  Web->>API: POST /api/lessons {date, start, duration, student, tutorId, roomId, pairId?}
  API->>DB: SELECT count of distinct bookings for tutor on date (pair counts once)
  DB-->>API: n
  alt n >= 6
    API-->>Web: 409 {reasons: ["tutor T1 already has 6 bookings on 2026-03-06"]}
  else
    API->>DB: BEGIN; INSERT INTO lessons ...; INSERT INTO lesson_events (created); COMMIT
    alt constraint violated
      DB-->>API: 23P01 exclusion / 23514 check, constraint name
      API->>API: map name to reason (room busy, tutor busy, student busy, closed Monday)
      API-->>Web: 409 {reasons: [...]}
    else
      DB-->>API: ok
      API-->>Web: 201 {lesson}
    end
  end
  Web->>API: GET /api/days/2026-03-06
  API->>DB: SELECT lessons for date, join tutors
  DB-->>API: rows
  API-->>Web: {rooms: [{id, lessons: [...]}]}
  Web-->>Mai: grid redrawn, refused booking shows its reason in the cell
```

## Sequence: seed import on first start

```mermaid
sequenceDiagram
  autonumber
  participant Boot as Spring startup
  participant Imp as SeedImporter
  participant Svc as LessonService
  participant DB as Postgres

  Boot->>DB: Flyway V1: tables, constraints, rooms R1..R6
  Boot->>Imp: run when lessons is empty
  Imp->>DB: INSERT tutors from tutors.csv
  loop each row of lessons_export.csv, in file order
    Imp->>Imp: note contains "exam pair" ? pairId = date+start+tutor : null
    Imp->>Svc: create(row, createdAt = 2026-03-02 12:00)
    Svc->>DB: INSERT lessons + lesson_events
    alt refused
      DB-->>Svc: constraint name
      Svc-->>Imp: reasons
      Imp->>Imp: append to refused list
    else
      DB-->>Svc: ok
    end
  end
  Imp-->>Boot: log: N loaded, M refused with lesson_id and reason
```

Expected refusals from the seed week, given first row wins:

| Row | Reason |
|---|---|
| L008 | student Le Minh Chau already in R3 with T3 at 09:00 (L007 wins) |
| L027 | tutor T1 already has 6 bookings on 2026-03-06 |
| L032 | 2026-03-09 is a Monday, the centre is closed |
| L034 | tutor T1 already in R1 at 09:00 (L033 wins) |

L009 and L010 load as one exam pair. L005 and L017 load as cancelled and take no room or tutor slot.
