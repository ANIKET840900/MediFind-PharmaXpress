package com.medifind.pharmaxpress.service;

import com.medifind.pharmaxpress.model.UserAccount;
import com.medifind.pharmaxpress.model.UserProfile;
import com.medifind.pharmaxpress.model.UserRole;
import com.medifind.pharmaxpress.repository.UserAccountRepository;
import com.medifind.pharmaxpress.repository.UserProfileRepository;
import com.medifind.pharmaxpress.security.TokenService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserAccountRepository userAccountRepository;
    private final UserProfileRepository userProfileRepository;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokenService;

    @Transactional
    public Map<String, Object> signup(String username, String email, String password) {
        String normalizedUsername = username == null ? "" : username.trim();
        String normalizedEmail = email == null ? "" : email.trim().toLowerCase();
        if (normalizedUsername.isBlank() || normalizedEmail.isBlank() || password == null || password.isBlank()) {
            throw new IllegalArgumentException("Username, email, and password are required.");
        }
        if (userAccountRepository.existsByUsernameIgnoreCase(normalizedUsername)) {
            throw new IllegalArgumentException("Username already exists.");
        }
        if (userAccountRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new IllegalArgumentException("Email already exists.");
        }
        if (password.length() < 6) {
            throw new IllegalArgumentException("Password must be at least 6 characters.");
        }

        UserAccount userAccount = userAccountRepository.save(UserAccount.builder()
                .username(normalizedUsername)
                .email(normalizedEmail)
                .passwordHash(passwordEncoder.encode(password))
                .role(UserRole.BUYER)
                .build());

        userProfileRepository.save(UserProfile.builder().user(userAccount).build());

        Map<String, Object> response = new HashMap<>();
        response.put("detail", "Signup successful. Please sign in.");
        response.put("user", Map.of("id", userAccount.getId(), "username", userAccount.getUsername(), "email", userAccount.getEmail()));
        return response;
    }

    public Map<String, Object> login(String identifier, String password) {
        String loginKey = identifier == null ? "" : identifier.trim();
        if (loginKey.isBlank() || password == null || password.isBlank()) {
            throw new IllegalArgumentException("Username, email, or mobile number and password are required.");
        }

        UserAccount userAccount = userAccountRepository.findByUsernameIgnoreCase(loginKey)
                .or(() -> loginKey.contains("@") ? userAccountRepository.findByEmailIgnoreCase(loginKey) : java.util.Optional.empty())
                .or(() -> userProfileRepository.findByMobileNumber(loginKey).map(UserProfile::getUser))
                .orElseThrow(() -> new IllegalArgumentException("Invalid username/email/mobile number."));

        if (!passwordEncoder.matches(password, userAccount.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid password.");
        }

        String token = tokenService.createToken(userAccount);
        Map<String, Object> response = new HashMap<>();
        response.put("token", token);
        response.put("user", Map.of("id", userAccount.getId(), "username", userAccount.getUsername(), "email", userAccount.getEmail()));
        return response;
    }
}
