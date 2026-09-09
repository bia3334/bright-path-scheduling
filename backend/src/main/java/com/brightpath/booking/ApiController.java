package com.brightpath.booking;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
class ApiController {

    record Room(String id, List<Lesson> lessons) {}
    record Day(LocalDate date, List<Room> rooms) {}

    private final LessonService service;
    private final LessonRepository repo;

    ApiController(LessonService service, LessonRepository repo) {
        this.service = service;
        this.repo = repo;
    }

    /** The grid: every room, in order, even when empty. */
    @GetMapping("/days/{date}")
    Day day(@PathVariable LocalDate date) {
        List<Lesson> lessons = repo.byDate(date);
        List<Room> rooms = repo.rooms().stream()
            .map(r -> new Room(r, lessons.stream().filter(l -> l.roomId().equals(r)).toList()))
            .toList();
        return new Day(date, rooms);
    }

    @PostMapping("/lessons")
    @ResponseStatus(HttpStatus.CREATED)
    Lesson create(@Valid @RequestBody NewLesson in) {
        return service.create(in);
    }

    @GetMapping("/tutors")
    List<LessonRepository.Tutor> tutors() {
        return repo.tutors();
    }
}
