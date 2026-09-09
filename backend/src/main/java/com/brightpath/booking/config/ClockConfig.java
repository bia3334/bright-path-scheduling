package com.brightpath.booking.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;

/** "Now" is pinned to a moment inside the seed week (app.now). See DECISIONS.md. */
@Configuration
public class ClockConfig {

    @Bean
    Clock clock(@Value("${app.now}") LocalDateTime now) {
        ZoneId zone = ZoneId.of("Asia/Ho_Chi_Minh");
        return Clock.fixed(now.atZone(zone).toInstant(), zone);
    }
}
