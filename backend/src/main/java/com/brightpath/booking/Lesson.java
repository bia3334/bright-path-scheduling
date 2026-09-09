package com.brightpath.booking;

import java.time.LocalDate;
import java.time.LocalTime;

public record Lesson(
    String id,
    LocalDate date,
    LocalTime start,
    int durationMin,
    LocalTime end,
    String student,
    String tutorId,
    String tutorName,
    String roomId,
    String status,
    String pairId,
    String note
) {}
