from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.authtoken.models import Token
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Shop, Medicine, CartItem, Order, OrderStatus, Review, ReturnRequest, Notification, UserProfile, OTPCode, FraudRiskEvent

User = get_user_model()


class AuthApiTests(APITestCase):
    signup_url = "/api/auth/signup/"
    login_url = "/api/auth/login/"
    forgot_username_url = "/api/auth/forgot-username/"
    forgot_password_url = "/api/auth/forgot-password/"
    logout_url = "/api/auth/logout/"

    def setUp(self):
        self.password = "Password123"
        self.user = User.objects.create_user(
            username="existing_user",
            email="existing@example.com",
            password=self.password,
        )

    def test_signup_creates_user_and_token(self):
        payload = {
            "username": "new_user",
            "email": "new_user@example.com",
            "password": "StrongPass123",
        }

        response = self.client.post(self.signup_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username="new_user").exists())
        created_user = User.objects.get(username="new_user")
        self.assertEqual(created_user.email, "new_user@example.com")
        self.assertTrue(Token.objects.filter(user=created_user).exists())
        self.assertIn("token", response.data)

    def test_signup_requires_email(self):
        payload = {
            "username": "new_user",
            "password": "StrongPass123",
        }

        response = self.client.post(self.signup_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Email is required.")

    def test_signup_rejects_invalid_email(self):
        payload = {
            "username": "new_user",
            "email": "invalid-email",
            "password": "StrongPass123",
        }

        response = self.client.post(self.signup_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Enter a valid email address.")

    def test_signup_rejects_disposable_email(self):
        payload = {
            "username": "new_user",
            "email": "new_user@mailinator.com",
            "password": "StrongPass123",
        }

        response = self.client.post(self.signup_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["detail"],
            "Temporary/disposable emails are not allowed. Use a real email address.",
        )

    def test_login_success_with_username_email_password(self):
        payload = {
            "username": "existing_user",
            "email": "existing@example.com",
            "password": self.password,
        }

        response = self.client.post(self.login_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("token", response.data)
        self.assertEqual(response.data["user"]["username"], "existing_user")

    def test_login_rejects_wrong_username(self):
        payload = {
            "username": "wrong_user",
            "email": "existing@example.com",
            "password": self.password,
        }

        response = self.client.post(self.login_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Invalid username.")

    def test_login_rejects_wrong_email_for_username(self):
        payload = {
            "username": "existing_user",
            "email": "wrong@example.com",
            "password": self.password,
        }

        response = self.client.post(self.login_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Invalid email for this username.")

    def test_login_rejects_wrong_password(self):
        payload = {
            "username": "existing_user",
            "email": "existing@example.com",
            "password": "wrong-password",
        }

        response = self.client.post(self.login_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Invalid password.")

    def test_login_rejects_disposable_email(self):
        disposable_user = User.objects.create_user(
            username="temp_user",
            email="temp_user@mailinator.com",
            password=self.password,
        )

        payload = {
            "username": disposable_user.username,
            "email": disposable_user.email,
            "password": self.password,
        }

        response = self.client.post(self.login_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["detail"],
            "Temporary/disposable emails are not allowed. Use a real email address.",
        )

    def test_forgot_username_returns_username(self):
        response = self.client.post(
            self.forgot_username_url,
            {"email": "existing@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "existing_user")

    def test_forgot_password_resets_password_and_invalidates_token(self):
        token, _ = Token.objects.get_or_create(user=self.user)
        response = self.client.post(
            self.forgot_password_url,
            {
                "username": self.user.username,
                "email": self.user.email,
                "new_password": "NewPass123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["detail"],
            "Password updated successfully. Please sign in again.",
        )
        self.assertFalse(Token.objects.filter(key=token.key).exists())
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewPass123"))

    def test_logout_deletes_token(self):
        token, _ = Token.objects.get_or_create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

        response = self.client.post(self.logout_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["detail"], "Logged out successfully.")
        self.assertFalse(Token.objects.filter(user=self.user).exists())


class CartAndOrderApiTests(APITestCase):
    cart_url = "/api/cart/"
    orders_url = "/api/orders/"

    def setUp(self):
        self.password = "Password123"
        self.user = User.objects.create_user(
            username="cart_user",
            email="cart_user@example.com",
            password=self.password,
        )
        self.other_user = User.objects.create_user(
            username="other_user",
            email="other_user@example.com",
            password=self.password,
        )
        self.shop = Shop.objects.create(
            owner=self.user,
            name="Health Hub",
            area="Downtown",
            rating=4.8,
        )
        self.medicine = Medicine.objects.create(
            shop=self.shop,
            name="Paracetamol",
            price=15,
            in_stock=True,
        )
        self.other_shop = Shop.objects.create(
            owner=self.other_user,
            name="Other Shop",
            area="Uptown",
            rating=4.2,
        )
        self.other_medicine = Medicine.objects.create(
            shop=self.other_shop,
            name="Ibuprofen",
            price=20,
            in_stock=True,
        )
        self.out_of_stock_medicine = Medicine.objects.create(
            shop=self.shop,
            name="Expired Tabs",
            price=10,
            in_stock=False,
        )
        token, _ = Token.objects.get_or_create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    def test_cart_create_get_update_and_delete(self):
        create_response = self.client.post(
            self.cart_url,
            {"medicine": self.medicine.id, "quantity": 2},
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(CartItem.objects.filter(user=self.user).count(), 1)

        list_response = self.client.get(self.cart_url)
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data['results']), 1)
        self.assertEqual(list_response.data['results'][0]["medicine_detail"]["name"], "Paracetamol")
        self.assertEqual(list_response.data['results'][0]["quantity"], 2)

        cart_item = CartItem.objects.get(user=self.user, medicine=self.medicine)
        patch_response = self.client.patch(
            f"{self.cart_url}{cart_item.id}/",
            {"quantity": 3},
            format="json",
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        cart_item.refresh_from_db()
        self.assertEqual(cart_item.quantity, 3)

        delete_response = self.client.delete(f"{self.cart_url}{cart_item.id}/")
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(CartItem.objects.filter(id=cart_item.id).exists())

    def test_cart_rejects_out_of_stock_medicine(self):
        response = self.client.post(
            self.cart_url,
            {"medicine": self.out_of_stock_medicine.id, "quantity": 1},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["detail"], "This medicine is currently out of stock.")

    def test_cart_list_is_scoped_to_current_user(self):
        CartItem.objects.create(user=self.user, medicine=self.medicine, quantity=1)
        CartItem.objects.create(user=self.other_user, medicine=self.other_medicine, quantity=1)

        response = self.client.get(self.cart_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]["medicine_detail"]["name"], "Paracetamol")

    def test_order_create_and_list(self):
        cart_item = CartItem.objects.create(user=self.user, medicine=self.medicine, quantity=2)

        create_response = self.client.post(
            self.orders_url,
            {"items": [cart_item.id]},
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Order.objects.filter(user=self.user).count(), 1)

        order = Order.objects.get(user=self.user)
        self.assertTrue(order.items.filter(id=cart_item.id).exists())

        list_response = self.client.get(self.orders_url)
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data['results']), 1)
        self.assertEqual(list_response.data['results'][0]["items_detail"][0]["medicine_detail"]["name"], "Paracetamol")

    def test_order_rejects_items_from_other_user(self):
        other_cart_item = CartItem.objects.create(user=self.other_user, medicine=self.other_medicine, quantity=1)

        response = self.client.post(
            self.orders_url,
            {"items": [other_cart_item.id]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["detail"], "Order contains cart items that do not belong to you.")
        self.assertEqual(Order.objects.filter(user=self.user).count(), 0)


class ReviewReturnNotificationApiTests(APITestCase):
    def setUp(self):
        self.password = "Password123"
        self.user = User.objects.create_user(
            username="flow_user",
            email="flow_user@example.com",
            password=self.password,
        )
        self.shop = Shop.objects.create(owner=self.user, name="City Meds", area="Center", rating=4.5)
        self.medicine = Medicine.objects.create(shop=self.shop, name="Cetirizine", price=25, in_stock=True)
        self.cart_item = CartItem.objects.create(user=self.user, medicine=self.medicine, quantity=2)
        self.order = Order.objects.create(user=self.user)
        self.order.items.add(self.cart_item)
        self.order.status = OrderStatus.PLACED
        self.order.save()

        token, _ = Token.objects.get_or_create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        UserProfile.objects.create(user=self.user, mobile_number="+911234567890", is_mobile_verified=True)

    def _create_critical_otp(self):
        return OTPCode.objects.create(
            user=self.user,
            mobile_number="+911234567890",
            purpose="critical_action",
            code="123456",
            expires_at=timezone.now() + timedelta(minutes=10),
        )

    def test_review_create_and_list(self):
        create_response = self.client.post(
            "/api/reviews/",
            {
                "medicine": self.medicine.id,
                "rating": 5,
                "title": "Great",
                "comment": "Worked well",
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Review.objects.filter(user=self.user, medicine=self.medicine).exists())

        list_response = self.client.get(f"/api/reviews/?medicine={self.medicine.id}")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data["results"]), 1)

    def test_cancel_order_and_notification(self):
        self._create_critical_otp()
        response = self.client.post(
            f"/api/orders/{self.order.id}/cancel/",
            {"otp_code": "123456"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, OrderStatus.CANCELLED)
        self.assertTrue(Notification.objects.filter(user=self.user, kind="cancel").exists())

    def test_return_request_only_for_delivered_order(self):
        denied = self.client.post(
            "/api/returns/",
            {"order": self.order.id, "reason": "Damaged"},
            format="json",
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        self.order.status = OrderStatus.DELIVERED
        self.order.save(update_fields=["status"])

        accepted = self.client.post(
            "/api/returns/",
            {"order": self.order.id, "reason": "Damaged"},
            format="json",
        )
        self.assertEqual(accepted.status_code, status.HTTP_201_CREATED)
        self.assertTrue(ReturnRequest.objects.filter(order=self.order, user=self.user).exists())

    def test_notifications_mark_read(self):
        notification = Notification.objects.create(
            user=self.user,
            title="Test",
            message="Hello",
            kind="general",
        )

        response = self.client.post("/api/notifications/mark-read/", {"notification_id": notification.id}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        notification.refresh_from_db()
        self.assertTrue(notification.is_read)

    def test_review_moderation_and_seller_response(self):
        review = Review.objects.create(
            user=self.user,
            medicine=self.medicine,
            rating=4,
            title="Nice",
            comment="Works fine",
            verified_purchase=True,
        )

        mod_response = self.client.post(
            f"/api/reviews/{review.id}/moderate/",
            {"action": "approved"},
            format="json",
        )
        self.assertEqual(mod_response.status_code, status.HTTP_200_OK)

        respond = self.client.post(
            f"/api/reviews/{review.id}/respond/",
            {"response": "Thanks for your feedback"},
            format="json",
        )
        self.assertEqual(respond.status_code, status.HTTP_200_OK)
        review.refresh_from_db()
        self.assertEqual(review.moderation_status, "approved")
        self.assertEqual(review.seller_response, "Thanks for your feedback")

    def test_seller_return_dashboard_and_manage(self):
        self.order.status = OrderStatus.DELIVERED
        self.order.save(update_fields=["status"])
        rr = ReturnRequest.objects.create(user=self.user, order=self.order, reason="Damaged")

        list_response = self.client.get("/api/returns/manage/")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)

        self._create_critical_otp()
        update_response = self.client.post(
            f"/api/returns/{rr.id}/manage/",
            {"status": "approved", "note": "Approved by seller", "otp_code": "123456"},
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        rr.refresh_from_db()
        self.assertEqual(rr.status, "approved")


class RoleFraudAndPrescriptionValidationTests(APITestCase):
    def setUp(self):
        self.password = "Password123"
        self.user = User.objects.create_user(
            username="regular_user",
            email="regular@example.com",
            password=self.password,
        )
        self.admin_user = User.objects.create_user(
            username="admin_user",
            email="admin@example.com",
            password=self.password,
            is_staff=True,
        )
        self.other_user = User.objects.create_user(
            username="other_user_2",
            email="other2@example.com",
            password=self.password,
        )

        self.shop = Shop.objects.create(owner=self.user, name="Prime Meds", area="Center")
        self.medicine = Medicine.objects.create(
            shop=self.shop,
            name="Rx Medicine",
            price=99,
            in_stock=True,
            prescription_required=True,
        )

    def _auth_as(self, user):
        token, _ = Token.objects.get_or_create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    def test_assign_role_requires_staff(self):
        self._auth_as(self.user)
        denied = self.client.post(
            "/api/auth/assign-role/",
            {"username": self.other_user.username, "role": "seller"},
            format="json",
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        self._auth_as(self.admin_user)
        allowed = self.client.post(
            "/api/auth/assign-role/",
            {"username": self.other_user.username, "role": "seller"},
            format="json",
        )
        self.assertEqual(allowed.status_code, status.HTTP_200_OK)
        profile = UserProfile.objects.get(user=self.other_user)
        self.assertEqual(profile.role, "seller")

    def test_fraud_events_are_scoped_for_non_staff(self):
        FraudRiskEvent.objects.create(user=self.user, action="order_cancel", risk_level="high", reason="self")
        FraudRiskEvent.objects.create(user=self.other_user, action="order_cancel", risk_level="high", reason="other")

        self._auth_as(self.user)
        response = self.client.get("/api/fraud-events/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["username"], self.user.username)

    def test_fraud_events_show_all_for_staff(self):
        FraudRiskEvent.objects.create(user=self.user, action="order_cancel", risk_level="high", reason="self")
        FraudRiskEvent.objects.create(user=self.other_user, action="return_manage", risk_level="medium", reason="other")

        self._auth_as(self.admin_user)
        response = self.client.get("/api/fraud-events/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 2)

    def test_prescription_rejects_unsupported_file_format(self):
        self._auth_as(self.user)
        bad_file = SimpleUploadedFile(
            "script.exe",
            b"MZ fake binary",
            content_type="application/octet-stream",
        )
        response = self.client.post(
            "/api/prescriptions/",
            {"medicine": self.medicine.id, "file": bad_file, "note": "test"},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Allowed prescription formats", str(response.data))

    def test_prescription_rejects_oversized_file(self):
        self._auth_as(self.user)
        large_file = SimpleUploadedFile(
            "prescription.pdf",
            b"x" * (5 * 1024 * 1024 + 1),
            content_type="application/pdf",
        )
        response = self.client.post(
            "/api/prescriptions/",
            {"medicine": self.medicine.id, "file": large_file, "note": "test"},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("5MB or smaller", str(response.data))
