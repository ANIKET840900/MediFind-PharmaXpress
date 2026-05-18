package com.medifind.pharmaxpress.controller;

import com.medifind.pharmaxpress.model.FraudRiskEvent;
import com.medifind.pharmaxpress.model.Medicine;
import com.medifind.pharmaxpress.model.Notification;
import com.medifind.pharmaxpress.model.Order;
import com.medifind.pharmaxpress.model.OrderStatus;
import com.medifind.pharmaxpress.model.Prescription;
import com.medifind.pharmaxpress.model.PrescriptionStatus;
import com.medifind.pharmaxpress.model.ReturnRequest;
import com.medifind.pharmaxpress.model.ReturnRequestStatus;
import com.medifind.pharmaxpress.model.Review;
import com.medifind.pharmaxpress.model.ReviewModerationStatus;
import com.medifind.pharmaxpress.model.UserAccount;
import com.medifind.pharmaxpress.model.UserProfile;
import com.medifind.pharmaxpress.model.UserRole;
import com.medifind.pharmaxpress.repository.FraudRiskEventRepository;
import com.medifind.pharmaxpress.repository.MedicineRepository;
import com.medifind.pharmaxpress.repository.NotificationRepository;
import com.medifind.pharmaxpress.repository.OrderRepository;
import com.medifind.pharmaxpress.repository.PrescriptionRepository;
import com.medifind.pharmaxpress.repository.ReturnRequestRepository;
import com.medifind.pharmaxpress.repository.ReviewRepository;
import com.medifind.pharmaxpress.repository.UserProfileRepository;
import com.medifind.pharmaxpress.security.UserPrincipal;
import com.medifind.pharmaxpress.util.ApiPage;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Transactional
public class EngagementController {
    private final ReviewRepository reviewRepository;
    private final ReturnRequestRepository returnRequestRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final OrderRepository orderRepository;
    private final MedicineRepository medicineRepository;
    private final NotificationRepository notificationRepository;
    private final FraudRiskEventRepository fraudRiskEventRepository;
    private final UserProfileRepository userProfileRepository;

    @GetMapping("/reviews/")
    public ResponseEntity<Map<String, Object>> listReviews(Authentication authentication,
                                                          @RequestParam(value = "medicine", required = false) Long medicineId,
                                                          @RequestParam(value = "mine", required = false) String mine,
                                                          @RequestParam(value = "page_size", required = false, defaultValue = "100") int pageSize,
                                                          @RequestParam(value = "page", required = false, defaultValue = "1") int page) {
        UserAccount user = authentication != null && authentication.getPrincipal() instanceof UserPrincipal principal ? principal.getUserAccount() : null;
        List<Review> reviews = reviewRepository.findAll();
        if (medicineId != null) {
            reviews = reviews.stream().filter(review -> review.getMedicine().getId().equals(medicineId)).toList();
        }
        if (isTruthy(mine)) {
            if (user == null) {
                throw new AccessDeniedException("Authentication required.");
            }
            reviews = reviews.stream().filter(review -> review.getMedicine().getShop().getOwner().getId().equals(user.getId())).toList();
        }
        if (user == null) {
            reviews = reviews.stream()
                    .filter(review -> review.getModerationStatus() == ReviewModerationStatus.APPROVED)
                    .toList();
        } else if (!user.isStaff()) {
            reviews = reviews.stream()
                    .filter(review -> review.getModerationStatus() == ReviewModerationStatus.APPROVED
                            || review.getUser().getId().equals(user.getId())
                            || review.getMedicine().getShop().getOwner().getId().equals(user.getId()))
                    .toList();
        }
        List<Map<String, Object>> mapped = reviews.stream().map(this::reviewToMap).toList();
        return ResponseEntity.ok(ApiPage.from(slice(mapped, page, pageSize).toPage()));
    }

    @PostMapping("/reviews/")
    public ResponseEntity<Map<String, Object>> createReview(Authentication authentication, @RequestBody Map<String, Object> payload) {
        UserAccount user = currentUser(authentication);
        Medicine medicine = medicineById(payload.get("medicine"));
        int rating = integerValue(payload.getOrDefault("rating", 5));
        if (rating < 1 || rating > 5) {
            throw new AccessDeniedException("Rating must be between 1 and 5.");
        }
        boolean verifiedPurchase = orderRepository.findByUserOrderByCreatedAtDesc(user).stream()
                .filter(order -> order.getStatus() != OrderStatus.CANCELLED)
                .anyMatch(order -> order.getItems().stream().anyMatch(item -> item.getMedicine().getId().equals(medicine.getId())));

        Review review = Review.builder()
                .user(user)
                .medicine(medicine)
                .rating(rating)
                .title(stringValue(payload.getOrDefault("title", "")))
                .comment(stringValue(payload.getOrDefault("comment", "")))
                .verifiedPurchase(verifiedPurchase)
                .moderationStatus(ReviewModerationStatus.PENDING)
                .build();

        return ResponseEntity.status(201).body(reviewToMap(reviewRepository.save(review)));
    }

    @PostMapping("/reviews/{reviewId}/moderate/")
    public ResponseEntity<Map<String, Object>> moderateReview(Authentication authentication, @PathVariable Long reviewId, @RequestBody Map<String, Object> payload) {
        UserAccount user = currentUser(authentication);
        String action = stringValue(payload.get("action")).toUpperCase();
        if (!List.of("APPROVED", "REJECTED").contains(action)) {
            throw new IllegalArgumentException("Invalid moderation action.");
        }
        Review review = reviewRepository.findById(reviewId).orElseThrow(() -> new IllegalArgumentException("Review not found."));
        boolean owner = review.getMedicine().getShop().getOwner().getId().equals(user.getId());
        if (!user.isStaff() && !owner) {
            throw new AccessDeniedException("You are not allowed to moderate this review.");
        }
        review.setModerationStatus(ReviewModerationStatus.valueOf(action));
        review.setModeratedBy(user);
        review.setModeratedAt(Instant.now());
        reviewRepository.save(review);
        notify(review.getUser(), "Review moderation update", "Your review for " + review.getMedicine().getName() + " was " + action.toLowerCase() + ".", "review");
        return ResponseEntity.ok(Map.of("detail", "Review moderated successfully.", "moderation_status", review.getModerationStatus().name().toLowerCase()));
    }

    @PostMapping("/reviews/{reviewId}/respond/")
    public ResponseEntity<Map<String, Object>> respondReview(Authentication authentication, @PathVariable Long reviewId, @RequestBody Map<String, Object> payload) {
        UserAccount user = currentUser(authentication);
        String responseText = stringValue(payload.get("response"));
        if (responseText.isBlank()) {
            throw new IllegalArgumentException("Response text is required.");
        }
        Review review = reviewRepository.findById(reviewId).orElseThrow(() -> new IllegalArgumentException("Review not found."));
        boolean owner = review.getMedicine().getShop().getOwner().getId().equals(user.getId());
        if (!user.isStaff() && !owner) {
            throw new AccessDeniedException("You are not allowed to respond to this review.");
        }
        review.setSellerResponse(responseText);
        review.setSellerResponseAt(Instant.now());
        reviewRepository.save(review);
        notify(review.getUser(), "Seller replied to your review", "Seller response on " + review.getMedicine().getName() + ": " + responseText.substring(0, Math.min(100, responseText.length())), "review-response");
        return ResponseEntity.ok(Map.of("detail", "Seller response saved."));
    }

    @GetMapping("/returns/")
    public ResponseEntity<Map<String, Object>> listMyReturns(Authentication authentication,
                                                            @RequestParam(value = "page_size", required = false, defaultValue = "100") int pageSize,
                                                            @RequestParam(value = "page", required = false, defaultValue = "1") int page) {
        UserAccount user = currentUser(authentication);
        List<Map<String, Object>> returns = returnRequestRepository.findByUserOrderByCreatedAtDesc(user).stream().map(this::returnToMap).toList();
        return ResponseEntity.ok(ApiPage.from(slice(returns, page, pageSize).toPage()));
    }

    @PostMapping("/returns/")
    public ResponseEntity<Map<String, Object>> createReturn(Authentication authentication, @RequestBody Map<String, Object> payload) {
        UserAccount user = currentUser(authentication);
        Long orderId = longValue(payload.get("order"));
        Order order = orderRepository.findById(orderId).orElseThrow(() -> new IllegalArgumentException("Order not found."));
        if (!order.getUser().getId().equals(user.getId())) {
            throw new AccessDeniedException("You can only request returns for your own order.");
        }
        if (order.getStatus() != OrderStatus.DELIVERED) {
            throw new AccessDeniedException("Return can be requested only after order is delivered.");
        }
        ReturnRequest request = ReturnRequest.builder()
                .user(user)
                .order(order)
                .reason(stringValue(payload.getOrDefault("reason", "")))
                .status(ReturnRequestStatus.REQUESTED)
                .build();
        request = returnRequestRepository.save(request);
        notify(user, "Return request submitted", "We received your return request for order " + displayOrderId(order) + ".", "return");
        return ResponseEntity.status(201).body(returnToMap(request));
    }

    @GetMapping("/returns/manage/")
    public ResponseEntity<List<Map<String, Object>>> sellerReturnDashboard(Authentication authentication) {
        UserAccount user = currentUser(authentication);
        List<ReturnRequest> requests = returnRequestRepository.findAll().stream()
                .filter(request -> user.isStaff() || request.getOrder().getItems().stream().anyMatch(item -> item.getMedicine().getShop().getOwner().getId().equals(user.getId())))
                .sorted((left, right) -> right.getCreatedAt().compareTo(left.getCreatedAt()))
                .limit(100)
                .toList();
        return ResponseEntity.ok(requests.stream().map(this::returnToMap).toList());
    }

    @PostMapping("/returns/{returnId}/manage/")
    public ResponseEntity<Map<String, Object>> manageReturn(Authentication authentication, @PathVariable Long returnId, @RequestBody Map<String, Object> payload) {
        UserAccount user = currentUser(authentication);
        String status = stringValue(payload.get("status")).toUpperCase();
        String note = stringValue(payload.getOrDefault("note", ""));
        if (!List.of("REQUESTED", "APPROVED", "REJECTED", "COMPLETED").contains(status)) {
            throw new IllegalArgumentException("Invalid return status.");
        }
        ReturnRequest request = returnRequestRepository.findById(returnId).orElseThrow(() -> new IllegalArgumentException("Return request not found."));
        if (!user.isStaff() && request.getOrder().getItems().stream().noneMatch(item -> item.getMedicine().getShop().getOwner().getId().equals(user.getId()))) {
            throw new AccessDeniedException("You are not allowed to manage this return request.");
        }
        if (!user.isStaff()) {
            long riskyReturns = returnRequestRepository.findByUserOrderByCreatedAtDesc(request.getUser()).stream()
                    .filter(existing -> existing.getCreatedAt().isAfter(Instant.now().minus(30, ChronoUnit.DAYS)))
                    .count();
            if (riskyReturns >= 5) {
                logFraud(user, "return_manage", "high", "High-volume return user requires admin review");
                throw new AccessDeniedException("This return requires admin review due to risk checks.");
            }
        }
        request.setStatus(ReturnRequestStatus.valueOf(status));
        request.setResolutionNote(note);
        request.setResolvedBy(user);
        request.setResolvedAt(Instant.now());
        returnRequestRepository.save(request);
        notify(request.getUser(), "Return request updated", "Return request for order " + displayOrderId(request.getOrder()) + " is now " + status.toLowerCase() + ".", "return-update");
        return ResponseEntity.ok(returnToMap(request));
    }

    @GetMapping("/prescriptions/")
    public ResponseEntity<Map<String, Object>> listPrescriptions(Authentication authentication,
                                                                @RequestParam(value = "mine", required = false) String mine,
                                                                @RequestParam(value = "queue", required = false) String queue,
                                                                @RequestParam(value = "page_size", required = false, defaultValue = "100") int pageSize,
                                                                @RequestParam(value = "page", required = false, defaultValue = "1") int page) {
        UserAccount user = currentUser(authentication);
        UserProfile profile = userProfileRepository.findByUser(user).orElse(null);
        List<Prescription> prescriptions = prescriptionRepository.findAll();
        if (user.isStaff() || isTruthy(queue) && profile != null && (profile.getRole() == UserRole.SELLER || profile.getRole() == UserRole.ADMIN)) {
            prescriptions = prescriptions.stream().filter(item -> item.getMedicine().getShop().getOwner().getId().equals(user.getId())).toList();
        } else if (isTruthy(mine)) {
            prescriptions = prescriptions.stream().filter(item -> item.getUser().getId().equals(user.getId())).toList();
        } else {
            prescriptions = prescriptions.stream().filter(item -> item.getUser().getId().equals(user.getId())).toList();
        }
        List<Map<String, Object>> mapped = prescriptions.stream().map(this::prescriptionToMap).toList();
        return ResponseEntity.ok(ApiPage.from(slice(mapped, page, pageSize).toPage()));
    }

    @PostMapping(value = "/prescriptions/", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> createPrescription(Authentication authentication,
                                                                 @RequestParam("medicine") Long medicineId,
                                                                 @RequestParam(value = "note", required = false, defaultValue = "") String note,
                                                                 @RequestPart(value = "file", required = false) MultipartFile file) throws IOException {
        UserAccount user = currentUser(authentication);
        if (file == null || file.isEmpty()) {
            throw new AccessDeniedException("Prescription file is required.");
        }
        Medicine medicine = medicineRepository.findById(medicineId).orElseThrow(() -> new IllegalArgumentException("Medicine not found."));
        Path uploadRoot = Path.of("uploads", "prescriptions").toAbsolutePath().normalize();
        Files.createDirectories(uploadRoot);
        String originalName = Optional.ofNullable(file.getOriginalFilename()).orElse("prescription");
        String cleanName = Path.of(originalName).getFileName().toString().replaceAll("[^A-Za-z0-9._-]", "_");
        String safeName = UUID.randomUUID() + "_" + cleanName;
        Path target = uploadRoot.resolve(safeName).normalize();
        if (!target.startsWith(uploadRoot)) {
            throw new AccessDeniedException("Invalid prescription file name.");
        }
        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);

        Prescription prescription = Prescription.builder()
                .user(user)
                .medicine(medicine)
                .filePath("/uploads/prescriptions/" + safeName)
                .note(note)
                .status(PrescriptionStatus.PENDING)
                .build();
        return ResponseEntity.status(201).body(prescriptionToMap(prescriptionRepository.save(prescription)));
    }

    @PostMapping("/prescriptions/{prescriptionId}/review/")
    public ResponseEntity<Map<String, Object>> reviewPrescription(Authentication authentication, @PathVariable Long prescriptionId, @RequestBody Map<String, Object> payload) {
        UserAccount user = currentUser(authentication);
        String status = stringValue(payload.get("status")).toUpperCase();
        String rejectionReason = stringValue(payload.getOrDefault("rejection_reason", ""));
        if (!List.of("APPROVED", "REJECTED").contains(status)) {
            throw new IllegalArgumentException("Invalid prescription status.");
        }
        Prescription prescription = prescriptionRepository.findById(prescriptionId).orElseThrow(() -> new IllegalArgumentException("Prescription not found."));
        UserProfile profile = userProfileRepository.findByUser(user).orElse(null);
        boolean sellerOwner = prescription.getMedicine().getShop().getOwner().getId().equals(user.getId());
        if (!user.isStaff() && profile != null && profile.getRole() != UserRole.SELLER && profile.getRole() != UserRole.ADMIN && !sellerOwner) {
            throw new AccessDeniedException("You are not allowed to review this prescription.");
        }
        prescription.setStatus(PrescriptionStatus.valueOf(status));
        prescription.setReviewedBy(user);
        prescription.setReviewedAt(Instant.now());
        prescription.setRejectionReason(PrescriptionStatus.REJECTED == prescription.getStatus() ? rejectionReason : "");
        prescriptionRepository.save(prescription);
        notify(prescription.getUser(), "Prescription status updated", "Prescription for " + prescription.getMedicine().getName() + " is now " + status.toLowerCase() + ".", "prescription");
        return ResponseEntity.ok(prescriptionToMap(prescription));
    }

    @GetMapping("/fraud-events/")
    public ResponseEntity<Map<String, Object>> listFraudEvents(Authentication authentication,
                                                              @RequestParam(value = "page_size", required = false, defaultValue = "100") int pageSize,
                                                              @RequestParam(value = "page", required = false, defaultValue = "1") int page) {
        UserAccount user = currentUser(authentication);
        List<FraudRiskEvent> events = user.isStaff() ? fraudRiskEventRepository.findAll() : fraudRiskEventRepository.findByUserOrderByCreatedAtDesc(user);
        List<Map<String, Object>> mapped = events.stream().map(this::fraudToMap).toList();
        return ResponseEntity.ok(ApiPage.from(slice(mapped, page, pageSize).toPage()));
    }

    private UserAccount currentUser(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof UserPrincipal principal)) {
            throw new AccessDeniedException("Authentication required.");
        }
        return principal.getUserAccount();
    }

    private Medicine medicineById(Object value) {
        Long id = longValue(value);
        if (id == null) {
            throw new IllegalArgumentException("Medicine is required.");
        }
        return medicineRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Medicine not found."));
    }

    private Map<String, Object> reviewToMap(Review review) {
        Map<String, Object> mapped = new HashMap<>();
        mapped.put("id", review.getId());
        mapped.put("user", review.getUser().getId());
        mapped.put("username", review.getUser().getUsername());
        mapped.put("medicine", review.getMedicine().getId());
        mapped.put("medicine_name", review.getMedicine().getName());
        mapped.put("rating", review.getRating());
        mapped.put("title", review.getTitle());
        mapped.put("comment", review.getComment());
        mapped.put("verified_purchase", review.isVerifiedPurchase());
        mapped.put("moderation_status", review.getModerationStatus().name().toLowerCase());
        mapped.put("moderated_by", review.getModeratedBy() == null ? null : review.getModeratedBy().getId());
        mapped.put("moderated_by_username", review.getModeratedBy() == null ? null : review.getModeratedBy().getUsername());
        mapped.put("moderated_at", review.getModeratedAt());
        mapped.put("seller_response", review.getSellerResponse());
        mapped.put("seller_response_at", review.getSellerResponseAt());
        mapped.put("created_at", review.getCreatedAt());
        return mapped;
    }

    private Map<String, Object> returnToMap(ReturnRequest request) {
        Map<String, Object> mapped = new HashMap<>();
        mapped.put("id", request.getId());
        mapped.put("user", request.getUser().getId());
        mapped.put("order", request.getOrder().getId());
        mapped.put("order_tracking_id", request.getOrder().getTrackingId());
        mapped.put("reason", request.getReason());
        mapped.put("status", request.getStatus().name().toLowerCase());
        mapped.put("resolved_by", request.getResolvedBy() == null ? null : request.getResolvedBy().getId());
        mapped.put("resolved_by_username", request.getResolvedBy() == null ? null : request.getResolvedBy().getUsername());
        mapped.put("resolution_note", request.getResolutionNote());
        mapped.put("resolved_at", request.getResolvedAt());
        mapped.put("created_at", request.getCreatedAt());
        return mapped;
    }

    private Map<String, Object> prescriptionToMap(Prescription prescription) {
        Map<String, Object> mapped = new HashMap<>();
        mapped.put("id", prescription.getId());
        mapped.put("user", prescription.getUser().getId());
        mapped.put("medicine", prescription.getMedicine().getId());
        mapped.put("medicine_name", prescription.getMedicine().getName());
        mapped.put("file", prescription.getFilePath());
        mapped.put("file_url", prescription.getFilePath());
        mapped.put("note", prescription.getNote());
        mapped.put("status", prescription.getStatus().name().toLowerCase());
        mapped.put("reviewed_by", prescription.getReviewedBy() == null ? null : prescription.getReviewedBy().getId());
        mapped.put("reviewed_by_username", prescription.getReviewedBy() == null ? null : prescription.getReviewedBy().getUsername());
        mapped.put("reviewed_at", prescription.getReviewedAt());
        mapped.put("rejection_reason", prescription.getRejectionReason());
        mapped.put("created_at", prescription.getCreatedAt());
        return mapped;
    }

    private Map<String, Object> fraudToMap(FraudRiskEvent event) {
        Map<String, Object> mapped = new HashMap<>();
        mapped.put("id", event.getId());
        mapped.put("user", event.getUser().getId());
        mapped.put("username", event.getUser().getUsername());
        mapped.put("action", event.getAction());
        mapped.put("risk_level", event.getRiskLevel());
        mapped.put("reason", event.getReason());
        mapped.put("context", event.getContext());
        mapped.put("created_at", event.getCreatedAt());
        return mapped;
    }

    private void notify(UserAccount user, String title, String message, String kind) {
        notificationRepository.save(Notification.builder().user(user).title(title).message(message).kind(kind).build());
    }

    private void logFraud(UserAccount user, String action, String riskLevel, String reason) {
        fraudRiskEventRepository.save(FraudRiskEvent.builder().user(user).action(action).riskLevel(riskLevel).reason(reason).build());
    }

    private String displayOrderId(com.medifind.pharmaxpress.model.Order order) {
        return order.getTrackingId() == null || order.getTrackingId().isBlank() ? String.valueOf(order.getId()) : order.getTrackingId();
    }

    private boolean isTruthy(String value) {
        return value != null && ("1".equals(value) || "true".equalsIgnoreCase(value));
    }

    private int integerValue(Object value) {
        if (value == null) return 0;
        if (value instanceof Number number) return number.intValue();
        return Integer.parseInt(String.valueOf(value));
    }

    private Long longValue(Object value) {
        if (value == null) return null;
        if (value instanceof Number number) return number.longValue();
        String text = String.valueOf(value).trim();
        if (text.isBlank()) return null;
        return Long.parseLong(text);
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private double round(double value) {
        return Math.round(value * 100d) / 100d;
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
            return new org.springframework.data.domain.PageImpl<>(content, PageRequest.of(page - 1, pageSize), total);
        }
    }
}
