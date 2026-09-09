package com.brightpath.booking;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.beans.factory.annotation.Value;

import java.time.*;

@SpringBootApplication
public class BookingApplication {

    public static void main(String[] args) {
        SpringApplication.run(BookingApplication.class, args);
    }

    @Bean
    Clock clock(@Value("${app.now}") LocalDateTime now) {
        var zone = ZoneId.of("Asia/Ho_Chi_Minh");
        return Clock.fixed(now.atZone(zone).toInstant(), zone);
    }
}
