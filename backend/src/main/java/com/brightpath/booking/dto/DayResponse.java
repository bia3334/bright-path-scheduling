package com.brightpath.booking.dto;

import com.brightpath.booking.model.Lesson;

import java.time.LocalDate;
import java.util.List;

/** One day for the grid: every room, in order, even when empty. */
public record DayResponse(LocalDate date, List<Room> rooms) {
    public record Room(String id, List<Lesson> lessons) {}
}
