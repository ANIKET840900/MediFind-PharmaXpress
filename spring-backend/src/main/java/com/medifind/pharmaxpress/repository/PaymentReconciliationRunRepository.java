package com.medifind.pharmaxpress.repository;

import com.medifind.pharmaxpress.model.PaymentReconciliationRun;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PaymentReconciliationRunRepository extends JpaRepository<PaymentReconciliationRun, Long> {
    List<PaymentReconciliationRun> findTop10ByOrderByCreatedAtDesc();
}