package io.secureai.backend.global.event;

import java.util.UUID;

public record GdprAccountDeletedEvent(UUID userId) {}
