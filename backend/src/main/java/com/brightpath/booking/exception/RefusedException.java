package com.brightpath.booking.exception;

import java.util.List;

/** A booking the rules do not allow. Carries every reason found; the API returns 409. */
public class RefusedException extends RuntimeException {
    private final List<String> reasons;

    public RefusedException(List<String> reasons) {
        super(String.join("; ", reasons));
        this.reasons = reasons;
    }

    public List<String> reasons() {
        return reasons;
    }
}
