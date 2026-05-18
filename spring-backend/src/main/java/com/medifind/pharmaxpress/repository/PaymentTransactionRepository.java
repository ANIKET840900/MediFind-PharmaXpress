package com.medifind.pharmaxpress.repository;

import com.medifind.pharmaxpress.model.PaymentStatus;
import com.medifind.pharmaxpress.model.PaymentTransaction;
import com.medifind.pharmaxpress.model.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, Long> {
    List<PaymentTransaction> findByUserOrderByCreatedAtDesc(UserAccount user);
    Optional<PaymentTransaction> findFirstByUserAndGatewayOrderIdOrderByIdDesc(UserAccount user, String gatewayOrderId);
    Optional<PaymentTransaction> findFirstByGatewayOrderIdOrderByIdDesc(String gatewayOrderId);
    List<PaymentTransaction> findByStatusInAndCreatedAtBefore(List<PaymentStatus> statuses, Instant createdAt);
}