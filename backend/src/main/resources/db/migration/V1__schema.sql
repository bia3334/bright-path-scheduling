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
