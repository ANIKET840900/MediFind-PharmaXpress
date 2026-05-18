package com.medifind.pharmaxpress.repository;

import com.medifind.pharmaxpress.model.Medicine;
import com.medifind.pharmaxpress.model.UserAccount;
import com.medifind.pharmaxpress.model.WishlistItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WishlistItemRepository extends JpaRepository<WishlistItem, Long> {
    List<WishlistItem> findByUserOrderByCreatedAtDesc(UserAccount user);
    Optional<WishlistItem> findByUserAndMedicine(UserAccount user, Medicine medicine);
}