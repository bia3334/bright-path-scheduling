package com.brightpath.booking.controller;

import com.brightpath.booking.seed.CsvImporter;
import com.brightpath.booking.seed.ImportReport;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api")
public class ImportController {

    private final CsvImporter importer;

    public ImportController(CsvImporter importer) {
        this.importer = importer;
    }

    /**
     * Multipart upload in the front-desk export format: "lessons" (lessons_export.csv,
     * required) and "tutors" (tutors.csv, optional). Adds what the rules allow and
     * reports every row it refused. Never deletes or overwrites.
     */
    @PostMapping("/import")
    public ImportReport importCsv(@RequestPart("lessons") MultipartFile lessons,
                                  @RequestPart(value = "tutors", required = false) MultipartFile tutors) throws IOException {
        return importer.importCsv(lines(tutors), lines(lessons));
    }

    private static List<String> lines(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) return List.of();
        return new String(file.getBytes(), StandardCharsets.UTF_8).lines().toList();
    }
}
