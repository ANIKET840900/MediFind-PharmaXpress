package com.medifind.pharmaxpress.repository;

import com.medifind.pharmaxpress.model.Medicine;
import com.medifind.pharmaxpress.model.Shop;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MedicineRepository extends JpaRepository<Medicine, Long> {
    List<Medicine> findByShop(Shop shop);
}