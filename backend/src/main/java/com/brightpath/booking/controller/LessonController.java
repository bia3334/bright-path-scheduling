package com.brightpath.booking.controller;

import com.brightpath.booking.dto.DayResponse;
import com.brightpath.booking.dto.NewLessonRequest;
import com.brightpath.booking.model.Lesson;
import com.brightpath.booking.model.Tutor;
import com.brightpath.booking.repository.LessonRepository;
import com.brightpath.booking.service.LessonService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api")
public class LessonController {

    private final LessonService service;
    private final LessonRepository repo;

    public LessonController(LessonService service, LessonRepository repo) {
        this.service = service;
        this.repo = repo;
    }

    @GetMapping("/days/{date}")
    public DayResponse day(@PathVariable LocalDate date) {
        List<Lesson> lessons = repo.byDate(date);
        List<DayResponse.Room> rooms = repo.rooms().stream()
            .map(r -> new DayResponse.Room(r, lessons.stream().filter(l -> l.roomId().equals(r)).toList()))
            .toList();
        return new DayResponse(date, rooms);
    }

    @PostMapping("/lessons")
    @ResponseStatus(HttpStatus.CREATED)
    public Lesson create(@Valid @RequestBody NewLessonRequest in) {
        return service.create(in);
    }

    @GetMapping("/tutors")
    public List<Tutor> tutors() {
        return repo.tutors();
    }
}
