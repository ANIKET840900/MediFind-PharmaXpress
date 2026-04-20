import base64
import hashlib
import hmac
import json
import os
from urllib import error, request
from uuid import uuid4

from django.conf import settings

from .models import PaymentStatus


class BasePaymentProvider:
    name = "base"

    def create_payment_intent(self, amount: float, currency: str, payment_method: str, metadata=None):
        raise NotImplementedError

    def verify_webhook_signature(self, payload: bytes, headers):
        return True

    def parse_webhook_event(self, payload):
        raise NotImplementedError


class MockPaymentProvider(BasePaymentProvider):
    name = "mock_gateway"

    def create_payment_intent(self, amount: float, currency: str, payment_method: str, metadata=None):
        gateway_order_id = f"mock_ord_{uuid4().hex[:16]}"
        status = PaymentStatus.AUTHORIZED if payment_method in ["upi", "card"] else PaymentStatus.INITIATED
        return {
            "provider": self.name,
            "status": status,
            "gateway_order_id": gateway_order_id,
            "client_token": f"client_{uuid4().hex}",
        }

    def verify_webhook_signature(self, payload: bytes, headers):
        secret = getattr(settings, "MOCK_PAYMENT_WEBHOOK_SECRET", "mock-webhook-secret")
        given = (headers.get("X-Mock-Signature") or "").strip()
        if not given:
            return False
        expected = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
        return hmac.compare_digest(given, expected)

    def parse_webhook_event(self, payload):
        event = str(payload.get("event", "payment.updated"))
        data = payload.get("data", {}) if isinstance(payload, dict) else {}
        return {
            "event": event,
            "event_id": str(payload.get("event_id") or data.get("event_id") or ""),
            "payment_reference": data.get("gateway_order_id") or payload.get("gateway_order_id") or "",
            "gateway_payment_id": data.get("gateway_payment_id") or payload.get("gateway_payment_id") or "",
            "status": str(data.get("status") or payload.get("status") or "").lower(),
        }


class RazorpayPaymentProvider(BasePaymentProvider):
    name = "razorpay"

    def _credentials(self):
        key_id = getattr(settings, "RAZORPAY_KEY_ID", "")
        key_secret = getattr(settings, "RAZORPAY_KEY_SECRET", "")
        if not key_id or not key_secret:
            raise RuntimeError("Razorpay credentials are not configured.")
        return key_id, key_secret

    def create_payment_intent(self, amount: float, currency: str, payment_method: str, metadata=None):
        key_id, key_secret = self._credentials()
        payload = {
            "amount": int(round(float(amount) * 100)),
            "currency": currency,
            "receipt": f"medcompare_{uuid4().hex[:18]}",
            "notes": {
                "payment_method": payment_method,
                "metadata": json.dumps(metadata or {}),
            },
        }

        auth = base64.b64encode(f"{key_id}:{key_secret}".encode("utf-8")).decode("utf-8")
        req = request.Request(
            "https://api.razorpay.com/v1/orders",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Basic {auth}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with request.urlopen(req, timeout=20) as response:
                body = json.loads(response.read().decode("utf-8"))
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"Razorpay order creation failed: {detail}") from exc

        return {
            "provider": self.name,
            "status": PaymentStatus.INITIATED,
            "gateway_order_id": body.get("id", ""),
            "client_token": key_id,
        }

    def verify_webhook_signature(self, payload: bytes, headers):
        secret = getattr(settings, "RAZORPAY_WEBHOOK_SECRET", "")
        given = (headers.get("X-Razorpay-Signature") or "").strip()
        if not secret or not given:
            return False
        expected = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
        return hmac.compare_digest(given, expected)

    def parse_webhook_event(self, payload):
        payload_data = payload.get("payload", {}) if isinstance(payload, dict) else {}
        payment_entity = payload_data.get("payment", {}).get("entity", {})
        order_entity = payload_data.get("order", {}).get("entity", {})
        return {
            "event": str(payload.get("event", "")),
            "event_id": str(payload.get("id") or payload.get("event_id") or ""),
            "payment_reference": payment_entity.get("order_id") or order_entity.get("id") or "",
            "gateway_payment_id": payment_entity.get("id") or "",
            "status": str(payment_entity.get("status") or "").lower(),
        }


def get_payment_provider(provider_name=""):
    resolved = (provider_name or getattr(settings, "PAYMENT_PROVIDER", "mock") or "mock").strip().lower()
    if resolved == "razorpay":
        return RazorpayPaymentProvider()
    return MockPaymentProvider()
