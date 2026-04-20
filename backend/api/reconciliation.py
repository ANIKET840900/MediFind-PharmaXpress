from datetime import timedelta

from django.utils import timezone

from .models import PaymentStatus, PaymentTransaction


def reconcile_stale_payments(timeout_minutes=30, limit=200, status_filter="", provider_filter="", payment_method_filter=""):
    now = timezone.now()
    cutoff = now - timedelta(minutes=max(1, int(timeout_minutes)))
    statuses = [PaymentStatus.INITIATED, PaymentStatus.AUTHORIZED]
    status_value = str(status_filter or "").strip().lower()
    if status_value in [PaymentStatus.INITIATED, PaymentStatus.AUTHORIZED]:
        statuses = [status_value]

    candidates_qs = PaymentTransaction.objects.select_related("order").filter(
        status__in=statuses,
        created_at__lte=cutoff,
    )
    provider_value = str(provider_filter or "").strip().lower()
    if provider_value:
        candidates_qs = candidates_qs.filter(provider__iexact=provider_value)

    method_value = str(payment_method_filter or "").strip().lower()
    if method_value:
        candidates_qs = candidates_qs.filter(payment_method__iexact=method_value)

    candidates = candidates_qs.order_by("created_at")[: max(1, int(limit))]

    reconciled = 0
    failed_payments = 0
    failed_orders = 0
    updated_ids = []

    for payment in candidates:
        payment.status = PaymentStatus.FAILED
        payment.error_message = "Auto-reconciled after timeout without capture confirmation."
        payment.save(update_fields=["status", "error_message", "updated_at"])
        failed_payments += 1
        reconciled += 1
        updated_ids.append(payment.id)

        if payment.order_id and payment.order.payment_status != "paid":
            payment.order.payment_status = "failed"
            payment.order.save(update_fields=["payment_status"])
            failed_orders += 1

    return {
        "checked_before": cutoff.isoformat(),
        "reconciled_count": reconciled,
        "failed_payments": failed_payments,
        "failed_orders": failed_orders,
        "status_filter": status_value,
        "provider_filter": provider_value,
        "payment_method_filter": method_value,
        "payment_ids": updated_ids,
    }
