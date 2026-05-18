package com.medifind.pharmaxpress.controller;

import com.medifind.pharmaxpress.model.CartItem;
import com.medifind.pharmaxpress.model.Order;
import com.medifind.pharmaxpress.model.PaymentReconciliationRun;
import com.medifind.pharmaxpress.model.PaymentStatus;
import com.medifind.pharmaxpress.model.PaymentTransaction;
import com.medifind.pharmaxpress.model.PaymentWebhookEvent;
import com.medifind.pharmaxpress.model.UserAccount;
import com.medifind.pharmaxpress.repository.CartItemRepository;
import com.medifind.pharmaxpress.repository.OrderRepository;
import com.medifind.pharmaxpress.repository.PaymentReconciliationRunRepository;
import com.medifind.pharmaxpress.repository.PaymentTransactionRepository;
import com.medifind.pharmaxpress.repository.PaymentWebhookEventRepository;
import com.medifind.pharmaxpress.security.UserPrincipal;
import com.medifind.pharmaxpress.util.ApiPage;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import com.fasterxml.jackson.databind.ObjectMapper;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
@Transactional
public class PaymentController {
    private final PaymentTransactionRepository paymentTransactionRepository;
    private final PaymentWebhookEventRepository paymentWebhookEventRepository;
    private final PaymentReconciliationRunRepository paymentReconciliationRunRepository;
    private final CartItemRepository cartItemRepository;
    private final OrderRepository orderRepository;
    private final ObjectMapper objectMapper;

    @Value("${app.payment.provider:mock}")
    private String configuredProvider;

    @GetMapping("/")
    public ResponseEntity<Map<String, Object>> listPayments(Authentication authentication,
                                                           @RequestParam(value = "status", required = false, defaultValue = "") String status,
                                                           @RequestParam(value = "page_size", required = false, defaultValue = "100") int pageSize,
                                                           @RequestParam(value = "page", required = false, defaultValue = "1") int page) {
        UserAccount user = currentUser(authentication);
        List<PaymentTransaction> transactions = paymentTransactionRepository.findByUserOrderByCreatedAtDesc(user);
        if (!status.isBlank()) {
            transactions = transactions.stream().filter(transaction -> transaction.getStatus().name().equalsIgnoreCase(status)).toList();
        }
        List<Map<String, Object>> mapped = transactions.stream().map(this::paymentToMap).toList();
        return ResponseEntity.ok(ApiPage.from(slice(mapped, page, pageSize).toPage()));
    }

    @GetMapping("/{paymentId}/history/")
    public ResponseEntity<Map<String, Object>> paymentHistory(Authentication authentication, @PathVariable Long paymentId) {
        UserAccount user = currentUser(authentication);
        PaymentTransaction payment = paymentTransactionRepository.findById(paymentId).orElseThrow(() -> new IllegalArgumentException("Payment transaction not found."));
        if (!payment.getUser().getId().equals(user.getId())) {
            throw new AccessDeniedException("You are not allowed to view this payment transaction.");
        }
        List<Map<String, Object>> events = paymentWebhookEventRepository.findAll().stream()
                .filter(event -> event.getPayment() != null && event.getPayment().getId().equals(paymentId))
                .sorted((left, right) -> right.getCreatedAt().compareTo(left.getCreatedAt()))
                .map(this::webhookToMap)
                .toList();
        Map<String, Object> response = new HashMap<>();
        response.put("payment", paymentToMap(payment));
        response.put("events", events);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/initialize/")
    public ResponseEntity<Map<String, Object>> initializePayment(Authentication authentication, @RequestBody Map<String, Object> payload) {
        UserAccount user = currentUser(authentication);
        List<Long> itemIds = ids(payload.get("items"));
        String paymentMethod = stringValue(payload.getOrDefault("payment_method", "cod")).toLowerCase();
        String couponCode = stringValue(payload.getOrDefault("coupon_code", "")).toUpperCase();
        if (itemIds.isEmpty()) {
            throw new IllegalArgumentException("At least one cart item is required.");
        }
        if (!List.of("cod", "upi", "card").contains(paymentMethod)) {
            throw new IllegalArgumentException("Unsupported payment method.");
        }
        List<CartItem> cartItems = cartItemRepository.findAllById(itemIds);
        if (cartItems.size() != itemIds.size()) {
            throw new IllegalArgumentException("One or more cart items were not found.");
        }
        if (cartItems.stream().anyMatch(item -> !item.getUser().getId().equals(user.getId()))) {
            throw new AccessDeniedException("Payment initialization contains cart items that do not belong to you.");
        }

        double subtotal = cartItems.stream().mapToDouble(item -> item.getQuantity() * item.getMedicine().getPrice()).sum();
        double deliveryFee = subtotal >= 499 ? 0d : 35d;
        double taxAmount = round(subtotal * 0.05d);
        double discountAmount = "FIRST50".equals(couponCode) ? Math.min(50d, subtotal) : 0d;
        double totalAmount = round(Math.max(0d, subtotal + deliveryFee + taxAmount - discountAmount));

        PaymentTransaction transaction = PaymentTransaction.builder()
                .user(user)
                .provider(providerName())
                .paymentMethod(paymentMethod)
                .amount(totalAmount)
                .currency("INR")
                .status(List.of("upi", "card").contains(paymentMethod) ? PaymentStatus.AUTHORIZED : PaymentStatus.INITIATED)
                .gatewayOrderId("payord_" + UUID.randomUUID().toString().replace("-", ""))
                .clientToken("client_" + UUID.randomUUID().toString().replace("-", ""))
                .build();
        transaction = paymentTransactionRepository.save(transaction);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("detail", "Payment initialized.");
        response.put("payment", paymentToMap(transaction));
        response.put("pricing", Map.of(
                "subtotal", round(subtotal),
                "delivery_fee", round(deliveryFee),
                "tax_amount", round(taxAmount),
                "discount_amount", round(discountAmount),
                "total_amount", round(totalAmount)
        ));
        return ResponseEntity.status(201).body(response);
    }

    @PostMapping("/{paymentId}/confirm/")
    public ResponseEntity<Map<String, Object>> confirmPayment(Authentication authentication, @PathVariable Long paymentId, @RequestBody Map<String, Object> payload) {
        UserAccount user = currentUser(authentication);
        String action = stringValue(payload.getOrDefault("action", "capture")).toLowerCase();
        if (!List.of("capture", "fail").contains(action)) {
            throw new IllegalArgumentException("Invalid action.");
        }
        PaymentTransaction payment = paymentTransactionRepository.findById(paymentId).orElseThrow(() -> new IllegalArgumentException("Payment transaction not found."));
        if (!payment.getUser().getId().equals(user.getId())) {
            throw new AccessDeniedException("You are not allowed to update this payment transaction.");
        }
        if ("capture".equals(action)) {
            payment.setStatus(PaymentStatus.CAPTURED);
            if (payment.getGatewayPaymentId() == null || payment.getGatewayPaymentId().isBlank()) {
                payment.setGatewayPaymentId("pay_" + UUID.randomUUID().toString().replace("-", "").substring(0, 18));
            }
            payment.setErrorMessage("");
        } else {
            payment.setStatus(PaymentStatus.FAILED);
            payment.setErrorMessage("Payment marked as failed by client flow.");
        }
        payment = paymentTransactionRepository.save(payment);
        if (payment.getOrder() != null && payment.getStatus() == PaymentStatus.CAPTURED) {
            payment.getOrder().setPaymentStatus("paid");
            paymentRepositorySaveOrder(payment.getOrder());
        }
        return ResponseEntity.ok(Map.of("detail", "Payment status updated.", "payment", paymentToMap(payment)));
    }

    @GetMapping("/reconcile/")
    public ResponseEntity<Map<String, Object>> listReconciliations(Authentication authentication) {
        UserAccount user = currentUser(authentication);
        ensureAdmin(user);
        List<PaymentReconciliationRun> runs = paymentReconciliationRunRepository.findTop10ByOrderByCreatedAtDesc();
        PaymentReconciliationRun lastRun = runs.isEmpty() ? null : runs.get(0);
        Map<String, Object> response = new HashMap<>();
        response.put("last_run", lastRun == null ? null : reconciliationToMap(lastRun));
        response.put("recent_runs", runs.stream().map(this::reconciliationToMap).toList());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/reconcile/")
    public ResponseEntity<Map<String, Object>> reconcilePayments(Authentication authentication, @RequestBody Map<String, Object> payload) {
        UserAccount user = currentUser(authentication);
        ensureAdmin(user);
        int timeoutMinutes = integerValue(payload.getOrDefault("timeout_minutes", 30));
        int limit = integerValue(payload.getOrDefault("limit", 200));
        String statusFilter = stringValue(payload.getOrDefault("status_filter", "")).toLowerCase();
        String providerFilter = stringValue(payload.getOrDefault("provider_filter", ""));
        String paymentMethodFilter = stringValue(payload.getOrDefault("payment_method_filter", "")).toLowerCase();

        Instant cutoff = Instant.now().minus(Math.max(1, timeoutMinutes), ChronoUnit.MINUTES);
        List<PaymentStatus> statuses = new ArrayList<>(List.of(PaymentStatus.INITIATED, PaymentStatus.AUTHORIZED));
        if (List.of("initiated", "authorized").contains(statusFilter)) {
            statuses = List.of(PaymentStatus.valueOf(statusFilter.toUpperCase()));
        }

        List<PaymentTransaction> candidates = paymentTransactionRepository.findByStatusInAndCreatedAtBefore(statuses, cutoff).stream()
                .filter(transaction -> providerFilter.isBlank() || transaction.getProvider().equalsIgnoreCase(providerFilter))
                .filter(transaction -> paymentMethodFilter.isBlank() || transaction.getPaymentMethod().equalsIgnoreCase(paymentMethodFilter))
                .sorted((left, right) -> left.getCreatedAt().compareTo(right.getCreatedAt()))
                .limit(Math.max(1, limit))
                .toList();

        int failedPayments = 0;
        int failedOrders = 0;
        List<Long> updatedIds = new ArrayList<>();
        for (PaymentTransaction payment : candidates) {
            if (payment.getStatus() == PaymentStatus.INITIATED || payment.getStatus() == PaymentStatus.AUTHORIZED) {
                payment.setStatus(PaymentStatus.FAILED);
                payment.setErrorMessage("Marked failed by reconciliation run.");
                paymentTransactionRepository.save(payment);
                failedPayments++;
                updatedIds.add(payment.getId());
                if (payment.getOrder() != null) {
                    payment.getOrder().setPaymentStatus("failed");
                    paymentRepositorySaveOrder(payment.getOrder());
                    failedOrders++;
                }
            }
        }

        Map<String, Object> summary = Map.of(
                "reconciled", candidates.size(),
                "failed_payments", failedPayments,
                "failed_orders", failedOrders,
                "updated_ids", updatedIds
        );

        PaymentReconciliationRun run = PaymentReconciliationRun.builder()
                .triggeredBy(user)
                .timeoutMinutes(timeoutMinutes)
                .limitValue(limit)
                .statusFilter(statusFilter)
                .providerFilter(providerFilter)
                .paymentMethodFilter(paymentMethodFilter)
            .summaryJson(json(summary))
                .build();
        run = paymentReconciliationRunRepository.save(run);

        Map<String, Object> response = new HashMap<>();
        response.put("detail", "Reconciliation completed.");
        response.put("summary", summary);
        response.put("run", reconciliationToMap(run));
        return ResponseEntity.ok(response);
    }

    @PostMapping("/webhook/")
    public ResponseEntity<Map<String, Object>> webhook(@RequestBody Map<String, Object> payload, @RequestHeader Map<String, String> headers) {
        String provider = stringValue(headers.getOrDefault("x-payment-provider", configuredProvider)).toLowerCase();
        String body = payload.toString();
        boolean signatureValid = verifyMockSignature(body, headers);
        if (!signatureValid) {
            return ResponseEntity.badRequest().body(Map.of("detail", "Invalid webhook signature."));
        }

        String eventId = stringValue(payload.getOrDefault("event_id", ""));
        String eventName = stringValue(payload.getOrDefault("event", "payment.updated"));
        String idempotencyKey = stringValue(headers.getOrDefault("x-webhook-idempotency-key", ""));
        if (idempotencyKey.isBlank()) {
            idempotencyKey = provider + ":" + (eventId.isBlank() ? digest(body) : eventId + ":" + digest(body));
        }
        String webhookIdempotencyKey = idempotencyKey;

        PaymentWebhookEvent webhookEvent = paymentWebhookEventRepository.findByIdempotencyKey(webhookIdempotencyKey).orElseGet(() -> PaymentWebhookEvent.builder().idempotencyKey(webhookIdempotencyKey).build());
        if (webhookEvent.isProcessed()) {
            webhookEvent.setReplayCount(webhookEvent.getReplayCount() + 1);
            paymentWebhookEventRepository.save(webhookEvent);
            return ResponseEntity.ok(Map.of("detail", "Duplicate webhook ignored.", "idempotency_key", idempotencyKey));
        }

        String paymentReference = stringValue(extract(payload, "payment_reference", "gateway_order_id"));
        if (paymentReference.isBlank()) {
            webhookEvent.setProvider(provider);
            webhookEvent.setEventName(eventName);
            webhookEvent.setEventId(eventId);
            webhookEvent.setRawPayload(body);
            webhookEvent.setSignatureValid(signatureValid);
            webhookEvent.setErrorMessage("Missing payment reference.");
            paymentWebhookEventRepository.save(webhookEvent);
            return ResponseEntity.badRequest().body(Map.of("detail", "Missing payment reference."));
        }

        PaymentTransaction payment = paymentTransactionRepository.findFirstByGatewayOrderIdOrderByIdDesc(paymentReference).orElse(null);
        if (payment == null) {
            webhookEvent.setProvider(provider);
            webhookEvent.setEventName(eventName);
            webhookEvent.setEventId(eventId);
            webhookEvent.setPaymentReference(paymentReference);
            webhookEvent.setRawPayload(body);
            webhookEvent.setSignatureValid(signatureValid);
            webhookEvent.setErrorMessage("Payment transaction not found.");
            paymentWebhookEventRepository.save(webhookEvent);
            return ResponseEntity.status(404).body(Map.of("detail", "Payment transaction not found."));
        }

        String status = stringValue(extract(payload, "status", "state")).toLowerCase();
        if (status.contains("authorized")) {
            payment.setStatus(PaymentStatus.AUTHORIZED);
        } else if (status.contains("captured") || status.contains("paid")) {
            payment.setStatus(PaymentStatus.CAPTURED);
        } else if (status.contains("failed")) {
            payment.setStatus(PaymentStatus.FAILED);
        }
        String gatewayPaymentId = stringValue(extract(payload, "gateway_payment_id", "payment_id"));
        if (!gatewayPaymentId.isBlank()) {
            payment.setGatewayPaymentId(gatewayPaymentId);
        }
        payment.setErrorMessage(payment.getStatus() == PaymentStatus.FAILED ? "Marked failed by webhook" : "");
        payment = paymentTransactionRepository.save(payment);

        webhookEvent.setProvider(provider);
        webhookEvent.setEventName(eventName);
        webhookEvent.setEventId(eventId);
        webhookEvent.setPayment(payment);
        webhookEvent.setPaymentReference(paymentReference);
        webhookEvent.setGatewayPaymentId(gatewayPaymentId);
        webhookEvent.setStatus(payment.getStatus().name().toLowerCase());
        webhookEvent.setRawPayload(body);
        webhookEvent.setSignatureValid(signatureValid);
        webhookEvent.setProcessed(true);
        webhookEvent.setErrorMessage("");
        paymentWebhookEventRepository.save(webhookEvent);

        if (payment.getOrder() != null && payment.getStatus() == PaymentStatus.CAPTURED) {
            payment.getOrder().setPaymentStatus("paid");
            payment.getOrder().setPaymentReference(payment.getGatewayOrderId());
            paymentRepositorySaveOrder(payment.getOrder());
        }

        return ResponseEntity.ok(Map.of(
                "detail", "Webhook processed.",
                "idempotency_key", idempotencyKey,
                "payment", paymentToMap(payment)
        ));
    }

    private UserAccount currentUser(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof UserPrincipal principal)) {
            throw new AccessDeniedException("Authentication required.");
        }
        return principal.getUserAccount();
    }

    private void ensureAdmin(UserAccount user) {
        if (!user.isStaff() && user.getRole() != com.medifind.pharmaxpress.model.UserRole.ADMIN) {
            throw new AccessDeniedException("Only admin users can access reconciliation.");
        }
    }

    private Map<String, Object> paymentToMap(PaymentTransaction payment) {
        Map<String, Object> mapped = new HashMap<>();
        mapped.put("id", payment.getId());
        mapped.put("user", payment.getUser().getId());
        mapped.put("username", payment.getUser().getUsername());
        mapped.put("order", payment.getOrder() == null ? null : payment.getOrder().getId());
        mapped.put("provider", payment.getProvider());
        mapped.put("payment_method", payment.getPaymentMethod());
        mapped.put("amount", payment.getAmount());
        mapped.put("currency", payment.getCurrency());
        mapped.put("status", payment.getStatus().name().toLowerCase());
        mapped.put("gateway_order_id", payment.getGatewayOrderId());
        mapped.put("gateway_payment_id", payment.getGatewayPaymentId());
        mapped.put("client_token", payment.getClientToken());
        mapped.put("error_message", payment.getErrorMessage());
        mapped.put("created_at", payment.getCreatedAt());
        mapped.put("updated_at", payment.getUpdatedAt());
        return mapped;
    }

    private Map<String, Object> webhookToMap(PaymentWebhookEvent event) {
        Map<String, Object> mapped = new HashMap<>();
        mapped.put("id", event.getId());
        mapped.put("provider", event.getProvider());
        mapped.put("event_name", event.getEventName());
        mapped.put("event_id", event.getEventId());
        mapped.put("idempotency_key", event.getIdempotencyKey());
        mapped.put("payment", event.getPayment() == null ? null : event.getPayment().getId());
        mapped.put("payment_id", event.getPayment() == null ? null : event.getPayment().getId());
        mapped.put("payment_reference", event.getPaymentReference());
        mapped.put("gateway_payment_id", event.getGatewayPaymentId());
        mapped.put("status", event.getStatus());
        mapped.put("raw_payload", event.getRawPayload());
        mapped.put("signature_valid", event.isSignatureValid());
        mapped.put("processed", event.isProcessed());
        mapped.put("replay_count", event.getReplayCount());
        mapped.put("error_message", event.getErrorMessage());
        mapped.put("created_at", event.getCreatedAt());
        mapped.put("updated_at", event.getUpdatedAt());
        return mapped;
    }

    private Map<String, Object> reconciliationToMap(PaymentReconciliationRun run) {
        Map<String, Object> mapped = new HashMap<>();
        mapped.put("id", run.getId());
        mapped.put("triggered_by", run.getTriggeredBy() == null ? null : run.getTriggeredBy().getId());
        mapped.put("triggered_by_username", run.getTriggeredBy() == null ? null : run.getTriggeredBy().getUsername());
        mapped.put("timeout_minutes", run.getTimeoutMinutes());
        mapped.put("limit", run.getLimitValue());
        mapped.put("status_filter", run.getStatusFilter());
        mapped.put("provider_filter", run.getProviderFilter());
        mapped.put("payment_method_filter", run.getPaymentMethodFilter());
        mapped.put("summary_json", run.getSummaryJson());
        mapped.put("created_at", run.getCreatedAt());
        return mapped;
    }

    private void paymentRepositorySaveOrder(Order order) {
        orderRepository.save(order);
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
        return Integer.parseInt(String.valueOf(value));
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private Object extract(Map<String, Object> payload, String firstKey, String secondKey) {
        if (payload.containsKey(firstKey)) {
            return payload.get(firstKey);
        }
        return payload.get(secondKey);
    }

    private double round(double value) {
        return Math.round(value * 100d) / 100d;
    }

    private String providerName() {
        return configuredProvider == null || configuredProvider.isBlank() ? "mock_gateway" : configuredProvider;
    }

    private boolean verifyMockSignature(String body, Map<String, String> headers) {
        String given = stringValue(headers.get("x-mock-signature"));
        if (given.isBlank()) {
            return false;
        }
        String secret = stringValue(Optional.ofNullable(System.getenv("MOCK_PAYMENT_WEBHOOK_SECRET")).orElse("mock-webhook-secret"));
        String expected = hmacHex(secret, body);
        return expected.equalsIgnoreCase(given);
    }

    private String hmacHex(String secret, String body) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest((secret + "|" + body).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception exception) {
            return Base64.getEncoder().encodeToString((secret + body).getBytes(StandardCharsets.UTF_8));
        }
    }

    private String digest(String body) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(body.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            return UUID.randomUUID().toString().replace("-", "");
        }
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception exception) {
            return String.valueOf(value);
        }
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
