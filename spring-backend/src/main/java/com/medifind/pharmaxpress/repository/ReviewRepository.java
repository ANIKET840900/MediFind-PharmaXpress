package com.medifind.pharmaxpress.repository;

import com.medifind.pharmaxpress.model.Medicine;
import com.medifind.pharmaxpress.model.Review;
import com.medifind.pharmaxpress.model.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReviewRepository extends JpaRepository<Review, Long> {
    List<Review> findByMedicineOrderByCreatedAtDesc(Medicine medicine);
    List<Review> findByUserOrderByCreatedAtDesc(UserAccount user);
    List<Review> findByMedicineShopOwnerOrderByCreatedAtDesc(UserAccount owner);
}