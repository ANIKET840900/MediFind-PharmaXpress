from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0006_medicine_metadata_order_status_wishlist"),
    ]

    operations = [
        migrations.CreateModel(
            name="Notification",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("title", models.CharField(max_length=140)),
                ("message", models.TextField(blank=True, default="")),
                ("kind", models.CharField(blank=True, default="general", max_length=40)),
                ("is_read", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="notifications", to="auth.user"),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="Review",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("rating", models.IntegerField(default=5)),
                ("title", models.CharField(blank=True, default="", max_length=140)),
                ("comment", models.TextField(blank=True, default="")),
                ("verified_purchase", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "medicine",
                    models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="reviews", to="api.medicine"),
                ),
                (
                    "user",
                    models.ForeignKey(on_delete=models.deletion.CASCADE, to="auth.user"),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="ReturnRequest",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("reason", models.TextField(blank=True, default="")),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("requested", "Requested"),
                            ("approved", "Approved"),
                            ("rejected", "Rejected"),
                            ("completed", "Completed"),
                        ],
                        default="requested",
                        max_length=20,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "order",
                    models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="return_requests", to="api.order"),
                ),
                (
                    "user",
                    models.ForeignKey(on_delete=models.deletion.CASCADE, to="auth.user"),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
