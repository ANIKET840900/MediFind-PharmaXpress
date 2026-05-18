package com.medifind.pharmaxpress.repository;

import com.medifind.pharmaxpress.model.Medicine;
import com.medifind.pharmaxpress.model.Prescription;
import com.medifind.pharmaxpress.model.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PrescriptionRepository extends JpaRepository<Prescription, Long> {
    List<Prescription> findByUserOrderByCreatedAtDesc(UserAccount user);
    List<Prescription> findByMedicineShopOwnerOrderByCreatedAtDesc(UserAccount owner);
    List<Prescription> findByMedicine(Medicine medicine);
}