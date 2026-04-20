from django.contrib.auth import authenticate, get_user_model
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.core.mail import send_mail
from django.utils import timezone
import hashlib
import math
import re
import logging
import json
from uuid import uuid4
from datetime import timedelta
from django.db.models import Q
from rest_framework import viewsets
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.permissions import AllowAny
from rest_framework.exceptions import PermissionDenied
from rest_framework.authtoken.models import Token
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser, FormParser
from .payments import get_payment_provider
from .models import (
    Shop,
    Medicine,
    CartItem,
    Order,
    WishlistItem,
    FraudRiskEvent,
    OrderStatus,
    Review,
    ReturnRequest,
    ReturnRequestStatus,
    Notification,
    UserProfile,
    UserRole,
    Prescription,
    PrescriptionStatus,
    PaymentTransaction,
    PaymentStatus,
    PaymentWebhookEvent,
    PaymentReconciliationRun,
)
from .serializers import (
    ShopSerializer,
    FraudRiskEventSerializer,
    MedicineSerializer,
    CartItemSerializer,
    OrderSerializer,
    WishlistItemSerializer,
    ReviewSerializer,
    ReturnRequestSerializer,
    NotificationSerializer,
    UserProfileSerializer,
    PrescriptionSerializer,
    PaymentTransactionSerializer,
    PaymentWebhookEventSerializer,
    PaymentReconciliationRunSerializer,
)
from .reconciliation import reconcile_stale_payments

User = get_user_model()
logger = logging.getLogger(__name__)


def dispatch_notification(user, title: str, message: str, kind: str = "general", phone_number: str = ""):
    notification = Notification.objects.create(
        user=user,
        title=title,
        message=message,
        kind=kind,
    )

    if user.email:
        try:
            send_mail(
                subject=title,
                message=message,
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@medcompare.local"),
                recipient_list=[user.email],
                fail_silently=True,
            )
        except Exception:
            logger.exception("Email delivery failed for notification %s", notification.id)

    profile_mobile = ""
    if hasattr(user, "profile") and user.profile.mobile_number:
        profile_mobile = user.profile.mobile_number
    sms_target = (phone_number or profile_mobile or "").strip()
    sms_provider = getattr(settings, "SMS_PROVIDER", "").strip().lower()
    if sms_target and sms_provider == "twilio":
        account_sid = getattr(settings, "TWILIO_ACCOUNT_SID", "")
        auth_token = getattr(settings, "TWILIO_AUTH_TOKEN", "")
        from_number = getattr(settings, "TWILIO_FROM_NUMBER", "")
        if account_sid and auth_token and from_number:
            try:
                from twilio.rest import Client

                client = Client(account_sid, auth_token)
                client.messages.create(
                    body=f"{title}: {message}"[:1500],
                    from_=from_number,
                    to=sms_target,
                )
            except Exception:
                logger.exception("Twilio SMS delivery failed for notification %s", notification.id)
        else:
            logger.warning("Twilio SMS skipped for notification %s due to missing credentials", notification.id)
    elif sms_target:
        logger.info("SMS notification (no provider configured) to %s: %s - %s", sms_target, title, message)

    return notification


def log_fraud_risk(user, action: str, risk_level: str, reason: str, context: str = ""):
    FraudRiskEvent.objects.create(
        user=user,
        action=action,
        risk_level=risk_level,
        reason=reason,
        context=context,
    )


def validate_strong_password(password: str):
    if len(password) < 8:
        return False, "Password must be at least 8 characters."
    if not re.search(r"[A-Z]", password):
        return False, "Password must include at least one uppercase letter."
    if not re.search(r"[a-z]", password):
        return False, "Password must include at least one lowercase letter."
    if not re.search(r"\d", password):
        return False, "Password must include at least one number."
    if not re.search(r"[^A-Za-z0-9]", password):
        return False, "Password must include at least one special character."
    return True, ""


def haversine_distance_km(lat1, lon1, lat2, lon2):
    radius = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    )
    return radius * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


class MedicinePagination(PageNumberPagination):
    page_size = 8
    page_size_query_param = "page_size"
    max_page_size = 200


class SignupView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get("username", "").strip()
        password = request.data.get("password", "")
        email = request.data.get("email", "").strip()

        if not username or not password:
            return Response(
                {"detail": "Username and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not email:
            return Response(
                {"detail": "Email is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            validate_email(email)
        except ValidationError:
            return Response(
                {"detail": "Enter a valid email address."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if User.objects.filter(username=username).exists():
            return Response(
                {"detail": "Username already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if User.objects.filter(email__iexact=email).exists():
            return Response(
                {"detail": "Email already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        is_strong, password_error = validate_strong_password(password)
        if not is_strong:
            return Response({"detail": password_error}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(username=username, password=password, email=email)
        UserProfile.objects.get_or_create(user=user)

        return Response(
            {
                "detail": "Signup successful. Please sign in.",
                "user": {"id": user.id, "username": user.username, "email": user.email},
            },
            status=status.HTTP_201_CREATED,
        )


class ForgotUsernameView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip()

        if not email:
            return Response(
                {"detail": "Email is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_email(email)
        except ValidationError:
            return Response(
                {"detail": "Enter a valid email address."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        usernames = list(
            User.objects.filter(email__iexact=email).values_list("username", flat=True)
        )
        if not usernames:
            return Response(
                {"detail": "No account found for that email address."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if len(usernames) == 1:
            return Response({"username": usernames[0]})

        return Response({"usernames": usernames})


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get("username", "").strip()
        email = request.data.get("email", "").strip()
        new_password = request.data.get("new_password", "")

        if not username or not email or not new_password:
            return Response(
                {"detail": "Username, email, and new password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_email(email)
        except ValidationError:
            return Response(
                {"detail": "Enter a valid email address."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response(
                {"detail": "Invalid username."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if (user.email or "").lower() != email.lower():
            return Response(
                {"detail": "Invalid email for this username."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new_password) < 6:
            return Response(
                {"detail": "Password must be at least 6 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save(update_fields=["password"])
        Token.objects.filter(user=user).delete()

        return Response({"detail": "Password updated successfully. Please sign in again."})


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get("username", "").strip()
        identifier = request.data.get("identifier", "").strip()
        email = request.data.get("email", "").strip()
        password = request.data.get("password", "")

        login_identifier = identifier or username

        if not login_identifier:
            return Response(
                {"detail": "Username, email, or mobile number is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not password:
            return Response(
                {"detail": "Password is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if email:
            try:
                validate_email(email)
            except ValidationError:
                return Response(
                    {"detail": "Enter a valid email address."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        if identifier:
            matched_user = None
            if "@" in login_identifier:
                try:
                    validate_email(login_identifier)
                except ValidationError:
                    return Response(
                        {"detail": "Enter a valid email address."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                matched_user = User.objects.filter(email__iexact=login_identifier).first()
            elif any(ch.isdigit() for ch in login_identifier):
                profile = UserProfile.objects.select_related("user").filter(
                    mobile_number=login_identifier
                ).first()
                if profile:
                    matched_user = profile.user
            if matched_user is None:
                matched_user = User.objects.filter(username=login_identifier).first()

            if not matched_user:
                return Response(
                    {"detail": "Invalid username/email/mobile number."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            try:
                matched_user = User.objects.get(username=login_identifier)
            except User.DoesNotExist:
                return Response(
                    {"detail": "Invalid username."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        profile, _ = UserProfile.objects.get_or_create(user=matched_user)

        if email and (matched_user.email or "").lower() != email.lower():
            return Response(
                {"detail": "Invalid email for this username."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = authenticate(username=matched_user.username, password=password)
        if not user:
            return Response(
                {"detail": "Invalid password."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {
                "token": token.key,
                "user": {"id": user.id, "username": user.username, "email": user.email},
            }
        )


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        profile, _ = UserProfile.objects.get_or_create(user=user)
        return Response(
            {
                "id": user.id,
                "full_name": user.first_name,
                "username": user.username,
                "email": user.email,
                "role": profile.role,
                "mobile_number": profile.mobile_number,
            }
        )


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        return Response(UserProfileSerializer(profile).data)

    def patch(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        full_name = request.data.get("full_name", "").strip()
        email = request.data.get("email", "").strip()
        mobile_number = request.data.get("mobile_number", "").strip()

        if full_name:
            request.user.first_name = full_name
            request.user.save(update_fields=["first_name"])

        if email:
            try:
                validate_email(email)
            except ValidationError:
                return Response({"detail": "Enter a valid email address."}, status=status.HTTP_400_BAD_REQUEST)
            if User.objects.exclude(id=request.user.id).filter(email__iexact=email).exists():
                return Response({"detail": "Email already exists."}, status=status.HTTP_400_BAD_REQUEST)
            if (request.user.email or "").lower() != email.lower():
                request.user.email = email
                request.user.save(update_fields=["email"])

        if mobile_number:
            profile.mobile_number = mobile_number
        profile.save(update_fields=["mobile_number"])
        return Response(UserProfileSerializer(profile).data)


class AssignRoleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not request.user.is_staff:
            raise PermissionDenied("Only admin users can assign roles.")

        username = request.data.get("username", "").strip()
        role = request.data.get("role", "").strip()
        if role not in UserRole.values:
            return Response({"detail": "Invalid role."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            target_user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        profile, _ = UserProfile.objects.get_or_create(user=target_user)
        profile.role = role
        profile.save(update_fields=["role"])
        return Response({"detail": "Role updated successfully.", "username": username, "role": role})


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response({"detail": "Logged out successfully."})

class ShopViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ShopSerializer

    def get_queryset(self):
        mine = self.request.query_params.get("mine")
        if self.action in ["update", "partial_update", "destroy"]:
            return Shop.objects.filter(owner=self.request.user)
        if mine in ["1", "true", "True"]:
            return Shop.objects.filter(owner=self.request.user)
        return Shop.objects.all()

    def perform_create(self, serializer):
        profile, _ = UserProfile.objects.get_or_create(user=self.request.user)
        if profile.role not in [UserRole.SELLER, UserRole.ADMIN] and not self.request.user.is_staff:
            raise PermissionDenied("Only seller/admin accounts can register shops.")
        serializer.save(owner=self.request.user)

class MedicineViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = MedicineSerializer
    pagination_class = MedicinePagination

    def get_queryset(self):
        queryset = Medicine.objects.select_related("shop")
        mine = self.request.query_params.get("mine")
        query = self.request.query_params.get("q", "").strip()
        stock = self.request.query_params.get("in_stock")
        shop_id = self.request.query_params.get("shop")
        category = self.request.query_params.get("category", "").strip()
        brand = self.request.query_params.get("brand", "").strip()
        min_price = self.request.query_params.get("min_price")
        max_price = self.request.query_params.get("max_price")
        min_rating = self.request.query_params.get("min_rating")
        sort = self.request.query_params.get("sort", "").strip()
        near_lat = self.request.query_params.get("near_lat")
        near_lng = self.request.query_params.get("near_lng")
        radius_km = self.request.query_params.get("radius_km")

        if self.action in ["update", "partial_update", "destroy"]:
            return queryset.filter(shop__owner=self.request.user)

        if mine in ["1", "true", "True"]:
            queryset = queryset.filter(shop__owner=self.request.user)

        if query:
            queryset = queryset.filter(
                Q(name__icontains=query)
                | Q(brand__icontains=query)
                | Q(category__icontains=query)
                | Q(description__icontains=query)
                | Q(shop__name__icontains=query)
                | Q(shop__area__icontains=query)
                | Q(shop__state__icontains=query)
            )

        if category:
            queryset = queryset.filter(category__icontains=category)

        if brand:
            queryset = queryset.filter(brand__icontains=brand)

        if min_price:
            try:
                queryset = queryset.filter(price__gte=float(min_price))
            except (TypeError, ValueError):
                pass

        if max_price:
            try:
                queryset = queryset.filter(price__lte=float(max_price))
            except (TypeError, ValueError):
                pass

        if min_rating:
            try:
                queryset = queryset.filter(shop__rating__gte=float(min_rating))
            except (TypeError, ValueError):
                pass

        if stock in ["true", "false"]:
            queryset = queryset.filter(in_stock=(stock == "true"))

        if shop_id:
            queryset = queryset.filter(shop_id=shop_id)

        if sort == "price_asc":
            queryset = queryset.order_by("price")
        elif sort == "price_desc":
            queryset = queryset.order_by("-price")
        elif sort == "rating_desc":
            queryset = queryset.order_by("-shop__rating", "price")
        elif sort == "name_asc":
            queryset = queryset.order_by("name")
        else:
            queryset = queryset.order_by("-in_stock", "name")

        if near_lat and near_lng:
            try:
                origin_lat = float(near_lat)
                origin_lng = float(near_lng)
            except (TypeError, ValueError):
                return queryset

            queryset = list(queryset)
            enriched = []
            for medicine in queryset:
                if medicine.shop.latitude is None or medicine.shop.longitude is None:
                    continue
                distance_km = haversine_distance_km(
                    origin_lat,
                    origin_lng,
                    float(medicine.shop.latitude),
                    float(medicine.shop.longitude),
                )
                if radius_km:
                    try:
                        if distance_km > float(radius_km):
                            continue
                    except (TypeError, ValueError):
                        pass
                medicine.distance_km = round(distance_km, 2)
                enriched.append(medicine)
            if sort in ["", "distance_asc"]:
                enriched.sort(key=lambda item: getattr(item, "distance_km", float("inf")))
            return enriched

        return queryset

    def perform_create(self, serializer):
        shop = serializer.validated_data.get("shop")
        if shop.owner != self.request.user:
            raise PermissionDenied("You can only add medicines to your own shop.")
        serializer.save()

    def perform_update(self, serializer):
        shop = serializer.validated_data.get("shop", serializer.instance.shop)
        if shop.owner != self.request.user:
            raise PermissionDenied("You can only assign medicines to your own shop.")
        serializer.save()

class CartItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CartItemSerializer
    pagination_class = MedicinePagination

    def get_queryset(self):
        return CartItem.objects.filter(user=self.request.user).order_by('-id')

    def perform_create(self, serializer):
        medicine = serializer.validated_data.get("medicine")
        if not medicine.in_stock:
            raise PermissionDenied("This medicine is currently out of stock.")
        serializer.save(user=self.request.user)

class OrderViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = OrderSerializer
    pagination_class = MedicinePagination

    def get_queryset(self):
        return Order.objects.prefetch_related("items", "items__medicine").filter(user=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        order = serializer.save(user=self.request.user)
        invalid_items = [item.id for item in order.items.all() if item.user != self.request.user]
        if invalid_items:
            order.delete()
            raise PermissionDenied("Order contains cart items that do not belong to you.")

        prescription_required_items = [
            item for item in order.items.select_related("medicine") if item.medicine.prescription_required
        ]
        for item in prescription_required_items:
            approved_exists = Prescription.objects.filter(
                user=self.request.user,
                medicine=item.medicine,
                status=PrescriptionStatus.APPROVED,
            ).exists()
            if not approved_exists:
                order.delete()
                raise PermissionDenied(
                    f"Prescription approval required for {item.medicine.name}. Upload prescription before checkout."
                )

        subtotal = sum(item.quantity * item.medicine.price for item in order.items.select_related("medicine"))
        delivery_fee = 0 if subtotal >= 499 else 35
        tax_amount = round(subtotal * 0.05, 2)
        discount_amount = 0
        coupon = (order.coupon_code or "").strip().upper()
        if coupon == "FIRST50":
            discount_amount = min(50, subtotal)

        total_amount = max(0, subtotal + delivery_fee + tax_amount - discount_amount)
        payment_reference = (order.payment_reference or "").strip()
        payment_status = "pending"
        if order.payment_method in ["upi", "card"]:
            payment = PaymentTransaction.objects.filter(
                user=self.request.user,
                gateway_order_id=payment_reference,
            ).first()
            if payment:
                payment.order = order
                if payment.status == PaymentStatus.AUTHORIZED:
                    payment.status = PaymentStatus.CAPTURED
                    payment.gateway_payment_id = payment.gateway_payment_id or f"pay_{uuid4().hex[:18]}"
                payment.save(update_fields=["order", "status", "gateway_payment_id", "updated_at"])
                payment_status = "paid" if payment.status == PaymentStatus.CAPTURED else "pending"

        order.delivery_fee = delivery_fee
        order.tax_amount = tax_amount
        order.discount_amount = discount_amount
        order.total_amount = round(total_amount, 2)
        order.tracking_id = f"TRK{order.id:06d}"
        order.payment_status = payment_status
        order.status = OrderStatus.PLACED
        order.save(update_fields=["delivery_fee", "tax_amount", "discount_amount", "total_amount", "tracking_id", "status", "payment_status"])
        dispatch_notification(
            user=order.user,
            title="Order placed successfully",
            message=f"Your order {order.tracking_id} has been placed.",
            kind="order",
            phone_number=order.mobile_number,
        )


class PaymentInitializeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        item_ids = request.data.get("items", [])
        payment_method = (request.data.get("payment_method", "cod") or "cod").strip().lower()
        coupon_code = (request.data.get("coupon_code", "") or "").strip().upper()

        if not isinstance(item_ids, list) or not item_ids:
            return Response({"detail": "At least one cart item is required."}, status=status.HTTP_400_BAD_REQUEST)

        if payment_method not in ["cod", "upi", "card"]:
            return Response({"detail": "Unsupported payment method."}, status=status.HTTP_400_BAD_REQUEST)

        items = list(CartItem.objects.select_related("medicine").filter(id__in=item_ids))
        if len(items) != len(item_ids):
            return Response({"detail": "One or more cart items were not found."}, status=status.HTTP_400_BAD_REQUEST)

        if any(item.user_id != request.user.id for item in items):
            raise PermissionDenied("Payment initialization contains cart items that do not belong to you.")

        subtotal = sum(item.quantity * item.medicine.price for item in items)
        delivery_fee = 0 if subtotal >= 499 else 35
        tax_amount = round(subtotal * 0.05, 2)
        discount_amount = 0
        if coupon_code == "FIRST50":
            discount_amount = min(50, subtotal)

        total_amount = round(max(0, subtotal + delivery_fee + tax_amount - discount_amount), 2)
        provider = get_payment_provider()
        try:
            intent = provider.create_payment_intent(
                amount=total_amount,
                currency="INR",
                payment_method=payment_method,
                metadata={"user_id": request.user.id, "item_ids": item_ids},
            )
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        transaction = PaymentTransaction.objects.create(
            user=request.user,
            provider=intent.get("provider", "mock_gateway"),
            payment_method=payment_method,
            amount=total_amount,
            currency="INR",
            status=intent.get("status", PaymentStatus.INITIATED),
            gateway_order_id=intent.get("gateway_order_id", ""),
            client_token=intent.get("client_token", ""),
        )

        serializer = PaymentTransactionSerializer(transaction)
        return Response(
            {
                "detail": "Payment initialized.",
                "payment": serializer.data,
                "pricing": {
                    "subtotal": round(subtotal, 2),
                    "delivery_fee": delivery_fee,
                    "tax_amount": tax_amount,
                    "discount_amount": discount_amount,
                    "total_amount": total_amount,
                },
            },
            status=status.HTTP_201_CREATED,
        )


class PaymentConfirmView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, payment_id):
        action = (request.data.get("action", "capture") or "capture").strip().lower()
        if action not in ["capture", "fail"]:
            return Response({"detail": "Invalid action."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payment = PaymentTransaction.objects.get(id=payment_id, user=request.user)
        except PaymentTransaction.DoesNotExist:
            return Response({"detail": "Payment transaction not found."}, status=status.HTTP_404_NOT_FOUND)

        if action == "capture":
            payment.status = PaymentStatus.CAPTURED
            payment.gateway_payment_id = payment.gateway_payment_id or f"pay_{uuid4().hex[:18]}"
            payment.error_message = ""
        else:
            payment.status = PaymentStatus.FAILED
            payment.error_message = "Payment marked as failed by client flow."

        payment.save(update_fields=["status", "gateway_payment_id", "error_message", "updated_at"])
        if payment.order_id and payment.status == PaymentStatus.CAPTURED:
            payment.order.payment_status = "paid"
            payment.order.save(update_fields=["payment_status"])

        return Response({"detail": "Payment status updated.", "payment": PaymentTransactionSerializer(payment).data})


class PaymentTransactionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = PaymentTransaction.objects.filter(user=request.user).order_by("-created_at")
        status_filter = (request.query_params.get("status") or "").strip().lower()
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        paginator = MedicinePagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = PaymentTransactionSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class PaymentTransactionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, payment_id):
        payment = PaymentTransaction.objects.filter(id=payment_id, user=request.user).first()
        if not payment:
            return Response({"detail": "Payment transaction not found."}, status=status.HTTP_404_NOT_FOUND)

        events = payment.webhook_events.order_by("-created_at")
        return Response(
            {
                "payment": PaymentTransactionSerializer(payment).data,
                "events": PaymentWebhookEventSerializer(events, many=True).data,
            }
        )


class PaymentReconciliationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.is_staff:
            raise PermissionDenied("Only admin users can view reconciliation runs.")

        runs = PaymentReconciliationRun.objects.select_related("triggered_by").order_by("-created_at")[:10]
        last_run = runs[0] if runs else None
        return Response(
            {
                "last_run": PaymentReconciliationRunSerializer(last_run).data if last_run else None,
                "recent_runs": PaymentReconciliationRunSerializer(runs, many=True).data,
            }
        )

    def post(self, request):
        if not request.user.is_staff:
            raise PermissionDenied("Only admin users can trigger reconciliation.")

        timeout_minutes = request.data.get("timeout_minutes", 30)
        limit = request.data.get("limit", 200)
        status_filter = (request.data.get("status_filter", "") or "").strip().lower()
        provider_filter = (request.data.get("provider_filter", "") or "").strip()
        payment_method_filter = (request.data.get("payment_method_filter", "") or "").strip().lower()
        try:
            timeout_minutes = int(timeout_minutes)
            limit = int(limit)
        except (TypeError, ValueError):
            return Response({"detail": "timeout_minutes and limit must be integers."}, status=status.HTTP_400_BAD_REQUEST)

        summary = reconcile_stale_payments(
            timeout_minutes=timeout_minutes,
            limit=limit,
            status_filter=status_filter,
            provider_filter=provider_filter,
            payment_method_filter=payment_method_filter,
        )
        run = PaymentReconciliationRun.objects.create(
            triggered_by=request.user,
            timeout_minutes=timeout_minutes,
            limit=limit,
            status_filter=status_filter,
            provider_filter=provider_filter,
            payment_method_filter=payment_method_filter,
            summary_json=json.dumps(summary),
        )
        return Response(
            {
                "detail": "Reconciliation completed.",
                "summary": summary,
                "run": PaymentReconciliationRunSerializer(run).data,
            }
        )


class PaymentWebhookView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        provider_name = (request.query_params.get("provider") or request.headers.get("X-Payment-Provider") or getattr(settings, "PAYMENT_PROVIDER", "mock")).strip().lower()
        provider = get_payment_provider(provider_name)
        payload_bytes = request.body or b""
        signature_valid = provider.verify_webhook_signature(payload_bytes, request.headers)
        if not signature_valid:
            return Response({"detail": "Invalid webhook signature."}, status=status.HTTP_400_BAD_REQUEST)

        event = provider.parse_webhook_event(request.data if isinstance(request.data, dict) else {})
        event_id = (event.get("event_id") or "").strip()
        raw_payload = payload_bytes.decode("utf-8", errors="ignore")
        base_key = f"{provider_name}:{event_id}:{hashlib.sha256(payload_bytes).hexdigest()}" if event_id else f"{provider_name}:{hashlib.sha256(payload_bytes).hexdigest()}"
        requested_key = (request.headers.get("X-Webhook-Idempotency-Key") or "").strip()
        idempotency_key = requested_key or base_key
        event_name = (event.get("event") or "payment.updated").strip()

        webhook_event, created = PaymentWebhookEvent.objects.get_or_create(
            idempotency_key=idempotency_key,
            defaults={
                "provider": provider_name,
                "event_name": event_name,
                "event_id": event_id,
                "raw_payload": raw_payload,
                "signature_valid": signature_valid,
            },
        )
        if not created and webhook_event.processed:
            webhook_event.replay_count += 1
            webhook_event.save(update_fields=["replay_count", "updated_at"])
            return Response({"detail": "Duplicate webhook ignored.", "idempotency_key": idempotency_key})

        payment_reference = (event.get("payment_reference") or "").strip()
        if not payment_reference:
            webhook_event.error_message = "Missing payment reference."
            webhook_event.raw_payload = raw_payload
            webhook_event.signature_valid = signature_valid
            webhook_event.save(update_fields=["error_message", "raw_payload", "signature_valid", "updated_at"])
            return Response({"detail": "Missing payment reference."}, status=status.HTTP_400_BAD_REQUEST)

        payment = PaymentTransaction.objects.filter(gateway_order_id=payment_reference).order_by("-id").first()
        if not payment:
            webhook_event.payment_reference = payment_reference
            webhook_event.error_message = "Payment transaction not found."
            webhook_event.raw_payload = raw_payload
            webhook_event.signature_valid = signature_valid
            webhook_event.save(update_fields=["payment_reference", "error_message", "raw_payload", "signature_valid", "updated_at"])
            return Response({"detail": "Payment transaction not found."}, status=status.HTTP_404_NOT_FOUND)

        status_value = (event.get("status") or "").strip().lower()
        if status_value in ["authorized"]:
            payment.status = PaymentStatus.AUTHORIZED
        elif status_value in ["captured", "paid"]:
            payment.status = PaymentStatus.CAPTURED
        elif status_value in ["failed"]:
            payment.status = PaymentStatus.FAILED

        gateway_payment_id = (event.get("gateway_payment_id") or "").strip()
        if gateway_payment_id:
            payment.gateway_payment_id = gateway_payment_id
        payment.error_message = "" if payment.status != PaymentStatus.FAILED else "Marked failed by webhook"
        payment.save(update_fields=["status", "gateway_payment_id", "error_message", "updated_at"])

        webhook_event.payment = payment
        webhook_event.payment_reference = payment_reference
        webhook_event.gateway_payment_id = gateway_payment_id
        webhook_event.status = payment.status
        webhook_event.raw_payload = raw_payload
        webhook_event.signature_valid = signature_valid
        webhook_event.processed = True
        webhook_event.error_message = ""
        webhook_event.save(
            update_fields=[
                "payment",
                "payment_reference",
                "gateway_payment_id",
                "status",
                "raw_payload",
                "signature_valid",
                "processed",
                "error_message",
                "updated_at",
            ]
        )

        if payment.order_id and payment.status == PaymentStatus.CAPTURED:
            payment.order.payment_status = "paid"
            payment.order.payment_reference = payment.gateway_order_id
            payment.order.save(update_fields=["payment_status", "payment_reference"])

        return Response(
            {
                "detail": "Webhook processed.",
                "idempotency_key": idempotency_key,
                "payment": PaymentTransactionSerializer(payment).data,
            }
        )


class WishlistItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = WishlistItemSerializer
    pagination_class = MedicinePagination

    def get_queryset(self):
        return WishlistItem.objects.select_related("medicine", "medicine__shop").filter(user=self.request.user).order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class MedicineSuggestionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if not query:
            return Response([])

        names = (
            Medicine.objects.filter(
                Q(name__icontains=query)
                | Q(brand__icontains=query)
                | Q(category__icontains=query)
            )
            .order_by("name")
            .values_list("name", flat=True)[:8]
        )
        return Response(list(dict.fromkeys(names)))


class OrderStatusUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, order_id):
        new_status = request.data.get("status", "").strip()
        if new_status not in OrderStatus.values:
            return Response({"detail": "Invalid order status."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order = Order.objects.prefetch_related("items", "items__medicine", "items__medicine__shop").get(id=order_id)
        except Order.DoesNotExist:
            return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)

        if order.user != request.user:
            seller_match = any(item.medicine.shop.owner_id == request.user.id for item in order.items.all())
            if not seller_match:
                raise PermissionDenied("You are not allowed to update this order.")

        order.status = new_status
        order.save(update_fields=["status"])
        dispatch_notification(
            user=order.user,
            title="Order status updated",
            message=f"Order {order.tracking_id or order.id} is now {order.status.replace('_', ' ')}.",
            kind="order-status",
            phone_number=order.mobile_number,
        )
        return Response({"detail": "Order status updated.", "status": order.status})


class ReviewViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ReviewSerializer
    pagination_class = MedicinePagination

    def get_queryset(self):
        queryset = Review.objects.select_related("user", "medicine", "medicine__shop")
        medicine_id = self.request.query_params.get("medicine")
        mine = self.request.query_params.get("mine")
        if medicine_id:
            queryset = queryset.filter(medicine_id=medicine_id)
        if mine in ["1", "true", "True"]:
            queryset = queryset.filter(medicine__shop__owner=self.request.user)

        if not self.request.user.is_staff:
            queryset = queryset.filter(
                Q(moderation_status=Review.ModerationStatus.APPROVED)
                | Q(user=self.request.user)
                | Q(medicine__shop__owner=self.request.user)
            )
        return queryset

    def perform_create(self, serializer):
        medicine = serializer.validated_data.get("medicine")
        rating = int(serializer.validated_data.get("rating", 5))
        if rating < 1 or rating > 5:
            raise PermissionDenied("Rating must be between 1 and 5.")

        verified_purchase = Order.objects.filter(
            user=self.request.user,
            items__medicine=medicine,
        ).exclude(status=OrderStatus.CANCELLED).exists()

        serializer.save(
            user=self.request.user,
            verified_purchase=verified_purchase,
            moderation_status=Review.ModerationStatus.PENDING,
        )


class ReviewModerationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, review_id):
        action = request.data.get("action", "").strip().lower()
        if action not in [Review.ModerationStatus.APPROVED, Review.ModerationStatus.REJECTED]:
            return Response({"detail": "Invalid moderation action."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            review = Review.objects.select_related("medicine", "medicine__shop", "user").get(id=review_id)
        except Review.DoesNotExist:
            return Response({"detail": "Review not found."}, status=status.HTTP_404_NOT_FOUND)

        is_owner = review.medicine.shop.owner_id == request.user.id
        if not request.user.is_staff and not is_owner:
            raise PermissionDenied("You are not allowed to moderate this review.")

        review.moderation_status = action
        review.moderated_by = request.user
        review.moderated_at = timezone.now()
        review.save(update_fields=["moderation_status", "moderated_by", "moderated_at"])

        dispatch_notification(
            user=review.user,
            title="Review moderation update",
            message=f"Your review for {review.medicine.name} was {action}.",
            kind="review",
        )

        return Response({"detail": "Review moderated successfully.", "moderation_status": review.moderation_status})


class ReviewSellerResponseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, review_id):
        response_text = request.data.get("response", "").strip()
        if not response_text:
            return Response({"detail": "Response text is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            review = Review.objects.select_related("medicine", "medicine__shop", "user").get(id=review_id)
        except Review.DoesNotExist:
            return Response({"detail": "Review not found."}, status=status.HTTP_404_NOT_FOUND)

        is_owner = review.medicine.shop.owner_id == request.user.id
        if not request.user.is_staff and not is_owner:
            raise PermissionDenied("You are not allowed to respond to this review.")

        review.seller_response = response_text
        review.seller_response_at = timezone.now()
        review.save(update_fields=["seller_response", "seller_response_at"])

        dispatch_notification(
            user=review.user,
            title="Seller replied to your review",
            message=f"Seller response on {review.medicine.name}: {response_text[:100]}",
            kind="review-response",
        )

        return Response({"detail": "Seller response saved."})


class ReturnRequestViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ReturnRequestSerializer
    pagination_class = MedicinePagination

    def get_queryset(self):
        return ReturnRequest.objects.filter(user=self.request.user).select_related("order")

    def perform_create(self, serializer):
        order = serializer.validated_data.get("order")
        if order.user_id != self.request.user.id:
            raise PermissionDenied("You can only request returns for your own order.")
        if order.status != OrderStatus.DELIVERED:
            raise PermissionDenied("Return can be requested only after order is delivered.")
        serializer.save(user=self.request.user)
        dispatch_notification(
            user=self.request.user,
            title="Return request submitted",
            message=f"We received your return request for order {order.tracking_id or order.id}.",
            kind="return",
            phone_number=order.mobile_number,
        )


class CancelOrderView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, order_id):
        try:
            order = Order.objects.get(id=order_id, user=request.user)
        except Order.DoesNotExist:
            return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)

        if order.created_at < timezone.now() - timedelta(hours=48):
            log_fraud_risk(request.user, "order_cancel", "medium", "Cancellation attempted after allowed window")
            return Response({"detail": "Cancellation window expired for this order."}, status=status.HTTP_400_BAD_REQUEST)

        recent_cancels = Order.objects.filter(
            user=request.user,
            status=OrderStatus.CANCELLED,
            created_at__gte=timezone.now() - timedelta(days=7),
        ).count()
        if recent_cancels >= 3:
            log_fraud_risk(request.user, "order_cancel", "high", "Too many cancellations in rolling 7 days")
            return Response({"detail": "Cancellation limit reached. Contact support."}, status=status.HTTP_403_FORBIDDEN)

        if order.status in [OrderStatus.DELIVERED, OrderStatus.CANCELLED]:
            return Response({"detail": "Order cannot be cancelled at this stage."}, status=status.HTTP_400_BAD_REQUEST)

        order.status = OrderStatus.CANCELLED
        order.save(update_fields=["status"])
        dispatch_notification(
            user=order.user,
            title="Order cancelled",
            message=f"Your order {order.tracking_id or order.id} has been cancelled.",
            kind="cancel",
            phone_number=order.mobile_number,
        )
        return Response({"detail": "Order cancelled successfully.", "status": order.status})


class SellerReturnDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.is_staff:
            queryset = ReturnRequest.objects.select_related("order", "user", "resolved_by")
        else:
            queryset = ReturnRequest.objects.select_related("order", "user", "resolved_by").filter(
                order__items__medicine__shop__owner=request.user
            ).distinct()

        serializer = ReturnRequestSerializer(queryset.order_by("-created_at")[:100], many=True)
        return Response(serializer.data)


class ManageReturnRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, return_id):
        new_status = request.data.get("status", "").strip()
        note = request.data.get("note", "").strip()
        if new_status not in ReturnRequestStatus.values:
            return Response({"detail": "Invalid return status."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            return_request = ReturnRequest.objects.select_related("order", "order__user").get(id=return_id)
        except ReturnRequest.DoesNotExist:
            return Response({"detail": "Return request not found."}, status=status.HTTP_404_NOT_FOUND)

        if not request.user.is_staff:
            seller_match = return_request.order.items.filter(medicine__shop__owner=request.user).exists()
            if not seller_match:
                raise PermissionDenied("You are not allowed to manage this return request.")

        risky_returns = ReturnRequest.objects.filter(
            user=return_request.user,
            created_at__gte=timezone.now() - timedelta(days=30),
        ).count()
        if risky_returns >= 5 and not request.user.is_staff:
            log_fraud_risk(request.user, "return_manage", "high", "High-volume return user requires admin review")
            return Response(
                {"detail": "This return requires admin review due to risk checks."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return_request.status = new_status
        return_request.resolution_note = note
        return_request.resolved_by = request.user
        return_request.resolved_at = timezone.now()
        return_request.save(update_fields=["status", "resolution_note", "resolved_by", "resolved_at"])

        dispatch_notification(
            user=return_request.user,
            title="Return request updated",
            message=f"Return request for order {return_request.order.tracking_id or return_request.order.id} is now {new_status}.",
            kind="return-update",
            phone_number=return_request.order.mobile_number,
        )

        return Response({"detail": "Return request updated.", "status": return_request.status})


class NotificationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer
    pagination_class = MedicinePagination

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class NotificationsMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        notification_id = request.data.get("notification_id")
        queryset = Notification.objects.filter(user=request.user, is_read=False)
        if notification_id:
            queryset = queryset.filter(id=notification_id)
        updated = queryset.update(is_read=True)
        return Response({"detail": "Notifications updated.", "updated": updated})


class PrescriptionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = PrescriptionSerializer
    pagination_class = MedicinePagination
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        queue = self.request.query_params.get("queue")
        if self.request.user.is_staff:
            return Prescription.objects.select_related("medicine", "user", "reviewed_by")

        profile, _ = UserProfile.objects.get_or_create(user=self.request.user)
        if queue in ["1", "true", "True"] and profile.role in [UserRole.SELLER, UserRole.ADMIN]:
            return Prescription.objects.select_related("medicine", "user", "reviewed_by").filter(
                medicine__shop__owner=self.request.user
            )
        mine = self.request.query_params.get("mine")
        if mine in ["1", "true", "True"]:
            return Prescription.objects.select_related("medicine", "user", "reviewed_by").filter(user=self.request.user)
        return Prescription.objects.select_related("medicine", "user", "reviewed_by").filter(user=self.request.user)

    def perform_create(self, serializer):
        if not serializer.validated_data.get("file"):
            raise PermissionDenied("Prescription file is required.")
        serializer.save(user=self.request.user)


class PrescriptionReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, prescription_id):
        status_value = request.data.get("status", "").strip()
        rejection_reason = request.data.get("rejection_reason", "").strip()
        if status_value not in [PrescriptionStatus.APPROVED, PrescriptionStatus.REJECTED]:
            return Response({"detail": "Invalid prescription status."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            prescription = Prescription.objects.select_related("user", "medicine", "medicine__shop").get(id=prescription_id)
        except Prescription.DoesNotExist:
            return Response({"detail": "Prescription not found."}, status=status.HTTP_404_NOT_FOUND)

        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        is_seller_owner = prescription.medicine.shop.owner_id == request.user.id
        if not request.user.is_staff and profile.role not in [UserRole.SELLER, UserRole.ADMIN] and not is_seller_owner:
            raise PermissionDenied("You are not allowed to review this prescription.")

        prescription.status = status_value
        prescription.reviewed_by = request.user
        prescription.reviewed_at = timezone.now()
        prescription.rejection_reason = rejection_reason if status_value == PrescriptionStatus.REJECTED else ""
        prescription.save(update_fields=["status", "reviewed_by", "reviewed_at", "rejection_reason"])

        dispatch_notification(
            user=prescription.user,
            title="Prescription status updated",
            message=f"Prescription for {prescription.medicine.name} is now {status_value}.",
            kind="prescription",
        )

        return Response({"detail": "Prescription reviewed successfully.", "status": prescription.status})


class FraudRiskEventViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = FraudRiskEventSerializer
    pagination_class = MedicinePagination

    def get_queryset(self):
        if self.request.user.is_staff:
            return FraudRiskEvent.objects.select_related("user")
        return FraudRiskEvent.objects.filter(user=self.request.user).select_related("user")