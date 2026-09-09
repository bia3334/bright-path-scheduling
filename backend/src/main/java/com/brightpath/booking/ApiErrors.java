package com.brightpath.booking;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.List;
import java.util.Map;

@RestControllerAdvice
class ApiErrors {

    @ExceptionHandler(Refused.class)
    ResponseEntity<Map<String, List<String>>> refused(Refused ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(Map.of("reasons", ex.reasons()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Map<String, List<String>>> validation(MethodArgumentNotValidException ex) {
        List<String> reasons = ex.getBindingResult().getFieldErrors().stream()
            .map(fe -> fe.getDefaultMessage() != null ? fe.getDefaultMessage()
                : fe.getField() + " must not be blank")
            .toList();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(Map.of("reasons", reasons));
    }
}
