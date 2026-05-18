package com.medifind.pharmaxpress.controller;

import com.medifind.pharmaxpress.model.Medicine;
import com.medifind.pharmaxpress.model.Shop;
import com.medifind.pharmaxpress.model.UserAccount;
import com.medifind.pharmaxpress.model.UserProfile;
import com.medifind.pharmaxpress.model.UserRole;
import com.medifind.pharmaxpress.repository.MedicineRepository;
import com.medifind.pharmaxpress.repository.ReviewRepository;
import com.medifind.pharmaxpress.repository.ShopRepository;
import com.medifind.pharmaxpress.repository.UserProfileRepository;
import com.medifind.pharmaxpress.security.UserPrincipal;
import com.medifind.pharmaxpress.util.ApiPage;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Transactional
public class CatalogController {
    private final ShopRepository shopRepository;
    private final MedicineRepository medicineRepository;
    private final ReviewRepository reviewRepository;
    private final UserProfileRepository userProfileRepository;

    @GetMapping("/shops/")
    public ResponseEntity<List<Map<String, Object>>> listShops(Authentication authentication,
                                                               @RequestParam(value = "mine", required = false) String mine,
                                                               @RequestParam(value = "page_size", required = false, defaultValue = "100") int pageSize,
                                                               @RequestParam(value = "page", required = false, defaultValue = "1") int page) {
        UserAccount user = isTruthy(mine) ? currentUser(authentication) : null;
        List<Shop> shops = isTruthy(mine)
                ? shopRepository.findByOwner(user)
                : shopRepository.findAll().stream().filter(this::isApprovedShop).toList();
        shops.sort(Comparator.comparing(Shop::getId).reversed());
        return ResponseEntity.ok(shops.stream().map(this::shopToMap).toList());
    }

    @GetMapping("/shops/{id}/")
    public ResponseEntity<Map<String, Object>> getShop(@PathVariable Long id) {
        return shopRepository.findById(id)
                .map(shop -> ResponseEntity.ok(shopToMap(shop)))
                .orElseThrow(() -> new IllegalArgumentException("Shop not found."));
    }

    @PostMapping("/shops/")
    public ResponseEntity<Map<String, Object>> createShop(Authentication authentication, @RequestBody Map<String, Object> payload) {
        UserAccount user = currentUser(authentication);
        ensureAdmin(user);

        Shop shop = Shop.builder()
                .owner(user)
                .name(stringValue(payload.get("name")))
                .area(stringValue(payload.get("area")))
                .state(stringValue(payload.getOrDefault("state", "")))
                .gstNumber(stringValue(payload.getOrDefault("gst_number", "")))
                .panNumber(stringValue(payload.getOrDefault("pan_number", "")))
                .bankAccountName(stringValue(payload.getOrDefault("bank_account_name", "")))
                .bankAccountNumber(stringValue(payload.getOrDefault("bank_account_number", "")))
                .ifscCode(stringValue(payload.getOrDefault("ifsc_code", "")))
                .latitude(doubleValue(payload.get("latitude")))
                .longitude(doubleValue(payload.get("longitude")))
                .rating(optionalDouble(payload.get("rating")).orElse(4.0d))
                .kycVerified(booleanValue(payload.getOrDefault("is_kyc_verified", payload.getOrDefault("kyc_verified", false))))
                .build();

        if (shop.getName().isBlank() || shop.getArea().isBlank()) {
            throw new IllegalArgumentException("Shop name and area are required.");
        }

        shop.setApprovalStatus("APPROVED");
        return ResponseEntity.status(201).body(shopToMap(shopRepository.save(shop)));
    }

    @PostMapping("/shops/{id}/approval/")
    public ResponseEntity<Map<String, Object>> updateShopApproval(Authentication authentication, @PathVariable Long id, @RequestBody Map<String, Object> payload) {
        UserAccount user = currentUser(authentication);
        ensureAdmin(user);
        Shop shop = shopRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Shop not found."));
        String status = stringValue(payload.getOrDefault("status", "")).toUpperCase();
        if (!List.of("APPROVED", "PENDING", "REJECTED").contains(status)) {
            throw new IllegalArgumentException("Approval status must be APPROVED, PENDING, or REJECTED.");
        }
        shop.setApprovalStatus(status);
        shop.setApprovalNote(stringValue(payload.getOrDefault("note", "")));
        if ("APPROVED".equals(status)) {
            shop.setKycVerified(true);
        }
        return ResponseEntity.ok(shopToMap(shopRepository.save(shop)));
    }

    @PatchMapping("/shops/{id}/")
    public ResponseEntity<Map<String, Object>> updateShop(Authentication authentication, @PathVariable Long id, @RequestBody Map<String, Object> payload) {
        UserAccount user = currentUser(authentication);
        Shop shop = shopRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Shop not found."));
        if (!shop.getOwner().getId().equals(user.getId()) && !isAdmin(user)) {
            throw new AccessDeniedException("You can only update your own shop.");
        }

        updateIfPresent(payload, "name", shop::setName);
        updateIfPresent(payload, "area", shop::setArea);
        updateIfPresent(payload, "state", shop::setState);
        updateIfPresent(payload, "gst_number", shop::setGstNumber);
        updateIfPresent(payload, "pan_number", shop::setPanNumber);
        updateIfPresent(payload, "bank_account_name", shop::setBankAccountName);
        updateIfPresent(payload, "bank_account_number", shop::setBankAccountNumber);
        updateIfPresent(payload, "ifsc_code", shop::setIfscCode);
        if (payload.containsKey("latitude")) {
            shop.setLatitude(doubleValue(payload.get("latitude")));
        }
        if (payload.containsKey("longitude")) {
            shop.setLongitude(doubleValue(payload.get("longitude")));
        }
        if (payload.containsKey("rating")) {
            shop.setRating(optionalDouble(payload.get("rating")).orElse(shop.getRating()));
        }
        if (payload.containsKey("is_kyc_verified") || payload.containsKey("kyc_verified")) {
            shop.setKycVerified(booleanValue(payload.containsKey("is_kyc_verified") ? payload.get("is_kyc_verified") : payload.get("kyc_verified")));
        }

        return ResponseEntity.ok(shopToMap(shopRepository.save(shop)));
    }

    @DeleteMapping("/shops/{id}/")
    public ResponseEntity<Map<String, String>> deleteShop(Authentication authentication, @PathVariable Long id) {
        UserAccount user = currentUser(authentication);
        Shop shop = shopRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Shop not found."));
        if (!shop.getOwner().getId().equals(user.getId()) && !isAdmin(user)) {
            throw new AccessDeniedException("You can only delete your own shop.");
        }
        shopRepository.delete(shop);
        return ResponseEntity.ok(Map.of("detail", "Shop deleted successfully."));
    }

    @GetMapping("/medicines/")
    public ResponseEntity<Map<String, Object>> listMedicines(Authentication authentication,
                                                             @RequestParam(value = "mine", required = false) String mine,
                                                             @RequestParam(value = "q", required = false, defaultValue = "") String q,
                                                             @RequestParam(value = "in_stock", required = false) String inStock,
                                                             @RequestParam(value = "shop", required = false) Long shopId,
                                                             @RequestParam(value = "category", required = false, defaultValue = "") String category,
                                                             @RequestParam(value = "brand", required = false, defaultValue = "") String brand,
                                                             @RequestParam(value = "min_price", required = false) Double minPrice,
                                                             @RequestParam(value = "max_price", required = false) Double maxPrice,
                                                             @RequestParam(value = "min_rating", required = false) Double minRating,
                                                             @RequestParam(value = "sort", required = false, defaultValue = "") String sort,
                                                             @RequestParam(value = "near_lat", required = false) Double nearLat,
                                                             @RequestParam(value = "near_lng", required = false) Double nearLng,
                                                             @RequestParam(value = "radius_km", required = false) Double radiusKm,
                                                             @RequestParam(value = "page_size", required = false, defaultValue = "100") int pageSize,
                                                             @RequestParam(value = "page", required = false, defaultValue = "1") int page) {
        UserAccount user = isTruthy(mine) ? currentUser(authentication) : null;
        List<Medicine> medicines = medicineRepository.findAll();
        if (!isTruthy(mine)) {
            medicines = medicines.stream().filter(medicine -> isApprovedShop(medicine.getShop())).toList();
        }
        if (isTruthy(mine)) {
            medicines = medicines.stream().filter(medicine -> medicine.getShop().getOwner().getId().equals(user.getId())).toList();
        }

        String query = q == null ? "" : q.trim().toLowerCase();
        String categoryFilter = category == null ? "" : category.trim().toLowerCase();
        String brandFilter = brand == null ? "" : brand.trim().toLowerCase();
        String sortValue = sort == null ? "" : sort.trim().toLowerCase();

        List<Map<String, Object>> mapped = new ArrayList<>();
        for (Medicine medicine : medicines) {
            if (!query.isBlank() && !containsAny(medicine, query)) {
                continue;
            }
            if (!categoryFilter.isBlank() && !contains(medicine.getCategory(), categoryFilter)) {
                continue;
            }
            if (!brandFilter.isBlank() && !contains(medicine.getBrand(), brandFilter)) {
                continue;
            }
            if (minPrice != null && medicine.getPrice() < minPrice) {
                continue;
            }
            if (maxPrice != null && medicine.getPrice() > maxPrice) {
                continue;
            }
            if (minRating != null && safeRating(medicine) < minRating) {
                continue;
            }
            if (inStock != null && !inStock.isBlank()) {
                boolean stock = Boolean.parseBoolean(inStock);
                if (medicine.isInStock() != stock) {
                    continue;
                }
            }
            if (shopId != null && !medicine.getShop().getId().equals(shopId)) {
                continue;
            }
            if (nearLat != null && nearLng != null) {
                if (medicine.getShop().getLatitude() == null || medicine.getShop().getLongitude() == null) {
                    continue;
                }
                double distance = haversineDistanceKm(nearLat, nearLng, medicine.getShop().getLatitude(), medicine.getShop().getLongitude());
                if (radiusKm != null && distance > radiusKm) {
                    continue;
                }
                mapped.add(medicineToMap(medicine, distance));
            } else {
                mapped.add(medicineToMap(medicine, null));
            }
        }

        mapped.sort((left, right) -> {
            if ("price_asc".equals(sortValue)) {
                return Double.compare(asDouble(left.get("price")), asDouble(right.get("price")));
            }
            if ("price_desc".equals(sortValue)) {
                return Double.compare(asDouble(right.get("price")), asDouble(left.get("price")));
            }
            if ("rating_desc".equals(sortValue)) {
                return Double.compare(asDouble(right.get("average_rating")), asDouble(left.get("average_rating")));
            }
            if ("name_asc".equals(sortValue)) {
                return stringValue(left.get("name")).compareToIgnoreCase(stringValue(right.get("name")));
            }
            if ("distance_asc".equals(sortValue)) {
                return Double.compare(asDouble(left.getOrDefault("distance_km", Double.POSITIVE_INFINITY)), asDouble(right.getOrDefault("distance_km", Double.POSITIVE_INFINITY)));
            }
            return stringValue(left.get("name")).compareToIgnoreCase(stringValue(right.get("name")));
        });

        return ResponseEntity.ok(ApiPage.from(slice(mapped, page, pageSize).toPage()));
    }

    @GetMapping("/medicines/suggestions/")
    public ResponseEntity<List<String>> suggestions(@RequestParam(value = "q", defaultValue = "") String query) {
        String normalized = query.trim().toLowerCase();
        if (normalized.isBlank()) {
            return ResponseEntity.ok(List.of());
        }
        List<String> suggestions = medicineRepository.findAll().stream()
                .filter(medicine -> containsAny(medicine, normalized))
                .map(Medicine::getName)
                .distinct()
                .sorted(String::compareToIgnoreCase)
                .limit(8)
                .toList();
        return ResponseEntity.ok(suggestions);
    }

    @GetMapping("/medicines/{id}/")
    public ResponseEntity<Map<String, Object>> getMedicine(@PathVariable Long id) {
        Medicine medicine = medicineRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Medicine not found."));
        return ResponseEntity.ok(medicineToMap(medicine, null));
    }

    @PostMapping("/medicines/")
    public ResponseEntity<Map<String, Object>> createMedicine(Authentication authentication, @RequestBody Map<String, Object> payload) {
        UserAccount user = currentUser(authentication);
        Long shopId = longValue(payload.get("shop"));
        if (shopId == null) {
            throw new IllegalArgumentException("Shop is required.");
        }
        Shop shop = shopRepository.findById(shopId).orElseThrow(() -> new IllegalArgumentException("Shop not found."));
        if (!shop.getOwner().getId().equals(user.getId())) {
            throw new AccessDeniedException("You can only add medicines to your own shop.");
        }
        if (!isApprovedShop(shop)) {
            throw new AccessDeniedException("Your shop must be admin-approved before adding medicines.");
        }

        Medicine medicine = Medicine.builder()
                .shop(shop)
                .name(stringValue(payload.get("name")))
                .brand(stringValue(payload.getOrDefault("brand", "")))
                .category(stringValue(payload.getOrDefault("category", "General")))
                .description(stringValue(payload.getOrDefault("description", "")))
                .composition(stringValue(payload.getOrDefault("composition", "")))
                .prescriptionRequired(booleanValue(payload.getOrDefault("prescription_required", payload.getOrDefault("prescriptionRequired", false))))
                .price(optionalDouble(payload.get("price")).orElseThrow(() -> new IllegalArgumentException("Price is required.")))
                .inStock(booleanValue(payload.getOrDefault("in_stock", payload.getOrDefault("inStock", true))))
                .build();
        applyInventoryFields(medicine, payload);

        if (medicine.getName().isBlank()) {
            throw new IllegalArgumentException("Medicine name is required.");
        }
        return ResponseEntity.status(201).body(medicineToMap(medicineRepository.save(medicine), null));
    }

    @PatchMapping("/medicines/{id}/")
    public ResponseEntity<Map<String, Object>> updateMedicine(Authentication authentication, @PathVariable Long id, @RequestBody Map<String, Object> payload) {
        UserAccount user = currentUser(authentication);
        Medicine medicine = medicineRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Medicine not found."));
        if (!medicine.getShop().getOwner().getId().equals(user.getId())) {
            throw new AccessDeniedException("You can only assign medicines to your own shop.");
        }
        if (payload.containsKey("shop")) {
            Long shopId = longValue(payload.get("shop"));
            if (shopId != null) {
                Shop shop = shopRepository.findById(shopId).orElseThrow(() -> new IllegalArgumentException("Shop not found."));
                if (!shop.getOwner().getId().equals(user.getId())) {
                    throw new AccessDeniedException("You can only assign medicines to your own shop.");
                }
                medicine.setShop(shop);
            }
        }
        updateIfPresent(payload, "name", medicine::setName);
        updateIfPresent(payload, "brand", medicine::setBrand);
        updateIfPresent(payload, "category", medicine::setCategory);
        updateIfPresent(payload, "description", medicine::setDescription);
        updateIfPresent(payload, "composition", medicine::setComposition);
        if (payload.containsKey("prescription_required") || payload.containsKey("prescriptionRequired")) {
            medicine.setPrescriptionRequired(booleanValue(payload.containsKey("prescription_required") ? payload.get("prescription_required") : payload.get("prescriptionRequired")));
        }
        if (payload.containsKey("price")) {
            medicine.setPrice(optionalDouble(payload.get("price")).orElse(medicine.getPrice()));
        }
        if (payload.containsKey("in_stock") || payload.containsKey("inStock")) {
            medicine.setInStock(booleanValue(payload.containsKey("in_stock") ? payload.get("in_stock") : payload.get("inStock")));
        }
        applyInventoryFields(medicine, payload);
        return ResponseEntity.ok(medicineToMap(medicineRepository.save(medicine), null));
    }

    @DeleteMapping("/medicines/{id}/")
    public ResponseEntity<Map<String, String>> deleteMedicine(Authentication authentication, @PathVariable Long id) {
        UserAccount user = currentUser(authentication);
        Medicine medicine = medicineRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Medicine not found."));
        if (!medicine.getShop().getOwner().getId().equals(user.getId())) {
            throw new AccessDeniedException("You can only delete medicines from your own shop.");
        }
        medicineRepository.delete(medicine);
        return ResponseEntity.ok(Map.of("detail", "Medicine deleted successfully."));
    }

    private UserAccount currentUser(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof UserPrincipal principal)) {
            throw new AccessDeniedException("Authentication required.");
        }
        return principal.getUserAccount();
    }

    private void ensureAdmin(UserAccount user) {
        if (!isAdmin(user)) {
            throw new AccessDeniedException("Only admin users can perform this action.");
        }
    }

    private boolean isAdmin(UserAccount user) {
        UserProfile profile = userProfileRepository.findByUser(user).orElse(null);
        UserRole role = profile != null ? profile.getRole() : user.getRole();
        return user.isStaff() || role == UserRole.ADMIN;
    }

    private boolean isApprovedShop(Shop shop) {
        String status = Optional.ofNullable(shop.getApprovalStatus()).orElse("APPROVED");
        return "APPROVED".equalsIgnoreCase(status);
    }

    private Map<String, Object> shopToMap(Shop shop) {
        Map<String, Object> mapped = new HashMap<>();
        mapped.put("id", shop.getId());
        mapped.put("owner", shop.getOwner().getId());
        mapped.put("name", shop.getName());
        mapped.put("area", shop.getArea());
        mapped.put("state", Optional.ofNullable(shop.getState()).orElse(""));
        mapped.put("gst_number", Optional.ofNullable(shop.getGstNumber()).orElse(""));
        mapped.put("pan_number", Optional.ofNullable(shop.getPanNumber()).orElse(""));
        mapped.put("bank_account_name", Optional.ofNullable(shop.getBankAccountName()).orElse(""));
        mapped.put("bank_account_number", Optional.ofNullable(shop.getBankAccountNumber()).orElse(""));
        mapped.put("ifsc_code", Optional.ofNullable(shop.getIfscCode()).orElse(""));
        mapped.put("is_kyc_verified", shop.isKycVerified());
        mapped.put("approval_status", Optional.ofNullable(shop.getApprovalStatus()).orElse("APPROVED").toLowerCase());
        mapped.put("approval_note", Optional.ofNullable(shop.getApprovalNote()).orElse(""));
        mapped.put("latitude", shop.getLatitude());
        mapped.put("longitude", shop.getLongitude());
        mapped.put("rating", shop.getRating());
        mapped.put("medicines", List.of());
        return mapped;
    }

    private Map<String, Object> medicineToMap(Medicine medicine, Double distanceKm) {
        Map<String, Object> mapped = new HashMap<>();
        mapped.put("id", medicine.getId());
        mapped.put("shop", medicine.getShop().getId());
        mapped.put("shop_name", medicine.getShop().getName());
        mapped.put("shop_area", medicine.getShop().getArea());
        mapped.put("shop_state", Optional.ofNullable(medicine.getShop().getState()).orElse(""));
        mapped.put("shop_latitude", medicine.getShop().getLatitude());
        mapped.put("shop_longitude", medicine.getShop().getLongitude());
        mapped.put("shop_rating", medicine.getShop().getRating());
        mapped.put("name", medicine.getName());
        mapped.put("brand", Optional.ofNullable(medicine.getBrand()).orElse(""));
        mapped.put("category", Optional.ofNullable(medicine.getCategory()).orElse("General"));
        mapped.put("description", Optional.ofNullable(medicine.getDescription()).orElse(""));
        mapped.put("composition", Optional.ofNullable(medicine.getComposition()).orElse(""));
        mapped.put("prescription_required", medicine.isPrescriptionRequired());
        mapped.put("price", medicine.getPrice());
        mapped.put("image_url", imageUrlFor(medicine));
        mapped.put("stock_quantity", Optional.ofNullable(medicine.getStockQuantity()).orElse(0));
        mapped.put("batch_number", Optional.ofNullable(medicine.getBatchNumber()).orElse(""));
        mapped.put("manufacturer", Optional.ofNullable(medicine.getManufacturer()).orElse(""));
        mapped.put("expiry_date", Optional.ofNullable(medicine.getExpiryDate()).orElse(""));
        mapped.put("average_rating", averageRatingFor(medicine));
        mapped.put("rating_count", ratingCountFor(medicine));
        mapped.put("in_stock", medicine.isInStock());
        if (distanceKm != null) {
            mapped.put("distance_km", round(distanceKm));
        }
        return mapped;
    }

    private double averageRatingFor(Medicine medicine) {
        var reviews = reviewRepository.findByMedicineOrderByCreatedAtDesc(medicine);
        if (reviews.isEmpty()) {
            return round(Optional.ofNullable(medicine.getShop().getRating()).orElse(0d));
        }
        return round(reviews.stream().mapToInt(review -> review.getRating() == null ? 0 : review.getRating()).average().orElse(0d));
    }

    private long ratingCountFor(Medicine medicine) {
        return reviewRepository.findByMedicineOrderByCreatedAtDesc(medicine).size();
    }

    private String imageUrlFor(Medicine medicine) {
        if (medicine.getImageUrl() != null && !medicine.getImageUrl().isBlank()) {
            return medicine.getImageUrl();
        }
        String seed = Optional.ofNullable(medicine.getName()).orElse("medicine").trim().replace(" ", "-").toLowerCase();
        return "https://picsum.photos/seed/medicine-" + seed + "/420/260";
    }

    private void applyInventoryFields(Medicine medicine, Map<String, Object> payload) {
        if (payload.containsKey("stock_quantity") || payload.containsKey("stockQuantity")) {
            medicine.setStockQuantity(Math.max(0, integerValue(payload.containsKey("stock_quantity") ? payload.get("stock_quantity") : payload.get("stockQuantity"))));
        }
        updateIfPresent(payload, "batch_number", medicine::setBatchNumber);
        updateIfPresent(payload, "batchNumber", medicine::setBatchNumber);
        updateIfPresent(payload, "manufacturer", medicine::setManufacturer);
        updateIfPresent(payload, "expiry_date", medicine::setExpiryDate);
        updateIfPresent(payload, "expiryDate", medicine::setExpiryDate);
        updateIfPresent(payload, "image_url", medicine::setImageUrl);
        updateIfPresent(payload, "imageUrl", medicine::setImageUrl);
    }

    private boolean containsAny(Medicine medicine, String query) {
        return contains(medicine.getName(), query)
                || contains(medicine.getBrand(), query)
                || contains(medicine.getCategory(), query)
                || contains(medicine.getDescription(), query)
                || contains(medicine.getShop().getName(), query)
                || contains(medicine.getShop().getArea(), query)
                || contains(medicine.getShop().getState(), query);
    }

    private boolean contains(String value, String query) {
        return Optional.ofNullable(value).orElse("").toLowerCase().contains(query);
    }

    private double safeRating(Medicine medicine) {
        return averageRatingFor(medicine);
    }

    private double haversineDistanceKm(double lat1, double lon1, double lat2, double lon2) {
        double radius = 6371.0d;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.pow(Math.sin(dLat / 2), 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.pow(Math.sin(dLon / 2), 2);
        return radius * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    }

    private double round(double value) {
        return Math.round(value * 10d) / 10d;
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private Long longValue(Object value) {
        if (value == null) return null;
        if (value instanceof Number number) return number.longValue();
        String text = String.valueOf(value).trim();
        if (text.isBlank()) return null;
        return Long.parseLong(text);
    }

    private int integerValue(Object value) {
        if (value == null) return 0;
        if (value instanceof Number number) return number.intValue();
        String text = String.valueOf(value).trim();
        if (text.isBlank()) return 0;
        return Integer.parseInt(text);
    }

    private Double doubleValue(Object value) {
        return optionalDouble(value).orElse(null);
    }

    private Optional<Double> optionalDouble(Object value) {
        if (value == null) return Optional.empty();
        if (value instanceof Number number) return Optional.of(number.doubleValue());
        String text = String.valueOf(value).trim();
        if (text.isBlank()) return Optional.empty();
        return Optional.of(Double.parseDouble(text));
    }

    private boolean booleanValue(Object value) {
        if (value == null) return false;
        if (value instanceof Boolean b) return b;
        return Boolean.parseBoolean(String.valueOf(value));
    }

    private void updateIfPresent(Map<String, Object> payload, String key, java.util.function.Consumer<String> setter) {
        if (payload.containsKey(key)) {
            setter.accept(stringValue(payload.get(key)));
        }
    }

    private boolean isTruthy(String value) {
        return value != null && ("1".equals(value) || "true".equalsIgnoreCase(value));
    }

    private double asDouble(Object value) {
        if (value == null) return 0d;
        if (value instanceof Number number) return number.doubleValue();
        return Double.parseDouble(String.valueOf(value));
    }

    private <T> Slice<T> slice(List<T> items, int page, int pageSize) {
        int safePageSize = Math.max(1, pageSize);
        int safePage = Math.max(1, page);
        int fromIndex = Math.min(items.size(), (safePage - 1) * safePageSize);
        int toIndex = Math.min(items.size(), fromIndex + safePageSize);
        List<T> content = items.subList(fromIndex, toIndex);
        return new Slice<>(content, items.size(), safePage, safePageSize);
    }

    private final class Slice<T> {
        private final List<T> content;
        private final long total;
        private final int page;
        private final int pageSize;

        private Slice(List<T> content, long total, int page, int pageSize) {
            this.content = content;
            this.total = total;
            this.page = page;
            this.pageSize = pageSize;
        }

        private Page<T> toPage() {
            return new org.springframework.data.domain.PageImpl<>(content, PageRequest.of(page - 1, pageSize, Sort.unsorted()), total);
        }
    }
}
