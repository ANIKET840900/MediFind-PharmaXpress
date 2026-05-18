package com.medifind.pharmaxpress.repository;

import com.medifind.pharmaxpress.model.PaymentWebhookEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PaymentWebhookEventRepository extends JpaRepository<PaymentWebhookEvent, Long> {
    Optional<PaymentWebhookEvent> findByIdempotencyKey(String idempotencyKey);
}