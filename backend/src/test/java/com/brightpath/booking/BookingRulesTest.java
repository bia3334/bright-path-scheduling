package com.brightpath.booking;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDate;
import java.time.LocalTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The five rules against a real Postgres, because three of them are database
 * constraints and an in-memory stand-in would not have them. The seed runs on
 * startup, so these tests also assert what the export did on the way in.
 */
@SpringBootTest
@Testcontainers
@TestPropertySource(properties = "app.seed-dir=..")
class BookingRulesTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> db = new PostgreSQLContainer<>("postgres:16");

    @Autowired LessonService service;
    @Autowired SeedImporter seed;
    @Autowired JdbcClient jdbc;

    /** Free slots used below: 2026-03-07 afternoon in R4/R5, which the export never touches. */
    private static NewLesson at(String date, String start, String student, String tutor, String room, String pairId) {
        return new NewLesson(LocalDate.parse(date), LocalTime.parse(start), 60,
            student, tutor, room, pairId, null);
    }

    @Test
    void seedRefusesExactlyTheFourKnownRows() {
        assertThat(seed.refused.keySet()).containsExactly("L008", "L027", "L032", "L034");
        assertThat(jdbc.sql("SELECT count(*) FROM lessons WHERE id IN ('L008','L027','L032','L034')")
            .query(Long.class).single()).isZero();
    }

    @Test
    void studentCannotBeInTwoRooms() {
        service.create(at("2026-03-07", "14:00", "Le Minh Chau", "T2", "R4", null));
        assertThatThrownBy(() -> service.create(at("2026-03-07", "14:00", "Le Minh Chau", "T3", "R5", null)))
            .isInstanceOf(Refused.class)
            .hasMessageContaining("already booked");
    }

    @Test
    void examPairIsAllowed() {
        String pair = "2026-03-07_16:00_T2";
        assertThat(service.create(at("2026-03-07", "16:00", "Pair One", "T2", "R5", pair)).pairId()).isEqualTo(pair);
        assertThat(service.create(at("2026-03-07", "16:00", "Pair Two", "T2", "R5", pair)).pairId()).isEqualTo(pair);
    }

    @Test
    void seventhBookingIsRefused() {
        // the export leaves T1 with six on Friday; L027 was the seventh and was refused
        assertThatThrownBy(() -> service.create(at("2026-03-06", "20:30", "One Too Many", "T1", "R6", null)))
            .isInstanceOf(Refused.class)
            .hasMessageContaining("already has 6");
    }

    @Test
    void mondayIsRefused() {
        assertThatThrownBy(() -> service.create(at("2026-03-09", "10:00", "Monday Hopeful", "T2", "R6", null)))
            .isInstanceOf(Refused.class)
            .hasMessageContaining("Monday");
    }
}
