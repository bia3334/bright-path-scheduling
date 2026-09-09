package com.brightpath.booking.seed;

import com.brightpath.booking.dto.NewLessonRequest;
import com.brightpath.booking.exception.RefusedException;
import com.brightpath.booking.repository.LessonRepository;
import com.brightpath.booking.service.LessonService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Imports the front-desk export format. Every lesson row goes through the same create
 * path as a live booking, in file order, so a row the rules refuse is reported with the
 * reason the API would give. First row wins. Nothing already in the database is touched:
 * a tutor that exists is kept, a lesson id that exists is refused.
 */
@Service
public class CsvImporter {

    private final LessonRepository repo;
    private final LessonService service;
    private final LocalDateTime createdAt;

    public CsvImporter(LessonRepository repo, LessonService service,
                       @Value("${app.seed-created-at}") LocalDateTime createdAt) {
        this.repo = repo;
        this.service = service;
        this.createdAt = createdAt;
    }

    /** Both arguments are whole CSV files including the header line; tutors may be empty. */
    public ImportReport importCsv(List<String> tutorLines, List<String> lessonLines) {
        for (String[] t : rows(tutorLines)) {
            repo.insertTutorIfAbsent(t[0], t[1], t[2], t[3]);
        }
        int loaded = 0;
        Map<String, List<String>> refused = new LinkedHashMap<>();
        for (String[] r : rows(lessonLines)) {
            // lesson_id,date,start_time,duration_min,student,tutor_id,room,status,cancelled_at,note
            String id = r[0], status = r[7], note = r[9];
            if (repo.exists(id)) {
                refused.put(id, List.of("lesson " + id + " is already in the system"));
                continue;
            }
            String pairId = note.contains("exam pair") ? r[1] + "_" + r[2] + "_" + r[5] : null;
            LocalDateTime cancelledAt = r[8].isBlank() ? null
                : OffsetDateTime.parse(r[8]).toLocalDateTime();
            NewLessonRequest in = new NewLessonRequest(LocalDate.parse(r[1]), LocalTime.parse(r[2]),
                Integer.parseInt(r[3]), r[4], r[5], r[6], pairId, note.isBlank() ? null : note);
            try {
                service.create(in, createdAt, id, status, cancelledAt);
                loaded++;
            } catch (RefusedException e) {
                refused.put(id, e.reasons());
            }
        }
        return new ImportReport(loaded, refused);
    }

    /** The export has no quoted fields, so a plain split is enough. Header line is skipped. */
    private static List<String[]> rows(List<String> lines) {
        List<String[]> out = new ArrayList<>();
        for (String line : lines.subList(Math.min(1, lines.size()), lines.size())) {
            if (!line.isBlank()) out.add(line.split(",", -1));
        }
        return out;
    }
}
