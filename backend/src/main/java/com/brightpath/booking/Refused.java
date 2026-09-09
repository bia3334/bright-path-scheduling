package com.brightpath.booking;

import java.util.List;

public class Refused extends RuntimeException {
    private final List<String> reasons;

    public Refused(List<String> reasons) {
        super(String.join("; ", reasons));
        this.reasons = reasons;
    }

    public List<String> reasons() {
        return reasons;
    }
}
