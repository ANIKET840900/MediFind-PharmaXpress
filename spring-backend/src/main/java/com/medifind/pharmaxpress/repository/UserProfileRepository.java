package com.medifind.pharmaxpress.repository;

import com.medifind.pharmaxpress.model.UserAccount;
import com.medifind.pharmaxpress.model.UserProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserProfileRepository extends JpaRepository<UserProfile, Long> {
    Optional<UserProfile> findByUser(UserAccount user);
    Optional<UserProfile> findByMobileNumber(String mobileNumber);
}
