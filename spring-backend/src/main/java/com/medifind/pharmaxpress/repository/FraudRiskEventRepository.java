package com.medifind.pharmaxpress.repository;

import com.medifind.pharmaxpress.model.FraudRiskEvent;
import com.medifind.pharmaxpress.model.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FraudRiskEventRepository extends JpaRepository<FraudRiskEvent, Long> {
    List<FraudRiskEvent> findByUserOrderByCreatedAtDesc(UserAccount user);
}