from django.core.management.base import BaseCommand

from api.reconciliation import reconcile_stale_payments


class Command(BaseCommand):
    help = "Mark stale initiated/authorized payments as failed and sync order payment_status."

    def add_arguments(self, parser):
        parser.add_argument("--timeout-minutes", type=int, default=30)
        parser.add_argument("--limit", type=int, default=200)
        parser.add_argument("--status-filter", type=str, default="")
        parser.add_argument("--provider-filter", type=str, default="")
        parser.add_argument("--payment-method-filter", type=str, default="")

    def handle(self, *args, **options):
        summary = reconcile_stale_payments(
            timeout_minutes=options["timeout_minutes"],
            limit=options["limit"],
            status_filter=options["status_filter"],
            provider_filter=options["provider_filter"],
            payment_method_filter=options["payment_method_filter"],
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Reconciled {summary['reconciled_count']} payments. "
                f"Failed payments: {summary['failed_payments']}, failed orders: {summary['failed_orders']}"
            )
        )
