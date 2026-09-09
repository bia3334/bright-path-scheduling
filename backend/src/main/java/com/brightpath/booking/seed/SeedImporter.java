package com.brightpath.booking.seed;

import com.brightpath.booking.repository.LessonRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

/**
 * On first start, when the lessons table is empty, loads tutors.csv and
 * lessons_export.csv from app.seed-dir. Later imports go through POST /api/import.
 */
@Component
public class SeedImporter implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SeedImporter.class);

    private final LessonRepository repo;
    private final CsvImporter importer;
    private final Path dir;
    private ImportReport report = new ImportReport(0, Map.of());

    public SeedImporter(LessonRepository repo, CsvImporter importer, @Value("${app.seed-dir}") String dir) {
        this.repo = repo;
        this.importer = importer;
        this.dir = Path.of(dir);
    }

    /** Rows the rules refused on the first-start import, by lesson id, in file order. */
    public Map<String, List<String>> refused() {
        return report.refused();
    }

    @Override
    public void run(ApplicationArguments args) throws IOException {
        if (repo.lessonCount() > 0) {
            log.info("Seed: lessons already present, skipping import");
            return;
        }
        report = importer.importCsv(
            Files.readAllLines(dir.resolve("tutors.csv")),
            Files.readAllLines(dir.resolve("lessons_export.csv")));
        log.info("Seed: {} lessons loaded, {} refused", report.loaded(), report.refused().size());
        report.refused().forEach((id, reasons) -> log.info("Seed refused {}: {}", id, String.join("; ", reasons)));
    }
}
