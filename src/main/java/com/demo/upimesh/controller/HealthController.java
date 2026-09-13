package com.demo.upimesh.controller;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Lightweight health-check controller for uptime monitoring (e.g. UptimeRobot).
 * Returns HTTP 200 with {"status":"healthy"} so monitors can verify the backend
 * is alive without touching the main dashboard or any database-heavy endpoints.
 */
@RestController
public class HealthController {

    @GetMapping(value = "/health", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("{\"status\":\"healthy\"}");
    }
}
