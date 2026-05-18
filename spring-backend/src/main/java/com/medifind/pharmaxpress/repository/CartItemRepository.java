package com.medifind.pharmaxpress.repository;

import com.medifind.pharmaxpress.model.CartItem;
import com.medifind.pharmaxpress.model.Medicine;
import com.medifind.pharmaxpress.model.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CartItemRepository extends JpaRepository<CartItem, Long> {
    List<CartItem> findByUserOrderByIdDesc(UserAccount user);
    Optional<CartItem> findByUserAndMedicine(UserAccount user, Medicine medicine);
    void deleteByUser(UserAccount user);
}