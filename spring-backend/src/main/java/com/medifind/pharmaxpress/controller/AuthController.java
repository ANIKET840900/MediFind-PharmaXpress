package com.medifind.pharmaxpress.controller;

import com.medifind.pharmaxpress.model.UserAccount;
import com.medifind.pharmaxpress.model.UserProfile;
import com.medifind.pharmaxpress.model.UserRole;
import com.medifind.pharmaxpress.repository.UserAccountRepository;
import com.medifind.pharmaxpress.repository.UserProfileRepository;
import com.medifind.pharmaxpress.security.TokenService;
import com.medifind.pharmaxpress.security.UserPrincipal;
import com.medifind.pharmaxpress.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Transactional
public class AuthController {
    private final AuthService authService;
    private final UserAccountRepository userAccountRepository;
    private final UserProfileRepository userProfileRepository;
    private final TokenService tokenService;
    private final PasswordEncoder passwordEncoder;

    @PostMapping("/signup/")
    public ResponseEntity<Map<String, Object>> signup(@RequestBody Map<String, String> payload) {
        return ResponseEntity.status(201).body(authService.signup(payload.get("username"), payload.get("email"), payload.get("password")));
    }

    @PostMapping("/login/")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, String> payload) {
        String identifier = payload.getOrDefault("identifier", payload.getOrDefault("username", payload.getOrDefault("email", "")));
        return ResponseEntity.ok(authService.login(identifier, payload.get("password")));
    }

    @PostMapping("/forgot-username/")
    public ResponseEntity<Map<String, Object>> forgotUsername(@RequestBody Map<String, String> payload) {
        String email = payload.getOrDefault("email", "").trim().toLowerCase();
        if (email.isBlank()) {
            throw new IllegalArgumentException("Email is required.");
        }
        UserAccount user = userAccountRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new IllegalArgumentException("No account found for that email address."));
        return ResponseEntity.ok(Map.of("username", user.getUsername()));
    }

    @PostMapping("/forgot-password/")
    public ResponseEntity<Map<String, String>> forgotPassword(@RequestBody Map<String, String> payload) {
        String username = payload.getOrDefault("username", "").trim();
        String email = payload.getOrDefault("email", "").trim().toLowerCase();
        String newPassword = payload.getOrDefault("new_password", "");
        if (username.isBlank() || email.isBlank() || newPassword.isBlank()) {
            throw new IllegalArgumentException("Username, email, and new password are required.");
        }
        UserAccount user = userAccountRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new IllegalArgumentException("Invalid username."));
        if (!user.getEmail().equalsIgnoreCase(email)) {
            throw new IllegalArgumentException("Invalid email for this username.");
        }
        if (newPassword.length() < 6) {
            throw new IllegalArgumentException("Password must be at least 6 characters.");
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userAccountRepository.save(user);
        tokenService.revokeTokens(user);
        return ResponseEntity.ok(Map.of("detail", "Password updated successfully. Please sign in again."));
    }

    @GetMapping("/me/")
    public ResponseEntity<Map<String, Object>> me(Authentication authentication) {
        UserAccount user = currentUser(authentication);
        var profile = userProfileRepository.findByUser(user).orElse(null);
        Map<String, Object> response = new HashMap<>();
        response.put("id", user.getId());
        response.put("full_name", user.getFullName());
        response.put("username", user.getUsername());
        response.put("email", user.getEmail());
        response.put("role", profile != null ? profile.getRole().name().toLowerCase() : user.getRole().name().toLowerCase());
        response.put("mobile_number", profile != null ? profile.getMobileNumber() : "");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/profile/")
    public ResponseEntity<Map<String, Object>> profile(Authentication authentication) {
        UserAccount user = currentUser(authentication);
        UserProfile profile = profileFor(user);
        Map<String, Object> response = new HashMap<>();
        response.put("username", user.getUsername());
        response.put("email", user.getEmail());
        response.put("role", profile.getRole().name().toLowerCase());
        response.put("mobile_number", profile.getMobileNumber());
        response.put("is_mobile_verified", profile.isMobileVerified());
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/profile/")
    public ResponseEntity<Map<String, Object>> updateProfile(Authentication authentication, @RequestBody Map<String, String> payload) {
        UserAccount user = currentUser(authentication);
        UserProfile profile = profileFor(user);

        String fullName = payload.getOrDefault("full_name", "").trim();
        String email = payload.getOrDefault("email", "").trim();
        String mobileNumber = payload.getOrDefault("mobile_number", "").trim();

        if (!fullName.isBlank()) {
            user.setFullName(fullName);
            userAccountRepository.save(user);
        }
        if (!email.isBlank()) {
            user.setEmail(email.toLowerCase());
            userAccountRepository.save(user);
        }
        if (!mobileNumber.isBlank()) {
            profile.setMobileNumber(mobileNumber);
            userProfileRepository.save(profile);
        }

        return profile(authentication);
    }

    @PostMapping("/assign-role/")
    public ResponseEntity<Map<String, Object>> assignRole(Authentication authentication, @RequestBody Map<String, String> payload) {
        UserAccount actor = currentUser(authentication);
        if (!actor.isStaff() && actor.getRole() != UserRole.ADMIN) {
            throw new org.springframework.security.access.AccessDeniedException("Only admin users can assign roles.");
        }
        String username = payload.getOrDefault("username", "").trim();
        String role = payload.getOrDefault("role", "").trim().toUpperCase();
        UserAccount target = userAccountRepository.findByUsernameIgnoreCase(username)
                .orElseThrow(() -> new IllegalArgumentException("User not found."));
        target.setRole(UserRole.valueOf(role));
        userAccountRepository.save(target);
        var profile = userProfileRepository.findByUser(target).orElseGet(() -> userProfileRepository.save(com.medifind.pharmaxpress.model.UserProfile.builder().user(target).build()));
        profile.setRole(target.getRole());
        userProfileRepository.save(profile);
        return ResponseEntity.ok(Map.of("detail", "Role updated successfully.", "username", target.getUsername(), "role", role.toLowerCase()));
    }

    @PostMapping("/logout/")
    public ResponseEntity<Map<String, String>> logout(Authentication authentication) {
        tokenService.revokeTokens(currentUser(authentication));
        SecurityContextHolder.clearContext();
        return ResponseEntity.ok(Map.of("detail", "Logged out successfully."));
    }

    private UserAccount currentUser(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof UserPrincipal principal)) {
            throw new AccessDeniedException("Authentication required.");
        }
        return principal.getUserAccount();
    }

    private UserProfile profileFor(UserAccount user) {
        return userProfileRepository.findByUser(user)
                .orElseGet(() -> userProfileRepository.save(UserProfile.builder()
                        .user(user)
                        .role(user.getRole())
                        .build()));
    }
}
