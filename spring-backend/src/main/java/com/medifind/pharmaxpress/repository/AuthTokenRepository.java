package com.medifind.pharmaxpress.repository;

import com.medifind.pharmaxpress.model.AuthToken;
import com.medifind.pharmaxpress.model.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AuthTokenRepository extends JpaRepository<AuthToken, Long> {
    Optional<AuthToken> findByToken(String token);
    void deleteByUser(UserAccount user);
}