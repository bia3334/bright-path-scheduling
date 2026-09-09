package com.brightpath.booking.service;

import com.brightpath.booking.dto.NewLessonRequest;
import com.brightpath.booking.exception.RefusedException;
import com.brightpath.booking.model.Lesson;
import com.brightpath.booking.repository.LessonRepository;
import org.postgresql.util.PSQLException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Two rules live here because they are judgements over several rows: the daily cap
 * and the exam-pair shape. Every other rule is a database constraint; this class
 * only translates the constraint name into a reason. See DECISIONS.md section 3.
 */
@Service
@Transactional
public class LessonService {

    private final LessonRepository repo;
    private final Clock clock;

    public LessonService(LessonRepository repo, Clock clock) {
        this.repo = repo;
        this.clock = clock;
    }

    /** A live booking from the API. */
    public Lesson create(NewLessonRequest in) {
        return create(in, LocalDateTime.now(clock), null, "booked", null);
    }

    /**
     * Full form, used by the seed importer to keep the export's ids, statuses and
     * cancellation times. A cancelled row skips the occupancy rules: it holds no slot.
     */
    public Lesson create(NewLessonRequest in, LocalDateTime createdAt, String preferredId, String status, LocalDateTime cancelledAt) {
        boolean occupiesSlot = !"cancelled".equals(status) && cancelledAt == null;
        if (occupiesSlot) {
            List<String> reasons = new ArrayList<>();
            checkPairShape(in, reasons);
            checkDailyCap(in, reasons);
            if (!reasons.isEmpty()) throw new RefusedException(reasons);
        }

        // names are typed at the desk; store them trimmed, the DB matches them case-insensitively
        Lesson lesson = new Lesson(null, in.date(), in.start(), in.durationMin(),
            in.start().plusMinutes(in.durationMin()), in.student().strip(), in.tutorId(), null,
            in.roomId(), status, in.pairId(), in.note());

        String id;
        try {
            id = repo.insert(lesson, createdAt, preferredId, cancelledAt);
        } catch (DataIntegrityViolationException e) {
            throw new RefusedException(List.of(reasonFor(e, in)));
        }
        return repo.byId(id);
    }

    private void checkPairShape(NewLessonRequest in, List<String> reasons) {
        if (in.pairId() == null) return;
        List<Lesson> existing = repo.byPairId(in.pairId());
        if (existing.size() >= 2) {
            reasons.add("exam pair " + in.pairId() + " already has two students");
        } else if (existing.size() == 1) {
            Lesson other = existing.get(0);
            boolean same = other.date().equals(in.date()) && other.start().equals(in.start())
                && other.durationMin() == in.durationMin()
                && other.tutorId().equals(in.tutorId()) && other.roomId().equals(in.roomId());
            if (!same) reasons.add("exam pair must share tutor, room and time with " + other.id());
        }
    }

    private void checkDailyCap(NewLessonRequest in, List<String> reasons) {
        // joining an existing pair adds no booking, so that pair's key is not counted
        String excludeKey = in.pairId() != null ? in.pairId() : "new";
        if (repo.distinctBookingsForTutorOnDay(in.tutorId(), in.date(), excludeKey) >= 6) {
            reasons.add("tutor " + in.tutorId() + " already has 6 bookings on " + in.date());
        }
    }

    private String reasonFor(DataIntegrityViolationException e, NewLessonRequest in) {
        String constraint = e.getCause() instanceof PSQLException p && p.getServerErrorMessage() != null
            ? p.getServerErrorMessage().getConstraint() : null;
        if (constraint == null) throw e;
        return switch (constraint) {
            case "lessons_room_busy"     -> "room " + in.roomId() + " is already taken at " + in.start() + " on " + in.date();
            case "lessons_tutor_busy"    -> "tutor " + in.tutorId() + " is already teaching at " + in.start() + " on " + in.date();
            case "lessons_student_busy"  -> in.student().strip() + " is already booked at " + in.start() + " on " + in.date();
            case "lessons_closed_monday" -> in.date() + " is a Monday, the centre is closed";
            case "lessons_duration_chk"  -> "duration must be 60 or 90 minutes";
            default -> throw e;
        };
    }
}
