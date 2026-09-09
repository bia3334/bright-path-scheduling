package com.brightpath.booking.seed;

import java.util.List;
import java.util.Map;

/** What an import did: rows loaded, and rows refused with the reasons, by lesson id in file order. */
public record ImportReport(int loaded, Map<String, List<String>> refused) {}
