from rest_framework import serializers
from django.db.models import Avg
from pathlib import Path
from .models import (
    Shop,
    Medicine,
    CartItem,
    Order,
    PaymentTransaction,
    PaymentWebhookEvent,
    PaymentReconciliationRun,
    WishlistItem,
    Review,
    ReturnRequest,
    Notification,
    UserProfile,
    OTPCode,
    Prescription,
    FraudRiskEvent,
)

class MedicineSerializer(serializers.ModelSerializer):
    shop_name = serializers.CharField(source="shop.name", read_only=True)
    shop_area = serializers.CharField(source="shop.area", read_only=True)
    shop_state = serializers.CharField(source="shop.state", read_only=True)
    shop_latitude = serializers.FloatField(source="shop.latitude", read_only=True)
    shop_longitude = serializers.FloatField(source="shop.longitude", read_only=True)
    shop_rating = serializers.FloatField(source="shop.rating", read_only=True)
    image_url = serializers.SerializerMethodField()
    average_rating = serializers.SerializerMethodField()
    rating_count = serializers.SerializerMethodField()

    def get_image_url(self, obj):
        seed = (obj.name or "medicine").strip().replace(" ", "-").lower()
        return f"https://picsum.photos/seed/medicine-{seed}/420/260"

    def get_rating_count(self, obj):
        return obj.reviews.count()

    def get_average_rating(self, obj):
        aggregate = obj.reviews.aggregate(avg=Avg("rating"))
        value = aggregate.get("avg")
        if value is None:
            return round(float(obj.shop.rating or 0), 1)
        return round(float(value), 1)

    class Meta:
        model = Medicine
        fields = [
            "id",
            "shop",
            "shop_name",
            "shop_area",
            "shop_state",
            "shop_latitude",
            "shop_longitude",
            "shop_rating",
            "name",
            "brand",
            "category",
            "description",
            "composition",
            "prescription_required",
            "price",
            "image_url",
            "average_rating",
            "rating_count",
            "in_stock",
        ]

class ShopSerializer(serializers.ModelSerializer):
    medicines = MedicineSerializer(many=True, read_only=True)

    class Meta:
        model = Shop
        fields = '__all__'
        read_only_fields = ['owner']

class CartItemSerializer(serializers.ModelSerializer):
    medicine_detail = MedicineSerializer(source="medicine", read_only=True)

    class Meta:
        model = CartItem
        fields = ["id", "user", "medicine", "medicine_detail", "quantity"]
        read_only_fields = ['user']

class OrderSerializer(serializers.ModelSerializer):
    items_detail = CartItemSerializer(source="items", many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "user",
            "items",
            "items_detail",
            "status",
            "payment_method",
            "delivery_fee",
            "tax_amount",
            "discount_amount",
            "total_amount",
            "coupon_code",
            "tracking_id",
            "delivery_address",
            "mobile_number",
            "house_number",
            "street",
            "city",
            "state",
            "pincode",
            "created_at",
        ]
        read_only_fields = ['user', 'created_at', 'status', 'delivery_fee', 'tax_amount', 'discount_amount', 'total_amount', 'tracking_id']


class WishlistItemSerializer(serializers.ModelSerializer):
    medicine_detail = MedicineSerializer(source="medicine", read_only=True)

    class Meta:
        model = WishlistItem
        fields = ["id", "user", "medicine", "medicine_detail", "created_at"]
        read_only_fields = ["user", "created_at"]


class ReviewSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    medicine_name = serializers.CharField(source="medicine.name", read_only=True)
    moderated_by_username = serializers.CharField(source="moderated_by.username", read_only=True)

    class Meta:
        model = Review
        fields = [
            "id",
            "user",
            "username",
            "medicine",
            "medicine_name",
            "rating",
            "title",
            "comment",
            "verified_purchase",
            "moderation_status",
            "moderated_by",
            "moderated_by_username",
            "moderated_at",
            "seller_response",
            "seller_response_at",
            "created_at",
        ]
        read_only_fields = [
            "user",
            "verified_purchase",
            "moderation_status",
            "moderated_by",
            "moderated_by_username",
            "moderated_at",
            "seller_response",
            "seller_response_at",
            "created_at",
        ]


class ReturnRequestSerializer(serializers.ModelSerializer):
    order_tracking_id = serializers.CharField(source="order.tracking_id", read_only=True)
    resolved_by_username = serializers.CharField(source="resolved_by.username", read_only=True)

    class Meta:
        model = ReturnRequest
        fields = [
            "id",
            "user",
            "order",
            "order_tracking_id",
            "reason",
            "status",
            "resolved_by",
            "resolved_by_username",
            "resolution_note",
            "resolved_at",
            "created_at",
        ]
        read_only_fields = [
            "user",
            "status",
            "resolved_by",
            "resolved_by_username",
            "resolution_note",
            "resolved_at",
            "created_at",
        ]


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "user", "title", "message", "kind", "is_read", "created_at"]
        read_only_fields = ["user", "title", "message", "kind", "created_at"]


class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            "username",
            "email",
            "role",
            "mobile_number",
            "is_mobile_verified",
        ]
        read_only_fields = ["role", "is_mobile_verified"]


class OTPCodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = OTPCode
        fields = ["id", "mobile_number", "purpose", "code", "is_used", "created_at", "expires_at"]
        read_only_fields = ["id", "is_used", "created_at", "expires_at"]


class PrescriptionSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source="medicine.name", read_only=True)
    reviewed_by_username = serializers.CharField(source="reviewed_by.username", read_only=True)
    file_url = serializers.SerializerMethodField()

    def get_file_url(self, obj):
        if obj.file:
            try:
                return obj.file.url
            except Exception:
                return ""
        return ""

    def validate_file(self, value):
        if not value:
            return value

        max_bytes = 5 * 1024 * 1024
        if value.size > max_bytes:
            raise serializers.ValidationError("Prescription file must be 5MB or smaller.")

        allowed_ext = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}
        ext = Path(value.name or "").suffix.lower()
        if ext not in allowed_ext:
            raise serializers.ValidationError("Allowed prescription formats: JPG, JPEG, PNG, WEBP, PDF.")

        content_type = (getattr(value, "content_type", "") or "").lower()
        if content_type and not (
            content_type.startswith("image/") or content_type == "application/pdf"
        ):
            raise serializers.ValidationError("Invalid prescription content type.")

        return value

    class Meta:
        model = Prescription
        fields = [
            "id",
            "user",
            "medicine",
            "medicine_name",
            "file",
            "file_url",
            "note",
            "status",
            "reviewed_by",
            "reviewed_by_username",
            "reviewed_at",
            "rejection_reason",
            "created_at",
        ]
        read_only_fields = [
            "user",
            "status",
            "reviewed_by",
            "reviewed_by_username",
            "reviewed_at",
            "rejection_reason",
            "created_at",
        ]


class FraudRiskEventSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = FraudRiskEvent
        fields = ["id", "user", "username", "action", "risk_level", "reason", "context", "created_at"]
        read_only_fields = ["user", "username", "created_at"]


class PaymentTransactionSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = PaymentTransaction
        fields = [
            "id",
            "user",
            "username",
            "order",
            "provider",
            "payment_method",
            "amount",
            "currency",
            "status",
            "gateway_order_id",
            "gateway_payment_id",
            "client_token",
            "error_message",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["user", "username", "created_at", "updated_at"]


class PaymentWebhookEventSerializer(serializers.ModelSerializer):
    payment_id = serializers.IntegerField(source="payment.id", read_only=True)

    class Meta:
        model = PaymentWebhookEvent
        fields = [
            "id",
            "provider",
            "event_name",
            "event_id",
            "idempotency_key",
            "payment",
            "payment_id",
            "payment_reference",
            "gateway_payment_id",
            "status",
            "raw_payload",
            "signature_valid",
            "processed",
            "replay_count",
            "error_message",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class PaymentReconciliationRunSerializer(serializers.ModelSerializer):
    triggered_by_username = serializers.CharField(source="triggered_by.username", read_only=True)
    summary = serializers.SerializerMethodField()

    def get_summary(self, obj):
        import json

        if not obj.summary_json:
            return {}
        try:
            return json.loads(obj.summary_json)
        except Exception:
            return {}

    class Meta:
        model = PaymentReconciliationRun
        fields = [
            "id",
            "triggered_by",
            "triggered_by_username",
            "timeout_minutes",
            "limit",
            "status_filter",
            "provider_filter",
            "payment_method_filter",
            "summary_json",
            "summary",
            "created_at",
        ]
        read_only_fields = ["triggered_by", "triggered_by_username", "summary_json", "summary", "created_at"]