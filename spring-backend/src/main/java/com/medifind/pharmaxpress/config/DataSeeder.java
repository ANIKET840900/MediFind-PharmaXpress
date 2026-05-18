package com.medifind.pharmaxpress.config;

import com.medifind.pharmaxpress.model.Medicine;
import com.medifind.pharmaxpress.model.Shop;
import com.medifind.pharmaxpress.model.UserAccount;
import com.medifind.pharmaxpress.model.UserProfile;
import com.medifind.pharmaxpress.model.UserRole;
import com.medifind.pharmaxpress.repository.MedicineRepository;
import com.medifind.pharmaxpress.repository.ShopRepository;
import com.medifind.pharmaxpress.repository.UserAccountRepository;
import com.medifind.pharmaxpress.repository.UserProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {
    private final UserAccountRepository userAccountRepository;
    private final UserProfileRepository userProfileRepository;
    private final ShopRepository shopRepository;
    private final MedicineRepository medicineRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.seed.enabled:false}")
    private boolean seedEnabled;

    @Override
    @Transactional
    public void run(String... args) {
        if (!seedEnabled || userAccountRepository.count() > 0) {
            return;
        }

        UserAccount admin = createUser("admin", "admin@pharmaxpress.local", "admin123", UserRole.ADMIN, true);
        UserAccount seller = createUser("seller", "seller@pharmaxpress.local", "seller123", UserRole.SELLER, false);
        createUser("buyer", "buyer@pharmaxpress.local", "buyer123", UserRole.BUYER, false);

        Shop shop = shopRepository.save(Shop.builder()
                .owner(seller)
                .name("PharmaXpress Central")
                .area("Mumbai")
                .state("Maharashtra")
                .gstNumber("27ABCDE1234F1Z5")
                .panNumber("ABCDE1234F")
                .bankAccountName("PharmaXpress Central")
                .bankAccountNumber("123456789012")
                .ifscCode("HDFC0001234")
                .kycVerified(true)
                .latitude(19.0760)
                .longitude(72.8777)
                .rating(4.6)
                .build());

        Medicine paracetamol = Medicine.builder()
                .shop(shop)
                .name("Paracetamol 650")
                .brand("Dolo")
                .category("Pain Relief")
                .description("Common fever and pain relief tablet.")
                .composition("Paracetamol 650mg")
                .price(32.0)
                .inStock(true)
                .build();
        paracetamol.setManufacturer("Micro Labs");
        paracetamol.setBatchNumber("DL650-A1");
        paracetamol.setExpiryDate("2027-12");
        paracetamol.setStockQuantity(120);
        medicineRepository.save(paracetamol);

        Medicine azithromycin = Medicine.builder()
                .shop(shop)
                .name("Azithromycin 500")
                .brand("Azimax")
                .category("Antibiotic")
                .description("Prescription antibiotic medicine.")
                .composition("Azithromycin 500mg")
                .prescriptionRequired(true)
                .price(118.0)
                .inStock(true)
                .build();
        azithromycin.setManufacturer("Cipla");
        azithromycin.setBatchNumber("AZ500-B2");
        azithromycin.setExpiryDate("2027-08");
        azithromycin.setStockQuantity(60);
        medicineRepository.save(azithromycin);

        admin.setFullName("PharmaXpress Admin");
        seller.setFullName("Demo Seller");
        userAccountRepository.save(admin);
        userAccountRepository.save(seller);
    }

    private UserAccount createUser(String username, String email, String password, UserRole role, boolean staff) {
        UserAccount user = userAccountRepository.save(UserAccount.builder()
                .username(username)
                .email(email)
                .passwordHash(passwordEncoder.encode(password))
                .role(role)
                .staff(staff)
                .build());
        userProfileRepository.save(UserProfile.builder()
                .user(user)
                .role(role)
                .emailVerified(true)
                .build());
        return user;
    }
}
