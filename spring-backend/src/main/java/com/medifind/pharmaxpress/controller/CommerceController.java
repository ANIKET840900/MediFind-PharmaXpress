package com.medifind.pharmaxpress.controller;

import com.medifind.pharmaxpress.model.CartItem;
import com.medifind.pharmaxpress.model.FraudRiskEvent;
import com.medifind.pharmaxpress.model.Medicine;
import com.medifind.pharmaxpress.model.Notification;
import com.medifind.pharmaxpress.model.Order;
import com.medifind.pharmaxpress.model.OrderItem;
import com.medifind.pharmaxpress.model.OrderStatus;
import com.medifind.pharmaxpress.model.PaymentStatus;
import com.medifind.pharmaxpress.model.PaymentTransaction;
import com.medifind.pharmaxpress.model.Prescription;
import com.medifind.pharmaxpress.model.PrescriptionStatus;
import com.medifind.pharmaxpress.model.ReturnRequestStatus;
import com.medifind.pharmaxpress.model.Review;
import com.medifind.pharmaxpress.model.UserAccount;
import com.medifind.pharmaxpress.model.UserRole;
import com.medifind.pharmaxpress.model.WishlistItem;
import com.medifind.pharmaxpress.repository.CartItemRepository;
import com.medifind.pharmaxpress.repository.FraudRiskEventRepository;
import com.medifind.pharmaxpress.repository.MedicineRepository;
import com.medifind.pharmaxpress.repository.NotificationRepository;
import com.medifind.pharmaxpress.repository.OrderRepository;
import com.medifind.pharmaxpress.repository.PaymentTransactionRepository;
import com.medifind.pharmaxpress.repository.PrescriptionRepository;
import com.medifind.pharmaxpress.repository.ReviewRepository;
import com.medifind.pharmaxpress.repository.ShopRepository;
import com.medifind.pharmaxpress.repository.UserProfileRepository;
import com.medifind.pharmaxpress.repository.WishlistItemRepository;
import com.medifind.pharmaxpress.security.UserPrincipal;
import com.medifind.pharmaxpress.util.ApiPage;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
public class CommerceController {
    private final CartItemRepository cartItemRepository;
    private final WishlistItemRepository wishlistItemRepository;
    private final OrderRepository orderRepository;
    private final MedicineRepository medicineRepository;
    private final ReviewRepository reviewRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final PaymentTransactionRepository paymentTransactionRepository;
    private final NotificationRepository notificationRepository;
    private final FraudRiskEventRepository fraudRiskEventRepository;
    private final UserProfileRepository userProfileRepository;
    private final ShopRepository shopRepository;

    @GetMapping("/cart/")
    public ResponseEntity<Map<String, Object>> listCart(Authentication authentication,
                                                      @RequestParam(value = "page_size", required = false, defaultValue = "100") int pageSize,
                                                      @RequestParam(value = "page", required = false, defaultValue = "1") int page) {
        UserAccount user = currentUser(authentication);
        List<Map<String, Object>> cartItems = cartItemRepository.findByUserOrderByIdDesc(user).stream()
                .map(this::cartItemToMap)
                .toList();
        return ResponseEntity.ok(ApiPage.from(slice(cartItems, page, pageSize).toPage()));
    }

    @PostMapping("/cart/")
    public ResponseEntity<Map<String, Object>> addToCart(Authentication authentication, @RequestBody Map<String, Object> payload) {
        UserAccount user = currentUser(authentication);
        Long medicineId = longValue(payload.get("medicine"));
        if (medicineId == null) {
            throw new IllegalArgumentException("Medicine is required.");
        }
        Medicine medicine = medicineRepository.findById(medicineId).orElseThrow(() -> new IllegalArgumentException("Medicine not found."));
        if (!medicine.isInStock()) {
            throw new AccessDeniedException("This medicine is currently out of stock.");
        }

        int quantity = integerValue(payload.getOrDefault("quantity", 1));
        if (quantity < 1) {
            quantity = 1;
        }
        int requestedQuantity = quantity;

        CartItem item = cartItemRepository.findByUserAndMedicine(user, medicine)
                .map(existing -> {
                    existing.setQuantity(existing.getQuantity() + requestedQuantity);
                    return existing;
                })
                .orElseGet(() -> CartItem.builder().user(user).medicine(medicine).quantity(requestedQuantity).build());

        return ResponseEntity.status(201).body(cartItemToMap(cartItemRepository.save(item)));
    }

    @PatchMapping("/cart/{id}/")
    public ResponseEntity<Map<String, Object>> updateCart(Authentication authentication, @PathVariable Long id, @RequestBody Map<String, Object> payload) {
        UserAccount user = currentUser(authentication);
        CartItem item = cartItemRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Cart item not found."));
        if (!item.getUser().getId().equals(user.getId())) {
            throw new AccessDeniedException("You cannot update another user's cart item.");
        }
        int quantity = integerValue(payload.getOrDefault("quantity", item.getQuantity()));
        if (quantity < 1) {
            quantity = 1;
        }
        item.setQuantity(quantity);
        return ResponseEntity.ok(cartItemToMap(cartItemRepository.save(item)));
    }

    @DeleteMapping("/cart/{id}/")
    public ResponseEntity<Map<String, String>> deleteCart(Authentication authentication, @PathVariable Long id) {
        UserAccount user = currentUser(authentication);
        CartItem item = cartItemRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Cart item not found."));
        if (!item.getUser().getId().equals(user.getId())) {
            throw new AccessDeniedException("You cannot delete another user's cart item.");
        }
        cartItemRepository.delete(item);
        return ResponseEntity.ok(Map.of("detail", "Cart item deleted successfully."));
    }

    @GetMapping("/wishlist/")
    public ResponseEntity<Map<String, Object>> listWishlist(Authentication authentication,
                                                           @RequestParam(value = "page_size", required = false, defaultValue = "100") int pageSize,
                                                           @RequestParam(value = "page", required = false, defaultValue = "1") int page) {
        UserAccount user = currentUser(authentication);
        List<Map<String, Object>> wishlist = wishlistItemRepository.findByUserOrderByCreatedAtDesc(user).stream()
                .map(this::wishlistItemToMap)
                .toList();
        return ResponseEntity.ok(ApiPage.from(slice(wishlist, page, pageSize).toPage()));
    }

    @PostMapping("/wishlist/")
    public ResponseEntity<Map<String, Object>> addToWishlist(Authentication authentication, @RequestBody Map<String, Object> payload) {
        UserAccount user = currentUser(authentication);
        Medicine medicine = medicineById(payload.get("medicine"));
        WishlistItem item = wishlistItemRepository.findByUserAndMedicine(user, medicine)
                .orElseGet(() -> WishlistItem.builder().user(user).medicine(medicine).build());
        return ResponseEntity.status(201).body(wishlistItemToMap(wishlistItemRepository.save(item)));
    }

    @DeleteMapping("/wishlist/{id}/")
    public ResponseEntity<Map<String, String>> deleteWishlist(Authentication authentication, @PathVariable Long id) {
        UserAccount user = currentUser(authentication);
        WishlistItem item = wishlistItemRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Wishlist item not found."));
        if (!item.getUser().getId().equals(user.getId())) {
            throw new AccessDeniedException("You cannot delete another user's wishlist item.");
        }
        wishlistItemRepository.delete(item);
        return ResponseEntity.ok(Map.of("detail", "Wishlist item deleted successfully."));
    }

    @GetMapping("/orders/")
    public ResponseEntity<Map<String, Object>> listOrders(Authentication authentication,
                                                         @RequestParam(value = "page_size", required = false, defaultValue = "100") int pageSize,
                                                         @RequestParam(value = "page", required = false, defaultValue = "1") int page) {
        UserAccount user = currentUser(authentication);
        List<Map<String, Object>> orders = orderRepository.findByUserOrderByCreatedAtDesc(user).stream()
                .map(this::orderToMap)
                .toList();
        return ResponseEntity.ok(ApiPage.from(slice(orders, page, pageSize).toPage()));
    }

    @PostMapping("/orders/")
    public ResponseEntity<Map<String, Object>> createOrder(Authentication authentication, @RequestBody Map<String, Object> payload) {
        UserAccount user = currentUser(authentication);
        List<Long> cartItemIds = ids(payload.get("items"));
        if (cartItemIds.isEmpty()) {
            throw new IllegalArgumentException("At least one cart item is required.");
        }

        String paymentMethod = stringValue(payload.getOrDefault("payment_method", "cod")).toLowerCase();
        String couponCode = stringValue(payload.getOrDefault("coupon_code", "")).toUpperCase();
        String paymentReference = stringValue(payload.getOrDefault("payment_reference", ""));

        List<CartItem> cartItems = cartItemRepository.findAllById(cartItemIds);
        if (cartItems.size() != cartItemIds.size()) {
            throw new IllegalArgumentException("One or more cart items were not found.");
        }
        if (cartItems.stream().anyMatch(item -> !item.getUser().getId().equals(user.getId()))) {
            throw new AccessDeniedException("Order contains cart items that do not belong to you.");
        }

        List<Medicine> prescriptionRequiredItems = cartItems.stream()
                .map(CartItem::getMedicine)
                .filter(Medicine::isPrescriptionRequired)
                .toList();
        for (Medicine medicine : prescriptionRequiredItems) {
            boolean approvedExists = prescriptionRepository.findByUserOrderByCreatedAtDesc(user).stream()
                    .anyMatch(prescription -> prescription.getMedicine().getId().equals(medicine.getId()) && prescription.getStatus() == PrescriptionStatus.APPROVED);
            if (!approvedExists) {
                throw new AccessDeniedException("Prescription approval required for " + medicine.getName() + ". Upload prescription before checkout.");
            }
        }

        double subtotal = cartItems.stream().mapToDouble(item -> item.getQuantity() * item.getMedicine().getPrice()).sum();
        double deliveryFee = subtotal >= 499 ? 0d : 35d;
        double taxAmount = round(subtotal * 0.05d);
        double discountAmount = "FIRST50".equals(couponCode) ? Math.min(50d, subtotal) : 0d;
        double totalAmount = round(Math.max(0d, subtotal + deliveryFee + taxAmount - discountAmount));

        Order order = Order.builder()
                .user(user)
                .paymentMethod(paymentMethod)
                .paymentReference(paymentReference)
                .couponCode(couponCode)
                .deliveryAddress(stringValue(payload.getOrDefault("delivery_address", "")))
                .mobileNumber(stringValue(payload.getOrDefault("mobile_number", "")))
                .houseNumber(stringValue(payload.getOrDefault("house_number", "")))
                .street(stringValue(payload.getOrDefault("street", "")))
                .city(stringValue(payload.getOrDefault("city", "")))
                .state(stringValue(payload.getOrDefault("state", "")))
                .pincode(stringValue(payload.getOrDefault("pincode", "")))
                .build();
        order = orderRepository.save(order);

        for (CartItem item : cartItems) {
            order.getItems().add(OrderItem.builder()
                    .order(order)
                    .medicine(item.getMedicine())
                    .quantity(item.getQuantity())
                    .unitPrice(item.getMedicine().getPrice())
                    .build());
        }
        order.setDeliveryFee(deliveryFee);
        order.setTaxAmount(taxAmount);
        order.setDiscountAmount(discountAmount);
        order.setTotalAmount(totalAmount);
        order.setTrackingId("TRK" + String.format("%06d", order.getId()));
        order.setStatus(OrderStatus.PLACED);

        String paymentStatus = "pending";
        if (List.of("upi", "card").contains(paymentMethod)) {
            PaymentTransaction payment = paymentTransactionRepository.findFirstByUserAndGatewayOrderIdOrderByIdDesc(user, paymentReference).orElse(null);
            if (payment != null) {
                payment.setOrder(order);
                if (payment.getStatus() == PaymentStatus.AUTHORIZED) {
                    payment.setStatus(PaymentStatus.CAPTURED);
                    if (payment.getGatewayPaymentId() == null || payment.getGatewayPaymentId().isBlank()) {
                        payment.setGatewayPaymentId("pay_" + order.getId());
                    }
                }
                paymentTransactionRepository.save(payment);
                paymentStatus = payment.getStatus() == PaymentStatus.CAPTURED ? "paid" : "pending";
            }
        }
        order.setPaymentStatus(paymentStatus);
        orderRepository.save(order);
        cartItemRepository.deleteAll(cartItems);

        notify(user, "Order placed successfully", "Your order " + order.getTrackingId() + " has been placed.", "order", order.getMobileNumber());
        return ResponseEntity.status(201).body(orderToMap(orderRepository.findById(order.getId()).orElseThrow()));
    }

    @PostMapping("/orders/{orderId}/cancel/")
    public ResponseEntity<Map<String, Object>> cancelOrder(Authentication authentication, @PathVariable Long orderId) {
        UserAccount user = currentUser(authentication);
        Order order = orderRepository.findById(orderId).orElseThrow(() -> new IllegalArgumentException("Order not found."));
        if (!order.getUser().getId().equals(user.getId())) {
            throw new AccessDeniedException("You are not allowed to cancel this order.");
        }
        if (order.getCreatedAt().isBefore(Instant.now().minus(48, ChronoUnit.HOURS))) {
            logFraud(user, "order_cancel", "medium", "Cancellation attempted after allowed window");
            throw new IllegalArgumentException("Cancellation window expired for this order.");
        }
        long recentCancels = orderRepository.findByUserOrderByCreatedAtDesc(user).stream()
                .filter(existing -> existing.getStatus() == OrderStatus.CANCELLED)
                .filter(existing -> existing.getCreatedAt().isAfter(Instant.now().minus(7, ChronoUnit.DAYS)))
                .count();
        if (recentCancels >= 3) {
            logFraud(user, "order_cancel", "high", "Too many cancellations in rolling 7 days");
            throw new AccessDeniedException("Cancellation limit reached. Contact support.");
        }
        if (order.getStatus() == OrderStatus.DELIVERED || order.getStatus() == OrderStatus.CANCELLED) {
            throw new IllegalArgumentException("Order cannot be cancelled at this stage.");
        }
        order.setStatus(OrderStatus.CANCELLED);
        orderRepository.save(order);
        notify(user, "Order cancelled", "Your order " + order.getTrackingId() + " has been cancelled.", "cancel", order.getMobileNumber());
        return ResponseEntity.ok(Map.of("detail", "Order cancelled successfully.", "status", order.getStatus().name().toLowerCase()));
    }

    @PostMapping("/orders/{orderId}/status/")
    public ResponseEntity<Map<String, Object>> updateOrderStatus(Authentication authentication, @PathVariable Long orderId, @RequestBody Map<String, Object> payload) {
        UserAccount user = currentUser(authentication);
        Order order = orderRepository.findById(orderId).orElseThrow(() -> new IllegalArgumentException("Order not found."));
        OrderStatus newStatus = orderStatus(stringValue(payload.get("status")));
        if (!order.getUser().getId().equals(user.getId())) {
            boolean sellerMatch = order.getItems().stream().anyMatch(item -> item.getMedicine().getShop().getOwner().getId().equals(user.getId()));
            if (!sellerMatch) {
                throw new AccessDeniedException("You are not allowed to update this order.");
            }
        }
        order.setStatus(newStatus);
        orderRepository.save(order);
        notify(order.getUser(), "Order status updated", "Order " + (order.getTrackingId().isBlank() ? order.getId() : order.getTrackingId()) + " is now " + newStatus.name().toLowerCase().replace('_', ' ') + ".", "order-status", order.getMobileNumber());
        return ResponseEntity.ok(Map.of("detail", "Order status updated.", "status", newStatus.name().toLowerCase()));
    }

    @GetMapping("/notifications/")
    public ResponseEntity<Map<String, Object>> listNotifications(Authentication authentication,
                                                                @RequestParam(value = "page_size", required = false, defaultValue = "100") int pageSize,
                                                                @RequestParam(value = "page", required = false, defaultValue = "1") int page) {
        UserAccount user = currentUser(authentication);
        List<Map<String, Object>> notifications = notificationRepository.findByUserOrderByCreatedAtDesc(user).stream()
                .map(this::notificationToMap)
                .toList();
        return ResponseEntity.ok(ApiPage.from(slice(notifications, page, pageSize).toPage()));
    }

    @PostMapping("/notifications/mark-read/")
    public ResponseEntity<Map<String, Object>> markNotificationsRead(Authentication authentication, @RequestBody(required = false) Map<String, Object> payload) {
        UserAccount user = currentUser(authentication);
        Long notificationId = payload == null ? null : longValue(payload.get("notification_id"));
        var notifications = notificationRepository.findByUserOrderByCreatedAtDesc(user).stream()
                .filter(notification -> notificationId == null || notification.getId().equals(notificationId))
                .toList();
        notifications.forEach(notification -> notification.setRead(true));
        notificationRepository.saveAll(notifications);
        return ResponseEntity.ok(Map.of("detail", "Notifications updated.", "updated", notifications.size()));
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

    private Map<String, Object> cartItemToMap(CartItem item) {
        Map<String, Object> mapped = new HashMap<>();
        mapped.put("id", item.getId());
        mapped.put("user", item.getUser().getId());
        mapped.put("medicine", item.getMedicine().getId());
        mapped.put("medicine_detail", medicineToMap(item.getMedicine()));
        mapped.put("quantity", item.getQuantity());
        return mapped;
    }

    private Map<String, Object> wishlistItemToMap(WishlistItem item) {
        Map<String, Object> mapped = new HashMap<>();
        mapped.put("id", item.getId());
        mapped.put("user", item.getUser().getId());
        mapped.put("medicine", item.getMedicine().getId());
        mapped.put("medicine_detail", medicineToMap(item.getMedicine()));
        mapped.put("created_at", item.getCreatedAt());
        return mapped;
    }

    private Map<String, Object> orderToMap(Order order) {
        Map<String, Object> mapped = new HashMap<>();
        mapped.put("id", order.getId());
        mapped.put("user", order.getUser().getId());
        mapped.put("items", order.getItems().stream().map(OrderItem::getId).toList());
        mapped.put("items_detail", order.getItems().stream().map(this::orderItemToMap).toList());
        mapped.put("status", order.getStatus().name().toLowerCase());
        mapped.put("payment_method", order.getPaymentMethod());
        mapped.put("payment_status", order.getPaymentStatus());
        mapped.put("payment_reference", order.getPaymentReference());
        mapped.put("delivery_fee", order.getDeliveryFee());
        mapped.put("tax_amount", order.getTaxAmount());
        mapped.put("discount_amount", order.getDiscountAmount());
        mapped.put("total_amount", order.getTotalAmount());
        mapped.put("coupon_code", order.getCouponCode());
        mapped.put("tracking_id", order.getTrackingId());
        mapped.put("delivery_address", order.getDeliveryAddress());
        mapped.put("mobile_number", order.getMobileNumber());
        mapped.put("house_number", order.getHouseNumber());
        mapped.put("street", order.getStreet());
        mapped.put("city", order.getCity());
        mapped.put("state", order.getState());
        mapped.put("pincode", order.getPincode());
        mapped.put("created_at", order.getCreatedAt());
        return mapped;
    }

    private Map<String, Object> orderItemToMap(OrderItem item) {
        Map<String, Object> mapped = new HashMap<>();
        mapped.put("id", item.getId());
        mapped.put("medicine", item.getMedicine().getId());
        mapped.put("medicine_detail", medicineToMap(item.getMedicine()));
        mapped.put("quantity", item.getQuantity());
        mapped.put("unit_price", item.getUnitPrice());
        return mapped;
    }

    private Map<String, Object> notificationToMap(Notification notification) {
        Map<String, Object> mapped = new HashMap<>();
        mapped.put("id", notification.getId());
        mapped.put("user", notification.getUser().getId());
        mapped.put("title", notification.getTitle());
        mapped.put("message", notification.getMessage());
        mapped.put("kind", notification.getKind());
        mapped.put("is_read", notification.isRead());
        mapped.put("created_at", notification.getCreatedAt());
        return mapped;
    }

    private Map<String, Object> medicineToMap(Medicine medicine) {
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
        mapped.put("image_url", "https://picsum.photos/seed/medicine-" + Optional.ofNullable(medicine.getName()).orElse("medicine").trim().replace(" ", "-").toLowerCase() + "/420/260");
        mapped.put("average_rating", averageRatingFor(medicine));
        mapped.put("rating_count", reviewRepository.findByMedicineOrderByCreatedAtDesc(medicine).size());
        mapped.put("in_stock", medicine.isInStock());
        return mapped;
    }

    private double averageRatingFor(Medicine medicine) {
        var reviews = reviewRepository.findByMedicineOrderByCreatedAtDesc(medicine);
        if (reviews.isEmpty()) {
            return round(Optional.ofNullable(medicine.getShop().getRating()).orElse(0d));
        }
        return round(reviews.stream().mapToInt(review -> review.getRating() == null ? 0 : review.getRating()).average().orElse(0d));
    }

    private void notify(UserAccount user, String title, String message, String kind, String phoneNumber) {
        notificationRepository.save(Notification.builder().user(user).title(title).message(message).kind(kind).build());
    }

    private void logFraud(UserAccount user, String action, String riskLevel, String reason) {
        fraudRiskEventRepository.save(FraudRiskEvent.builder().user(user).action(action).riskLevel(riskLevel).reason(reason).build());
    }

    private OrderStatus orderStatus(String value) {
        String normalized = value == null ? "" : value.trim().toUpperCase();
        if (normalized.isBlank()) {
            throw new IllegalArgumentException("Invalid order status.");
        }
        return OrderStatus.valueOf(normalized);
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

    private List<Long> ids(Object value) {
        List<Long> ids = new ArrayList<>();
        if (value instanceof List<?> list) {
            for (Object element : list) {
                Long id = longValue(element);
                if (id != null) {
                    ids.add(id);
                }
            }
        }
        return ids;
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
