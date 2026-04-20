from django.contrib import admin
from django.utils import timezone

from .models import (
	Shop,
	Medicine,
	CartItem,
	Order,
	WishlistItem,
	Review,
	ReturnRequest,
	Notification,
	UserProfile,
	OTPCode,
	Prescription,
)


@admin.register(Shop)
class ShopAdmin(admin.ModelAdmin):
	list_display = ("id", "name", "owner", "area", "state", "rating")
	search_fields = ("name", "owner__username", "area", "state")
	list_filter = ("state",)


@admin.register(Medicine)
class MedicineAdmin(admin.ModelAdmin):
	list_display = ("id", "name", "brand", "category", "shop", "price", "in_stock", "prescription_required")
	search_fields = ("name", "brand", "category", "shop__name")
	list_filter = ("in_stock", "prescription_required", "category")


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
	list_display = ("id", "user", "medicine", "quantity")
	search_fields = ("user__username", "medicine__name")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
	list_display = ("id", "tracking_id", "user", "status", "payment_method", "payment_status", "payment_reference", "total_amount", "created_at")
	search_fields = ("tracking_id", "user__username", "mobile_number", "city", "state")
	list_filter = ("status", "payment_method", "payment_status", "created_at")
	readonly_fields = ("tracking_id", "created_at")


@admin.register(WishlistItem)
class WishlistItemAdmin(admin.ModelAdmin):
	list_display = ("id", "user", "medicine", "created_at")
	search_fields = ("user__username", "medicine__name")


@admin.action(description="Approve selected reviews")
def approve_reviews(modeladmin, request, queryset):
	queryset.update(
		moderation_status=Review.ModerationStatus.APPROVED,
		moderated_by=request.user,
		moderated_at=timezone.now(),
	)


@admin.action(description="Reject selected reviews")
def reject_reviews(modeladmin, request, queryset):
	queryset.update(
		moderation_status=Review.ModerationStatus.REJECTED,
		moderated_by=request.user,
		moderated_at=timezone.now(),
	)


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
	list_display = (
		"id",
		"medicine",
		"user",
		"rating",
		"verified_purchase",
		"moderation_status",
		"moderated_by",
		"created_at",
	)
	search_fields = ("medicine__name", "user__username", "title", "comment")
	list_filter = ("moderation_status", "verified_purchase", "rating", "created_at")
	readonly_fields = ("created_at", "moderated_at", "seller_response_at")
	actions = [approve_reviews, reject_reviews]


@admin.action(description="Mark return requests as approved")
def approve_returns(modeladmin, request, queryset):
	queryset.update(
		status="approved",
		resolved_by=request.user,
		resolved_at=timezone.now(),
	)


@admin.action(description="Mark return requests as rejected")
def reject_returns(modeladmin, request, queryset):
	queryset.update(
		status="rejected",
		resolved_by=request.user,
		resolved_at=timezone.now(),
	)


@admin.action(description="Mark return requests as completed")
def complete_returns(modeladmin, request, queryset):
	queryset.update(
		status="completed",
		resolved_by=request.user,
		resolved_at=timezone.now(),
	)


@admin.register(ReturnRequest)
class ReturnRequestAdmin(admin.ModelAdmin):
	list_display = ("id", "order", "user", "status", "resolved_by", "created_at", "resolved_at")
	search_fields = ("order__tracking_id", "user__username", "reason", "resolution_note")
	list_filter = ("status", "created_at", "resolved_at")
	readonly_fields = ("created_at", "resolved_at")
	actions = [approve_returns, reject_returns, complete_returns]


@admin.action(description="Mark selected notifications as read")
def mark_notifications_read(modeladmin, request, queryset):
	queryset.update(is_read=True)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
	list_display = ("id", "user", "kind", "title", "is_read", "created_at")
	search_fields = ("user__username", "title", "message", "kind")
	list_filter = ("kind", "is_read", "created_at")
	readonly_fields = ("created_at",)
	actions = [mark_notifications_read]


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
	list_display = ("id", "user", "role", "mobile_number", "created_at")
	search_fields = ("user__username", "mobile_number")
	list_filter = ("role",)


@admin.register(OTPCode)
class OTPCodeAdmin(admin.ModelAdmin):
	list_display = ("id", "user", "mobile_number", "purpose", "code", "is_used", "expires_at", "created_at")
	search_fields = ("user__username", "mobile_number", "code")
	list_filter = ("purpose", "is_used")
	readonly_fields = ("created_at",)


@admin.action(description="Approve selected prescriptions")
def approve_prescriptions(modeladmin, request, queryset):
	queryset.update(status="approved", reviewed_by=request.user)


@admin.action(description="Reject selected prescriptions")
def reject_prescriptions(modeladmin, request, queryset):
	queryset.update(status="rejected", reviewed_by=request.user)


@admin.register(Prescription)
class PrescriptionAdmin(admin.ModelAdmin):
	list_display = ("id", "user", "medicine", "status", "reviewed_by", "created_at", "reviewed_at")
	search_fields = ("user__username", "medicine__name", "note", "rejection_reason")
	list_filter = ("status", "created_at")
	readonly_fields = ("created_at", "reviewed_at")
	actions = [approve_prescriptions, reject_prescriptions]
