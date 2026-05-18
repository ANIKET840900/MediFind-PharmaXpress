package com.medifind.pharmaxpress.repository;

import com.medifind.pharmaxpress.model.Order;
import com.medifind.pharmaxpress.model.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByUserOrderByCreatedAtDesc(UserAccount user);
}