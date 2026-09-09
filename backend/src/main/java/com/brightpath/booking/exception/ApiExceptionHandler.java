package com.brightpath.booking.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

import java.util.List;
import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(RefusedException.class)
    ResponseEntity<Map<String, List<String>>> refused(RefusedException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("reasons", ex.reasons()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Map<String, List<String>>> invalid(MethodArgumentNotValidException ex) {
        List<String> reasons = ex.getBindingResult().getFieldErrors().stream()
            .map(fe -> fe.getDefaultMessage() != null ? fe.getDefaultMessage() : fe.getField() + " is invalid")
            .toList();
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("reasons", reasons));
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    ResponseEntity<Map<String, List<String>>> missingPart(MissingServletRequestPartException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(Map.of("reasons", List.of(ex.getRequestPartName() + " file is required")));
    }
}
