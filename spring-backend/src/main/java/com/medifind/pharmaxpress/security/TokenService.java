package com.medifind.pharmaxpress.security;

import com.medifind.pharmaxpress.model.AuthToken;
import com.medifind.pharmaxpress.model.UserAccount;
import com.medifind.pharmaxpress.repository.AuthTokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TokenService {
    private final AuthTokenRepository authTokenRepository;

    public String createToken(UserAccount userAccount) {
        AuthToken token = AuthToken.builder()
                .token(UUID.randomUUID().toString().replace("-", ""))
                .user(userAccount)
                .createdAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60L * 60L * 24L * 30L))
                .build();
        authTokenRepository.save(token);
        return token.getToken();
    }

    public Optional<UserAccount> resolveUser(String tokenValue) {
        if (tokenValue == null || tokenValue.isBlank()) {
            return Optional.empty();
        }
        return authTokenRepository.findByToken(tokenValue.trim())
                .filter(token -> token.getExpiresAt() == null || token.getExpiresAt().isAfter(Instant.now()))
                .map(AuthToken::getUser);
    }

    public void revokeTokens(UserAccount userAccount) {
        authTokenRepository.deleteByUser(userAccount);
    }
}