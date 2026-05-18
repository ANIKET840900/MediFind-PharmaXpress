package com.medifind.pharmaxpress.util;

import org.springframework.data.domain.Page;

import java.util.LinkedHashMap;
import java.util.Map;

public final class ApiPage {
    private ApiPage() {
    }

    public static Map<String, Object> from(Page<?> page) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("count", page.getTotalElements());
        response.put("next", page.hasNext() ? page.getNumber() + 2 : null);
        response.put("previous", page.hasPrevious() ? page.getNumber() : null);
        response.put("results", page.getContent());
        return response;
    }
}
