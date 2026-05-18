package com.medifind.pharmaxpress.repository;

import com.medifind.pharmaxpress.model.ReturnRequest;
import com.medifind.pharmaxpress.model.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReturnRequestRepository extends JpaRepository<ReturnRequest, Long> {
    List<ReturnRequest> findByUserOrderByCreatedAtDesc(UserAccount user);
}