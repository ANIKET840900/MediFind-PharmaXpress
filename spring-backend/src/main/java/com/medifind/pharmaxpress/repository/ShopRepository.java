package com.medifind.pharmaxpress.repository;

import com.medifind.pharmaxpress.model.Shop;
import com.medifind.pharmaxpress.model.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ShopRepository extends JpaRepository<Shop, Long> {
    List<Shop> findByOwner(UserAccount owner);
}