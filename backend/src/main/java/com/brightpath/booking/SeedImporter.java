package com.brightpath.booking;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Loads tutors.csv and lessons_export.csv once, when the lessons table is empty.
 * Every row goes through the same create path as a live booking, in file order,
 * so a row the rules refuse is reported with the reason the API would give.
 * First row wins. Nothing is ever deleted; reset the database to import again.
 */
@Component
class SeedImporter implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SeedImporter.class);

    private final LessonRepository repo;
    private final LessonService service;
    private final Path dir;
    private final LocalDateTime createdAt;
    final Map<String, List<String>> refused = new LinkedHashMap<>();

    SeedImporter(LessonRepository repo, LessonService service,
                 @Value("${app.seed-dir}") String dir,
                 @Value("${app.seed-created-at}") LocalDateTime createdAt) {
        this.repo = repo;
        this.service = service;
        this.dir = Path.of(dir);
        this.createdAt = createdAt;
    }

    @Override
    public void run(ApplicationArguments args) throws IOException {
        if (repo.lessonCount() > 0) {
            log.info("Seed: lessons already present, skipping import");
            return;
        }
        for (String[] t : rows(dir.resolve("tutors.csv"))) {
            repo.insertTutor(t[0], t[1], t[2], t[3]);
        }
        int loaded = 0;
        for (String[] r : rows(dir.resolve("lessons_export.csv"))) {
            // lesson_id,date,start_time,duration_min,student,tutor_id,room,status,cancelled_at,note
            String id = r[0], status = r[7], note = r[9];
            String pairId = note.contains("exam pair") ? r[1] + "_" + r[2] + "_" + r[5] : null;
            LocalDateTime cancelledAt = r[8].isBlank() ? null
                : OffsetDateTime.parse(r[8]).toLocalDateTime();
            NewLesson in = new NewLesson(LocalDate.parse(r[1]), LocalTime.parse(r[2]),
                Integer.parseInt(r[3]), r[4], r[5], r[6], pairId, note.isBlank() ? null : note);
            try {
                service.create(in, createdAt, id, status, cancelledAt);
                loaded++;
            } catch (Refused e) {
                refused.put(id, e.reasons());
            }
        }
        log.info("Seed: {} lessons loaded, {} refused", loaded, refused.size());
        refused.forEach((id, reasons) -> log.info("Seed refused {}: {}", id, String.join("; ", reasons)));
    }

    /** The export has no quoted fields, so a plain split is enough. */
    private static List<String[]> rows(Path file) throws IOException {
        List<String[]> out = new ArrayList<>();
        List<String> lines = Files.readAllLines(file);
        for (String line : lines.subList(1, lines.size())) {
            if (!line.isBlank()) out.add(line.split(",", -1));
        }
        return out;
    }
}
