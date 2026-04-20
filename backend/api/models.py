from django.db import models
from django.contrib.auth.models import User

class Shop(models.Model):
    owner = models.ForeignKey(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    area = models.CharField(max_length=100)
    state = models.CharField(max_length=100, blank=True, default="")
    gst_number = models.CharField(max_length=20, blank=True, default="")
    pan_number = models.CharField(max_length=20, blank=True, default="")
    bank_account_name = models.CharField(max_length=120, blank=True, default="")
    bank_account_number = models.CharField(max_length=40, blank=True, default="")
    ifsc_code = models.CharField(max_length=20, blank=True, default="")
    is_kyc_verified = models.BooleanField(default=False)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    rating = models.FloatField(default=4.0)

    def __str__(self):
        return self.name

class Medicine(models.Model):
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="medicines")
    name = models.CharField(max_length=100)
    brand = models.CharField(max_length=100, blank=True, default="")
    category = models.CharField(max_length=100, blank=True, default="General")
    description = models.TextField(blank=True, default="")
    composition = models.CharField(max_length=255, blank=True, default="")
    prescription_required = models.BooleanField(default=False)
    price = models.FloatField()
    in_stock = models.BooleanField(default=True)

    def __str__(self):
        return self.name

class CartItem(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    medicine = models.ForeignKey(Medicine, on_delete=models.CASCADE)
    quantity = models.IntegerField(default=1)


class WishlistItem(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    medicine = models.ForeignKey(Medicine, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "medicine")


class OrderStatus(models.TextChoices):
    PLACED = "placed", "Placed"
    PACKED = "packed", "Packed"
    SHIPPED = "shipped", "Shipped"
    OUT_FOR_DELIVERY = "out_for_delivery", "Out for delivery"
    DELIVERED = "delivered", "Delivered"
    CANCELLED = "cancelled", "Cancelled"

class Order(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    items = models.ManyToManyField(CartItem)
    status = models.CharField(max_length=32, choices=OrderStatus.choices, default=OrderStatus.PLACED)
    payment_method = models.CharField(max_length=20, blank=True, default="cod")
    payment_status = models.CharField(max_length=20, blank=True, default="pending")
    payment_reference = models.CharField(max_length=80, blank=True, default="")
    delivery_fee = models.FloatField(default=0)
    tax_amount = models.FloatField(default=0)
    discount_amount = models.FloatField(default=0)
    total_amount = models.FloatField(default=0)
    coupon_code = models.CharField(max_length=40, blank=True, default="")
    tracking_id = models.CharField(max_length=40, blank=True, default="")
    delivery_address = models.TextField(blank=True, default="")
    mobile_number = models.CharField(max_length=20, blank=True, default="")
    house_number = models.CharField(max_length=120, blank=True, default="")
    street = models.CharField(max_length=160, blank=True, default="")
    city = models.CharField(max_length=120, blank=True, default="")
    state = models.CharField(max_length=120, blank=True, default="")
    pincode = models.CharField(max_length=20, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)


class PaymentStatus(models.TextChoices):
    INITIATED = "initiated", "Initiated"
    AUTHORIZED = "authorized", "Authorized"
    CAPTURED = "captured", "Captured"
    FAILED = "failed", "Failed"


class PaymentTransaction(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    order = models.ForeignKey(Order, on_delete=models.SET_NULL, null=True, blank=True, related_name="payments")
    provider = models.CharField(max_length=40, blank=True, default="mock_gateway")
    payment_method = models.CharField(max_length=20, blank=True, default="cod")
    amount = models.FloatField(default=0)
    currency = models.CharField(max_length=10, blank=True, default="INR")
    status = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.INITIATED)
    gateway_order_id = models.CharField(max_length=80, blank=True, default="")
    gateway_payment_id = models.CharField(max_length=80, blank=True, default="")
    client_token = models.CharField(max_length=120, blank=True, default="")
    error_message = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class PaymentWebhookEvent(models.Model):
    provider = models.CharField(max_length=40, blank=True, default="mock_gateway")
    event_name = models.CharField(max_length=100, blank=True, default="")
    event_id = models.CharField(max_length=120, blank=True, default="")
    idempotency_key = models.CharField(max_length=140, unique=True)
    payment = models.ForeignKey(
        PaymentTransaction,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="webhook_events",
    )
    payment_reference = models.CharField(max_length=120, blank=True, default="")
    gateway_payment_id = models.CharField(max_length=120, blank=True, default="")
    status = models.CharField(max_length=40, blank=True, default="")
    raw_payload = models.TextField(blank=True, default="")
    signature_valid = models.BooleanField(default=False)
    processed = models.BooleanField(default=False)
    replay_count = models.IntegerField(default=0)
    error_message = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class PaymentReconciliationRun(models.Model):
    triggered_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    timeout_minutes = models.IntegerField(default=30)
    limit = models.IntegerField(default=200)
    status_filter = models.CharField(max_length=20, blank=True, default="")
    provider_filter = models.CharField(max_length=40, blank=True, default="")
    payment_method_filter = models.CharField(max_length=20, blank=True, default="")
    summary_json = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)


class Review(models.Model):
    class ModerationStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    medicine = models.ForeignKey(Medicine, on_delete=models.CASCADE, related_name="reviews")
    rating = models.IntegerField(default=5)
    title = models.CharField(max_length=140, blank=True, default="")
    comment = models.TextField(blank=True, default="")
    verified_purchase = models.BooleanField(default=False)
    moderation_status = models.CharField(
        max_length=20,
        choices=ModerationStatus.choices,
        default=ModerationStatus.PENDING,
    )
    moderated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="moderated_reviews",
    )
    moderated_at = models.DateTimeField(null=True, blank=True)
    seller_response = models.TextField(blank=True, default="")
    seller_response_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class ReturnRequestStatus(models.TextChoices):
    REQUESTED = "requested", "Requested"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"
    COMPLETED = "completed", "Completed"


class ReturnRequest(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="return_requests")
    reason = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, choices=ReturnRequestStatus.choices, default=ReturnRequestStatus.REQUESTED)
    resolved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resolved_return_requests",
    )
    resolution_note = models.TextField(blank=True, default="")
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField(max_length=140)
    message = models.TextField(blank=True, default="")
    kind = models.CharField(max_length=40, blank=True, default="general")
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class UserRole(models.TextChoices):
    BUYER = "buyer", "Buyer"
    SELLER = "seller", "Seller"
    ADMIN = "admin", "Admin"


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=20, choices=UserRole.choices, default=UserRole.BUYER)
    mobile_number = models.CharField(max_length=20, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)


class OTPCode(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    mobile_number = models.CharField(max_length=20, blank=True, default="")
    email_address = models.CharField(max_length=254, blank=True, default="")
    purpose = models.CharField(max_length=40, default="mobile_verify")
    code = models.CharField(max_length=8)
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        ordering = ["-created_at"]


class PrescriptionStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"


class Prescription(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    medicine = models.ForeignKey(Medicine, on_delete=models.CASCADE)
    file = models.FileField(upload_to="prescriptions/", null=True, blank=True)
    note = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, choices=PrescriptionStatus.choices, default=PrescriptionStatus.PENDING)
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="reviewed_prescriptions")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class FraudRiskEvent(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    action = models.CharField(max_length=80)
    risk_level = models.CharField(max_length=20, default="low")
    reason = models.TextField(blank=True, default="")
    context = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]