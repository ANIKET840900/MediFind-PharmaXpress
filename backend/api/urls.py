from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ShopViewSet,
    MedicineViewSet,
    CartItemViewSet,
    OrderViewSet,
    WishlistItemViewSet,
    SignupView,
    LoginView,
    MeView,
    LogoutView,
    ForgotUsernameView,
    ForgotPasswordView,
    MedicineSuggestionsView,
    OrderStatusUpdateView,
    ReviewViewSet,
    ReturnRequestViewSet,
    CancelOrderView,
    NotificationViewSet,
    NotificationsMarkReadView,
    ReviewModerationView,
    ReviewSellerResponseView,
    SellerReturnDashboardView,
    ManageReturnRequestView,
    ProfileView,
    AssignRoleView,
    PrescriptionViewSet,
    PrescriptionReviewView,
    FraudRiskEventViewSet,
    PaymentInitializeView,
    PaymentConfirmView,
    PaymentTransactionListView,
    PaymentTransactionDetailView,
    PaymentWebhookView,
    PaymentReconciliationView,
)

router = DefaultRouter()
router.register('shops', ShopViewSet, basename='shop')
router.register('medicines', MedicineViewSet, basename='medicine')
router.register('cart', CartItemViewSet, basename='cart-item')
router.register('orders', OrderViewSet, basename='order')
router.register('wishlist', WishlistItemViewSet, basename='wishlist-item')
router.register('reviews', ReviewViewSet, basename='review')
router.register('returns', ReturnRequestViewSet, basename='return-request')
router.register('notifications', NotificationViewSet, basename='notification')
router.register('prescriptions', PrescriptionViewSet, basename='prescription')
router.register('fraud-events', FraudRiskEventViewSet, basename='fraud-event')

urlpatterns = [
    path('auth/signup/', SignupView.as_view()),
    path('auth/login/', LoginView.as_view()),
    path('auth/forgot-username/', ForgotUsernameView.as_view()),
    path('auth/forgot-password/', ForgotPasswordView.as_view()),
    path('auth/me/', MeView.as_view()),
    path('auth/profile/', ProfileView.as_view()),
    path('auth/assign-role/', AssignRoleView.as_view()),
    path('auth/logout/', LogoutView.as_view()),
    path('medicines/suggestions/', MedicineSuggestionsView.as_view()),
    path('orders/<int:order_id>/status/', OrderStatusUpdateView.as_view()),
    path('orders/<int:order_id>/cancel/', CancelOrderView.as_view()),
    path('payments/', PaymentTransactionListView.as_view()),
    path('payments/initialize/', PaymentInitializeView.as_view()),
    path('payments/<int:payment_id>/confirm/', PaymentConfirmView.as_view()),
    path('payments/<int:payment_id>/history/', PaymentTransactionDetailView.as_view()),
    path('payments/reconcile/', PaymentReconciliationView.as_view()),
    path('payments/webhook/', PaymentWebhookView.as_view()),
    path('reviews/<int:review_id>/moderate/', ReviewModerationView.as_view()),
    path('reviews/<int:review_id>/respond/', ReviewSellerResponseView.as_view()),
    path('returns/manage/', SellerReturnDashboardView.as_view()),
    path('returns/<int:return_id>/manage/', ManageReturnRequestView.as_view()),
    path('prescriptions/<int:prescription_id>/review/', PrescriptionReviewView.as_view()),
    path('notifications/mark-read/', NotificationsMarkReadView.as_view()),
    path('', include(router.urls)),
]