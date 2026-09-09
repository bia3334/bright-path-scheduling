package com.brightpath.booking;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record NewLesson(
    @NotNull(message = "date must not be null")
    java.time.LocalDate date,

    @NotNull(message = "start must not be null")
    java.time.LocalTime start,

    @NotNull(message = "duration must not be null")
    Integer durationMin,

    @NotBlank(message = "student must not be blank")
    String student,

    @NotBlank(message = "tutorId must not be blank")
    String tutorId,

    @NotBlank(message = "roomId must not be blank")
    String roomId,

    String pairId,
    String note
) {}
