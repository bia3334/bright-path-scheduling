package com.brightpath.booking.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.brightpath.booking.model.Lesson;
import com.brightpath.booking.model.Tutor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@Repository
public class LessonRepository {

    private static final String SELECT = """
        SELECT l.id, l.date, l.start_time, l.duration_min, l.student,
               l.tutor_id, t.name AS tutor_name, l.room_id, l.status,
               l.pair_id, l.note
          FROM lessons l
          JOIN tutors t ON t.id = l.tutor_id
        """;

    private final JdbcClient jdbc;
    private final ObjectMapper mapper;

    public LessonRepository(JdbcClient jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public List<Lesson> byDate(LocalDate date) {
        return jdbc.sql(SELECT + " WHERE l.date = ? ORDER BY l.room_id, l.start_time")
            .param(date).query(mapLesson).list();
    }

    public Lesson byId(String id) {
        return jdbc.sql(SELECT + " WHERE l.id = ?").param(id).query(mapLesson).single();
    }

    public List<Lesson> byPairId(String pairId) {
        return jdbc.sql(SELECT + " WHERE l.pair_id = ?").param(pairId).query(mapLesson).list();
    }

    /** Bookings that occupy the tutor that day. Rows sharing a pair_id count once. */
    public long distinctBookingsForTutorOnDay(String tutorId, LocalDate date, String excludingKey) {
        return jdbc.sql("""
            SELECT count(DISTINCT coalesce(pair_id, id))
              FROM lessons
             WHERE tutor_id = ? AND date = ? AND status <> 'cancelled'
               AND coalesce(pair_id, id) <> ?
            """)
            .param(tutorId).param(date).param(excludingKey)
            .query(Long.class).single();
    }

    /**
     * Inserts the row and its created event. When cancelledAt is given the row is
     * stored as cancelled and a second event records the change. Returns the id.
     */
    public String insert(Lesson lesson, LocalDateTime createdAt, String preferredId, LocalDateTime cancelledAt) {
        String id = preferredId != null ? preferredId : "L" + jdbc.sql("SELECT nextval('lesson_seq')").query(Long.class).single();
        Lesson booked = withIdAndStatus(lesson, id, cancelledAt != null ? "cancelled" : lesson.status());

        jdbc.sql("""
            INSERT INTO lessons (id, date, start_time, duration_min, student, tutor_id, room_id,
                                 status, pair_id, note, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """)
            .param(id).param(booked.date()).param(booked.start()).param(booked.durationMin())
            .param(booked.student()).param(booked.tutorId()).param(booked.roomId())
            .param(booked.status()).param(booked.pairId()).param(booked.note())
            .param(createdAt).param(cancelledAt != null ? cancelledAt : createdAt)
            .update();

        Lesson asCreated = withIdAndStatus(lesson, id, "booked");
        event(id, createdAt, "created", null, asCreated, booked.date());
        if (cancelledAt != null) {
            event(id, cancelledAt, "cancelled", asCreated, booked, booked.date());
        }
        return id;
    }

    private void event(String lessonId, LocalDateTime at, String kind, Lesson before, Lesson after, LocalDate lessonDate) {
        boolean afterCutoff = at.isAfter(lessonDate.minusDays(1).atTime(16, 0));
        jdbc.sql("""
            INSERT INTO lesson_events (lesson_id, at, kind, before, after, after_cutoff)
            VALUES (?, ?, ?, ?::jsonb, ?::jsonb, ?)
            """)
            .param(lessonId).param(at).param(kind)
            .param(json(before)).param(json(after)).param(afterCutoff)
            .update();
    }

    private String json(Lesson l) {
        if (l == null) return null;
        try {
            return mapper.writeValueAsString(l);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private static Lesson withIdAndStatus(Lesson l, String id, String status) {
        return new Lesson(id, l.date(), l.start(), l.durationMin(), l.end(), l.student(),
            l.tutorId(), l.tutorName(), l.roomId(), status, l.pairId(), l.note());
    }

    public List<String> rooms() {
        return jdbc.sql("SELECT id FROM rooms ORDER BY id").query(String.class).list();
    }


    public List<Tutor> tutors() {
        return jdbc.sql("SELECT id, name, subject FROM tutors ORDER BY id").query(Tutor.class).list();
    }

    public void insertTutor(String id, String name, String subject, String phone) {
        jdbc.sql("INSERT INTO tutors (id, name, subject, phone) VALUES (?, ?, ?, ?)")
            .param(id).param(name).param(subject).param(phone).update();
    }

    public long lessonCount() {
        return jdbc.sql("SELECT count(*) FROM lessons").query(Long.class).single();
    }

    private static final RowMapper<Lesson> mapLesson = (rs, rn) -> {
        LocalTime start = rs.getObject("start_time", LocalTime.class);
        int dur = rs.getInt("duration_min");
        return new Lesson(
            rs.getString("id"),
            rs.getObject("date", LocalDate.class),
            start, dur, start.plusMinutes(dur),
            rs.getString("student"),
            rs.getString("tutor_id"),
            rs.getString("tutor_name"),
            rs.getString("room_id"),
            rs.getString("status"),
            rs.getString("pair_id"),
            rs.getString("note")
        );
    };
}
