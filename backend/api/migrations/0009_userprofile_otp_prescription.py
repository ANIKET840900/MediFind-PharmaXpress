from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0008_review_moderation_return_resolution"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "role",
                    models.CharField(
                        choices=[("buyer", "Buyer"), ("seller", "Seller"), ("admin", "Admin")],
                        default="buyer",
                        max_length=20,
                    ),
                ),
                ("mobile_number", models.CharField(blank=True, default="", max_length=20)),
                ("is_mobile_verified", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.OneToOneField(on_delete=models.deletion.CASCADE, related_name="profile", to="auth.user"),
                ),
            ],
        ),
        migrations.CreateModel(
            name="OTPCode",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("mobile_number", models.CharField(max_length=20)),
                ("purpose", models.CharField(default="mobile_verify", max_length=40)),
                ("code", models.CharField(max_length=8)),
                ("is_used", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("expires_at", models.DateTimeField()),
                ("user", models.ForeignKey(on_delete=models.deletion.CASCADE, to="auth.user")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="Prescription",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image_url", models.URLField(max_length=500)),
                ("note", models.TextField(blank=True, default="")),
                (
                    "status",
                    models.CharField(
                        choices=[("pending", "Pending"), ("approved", "Approved"), ("rejected", "Rejected")],
                        default="pending",
                        max_length=20,
                    ),
                ),
                ("reviewed_at", models.DateTimeField(blank=True, null=True)),
                ("rejection_reason", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("medicine", models.ForeignKey(on_delete=models.deletion.CASCADE, to="api.medicine")),
                (
                    "reviewed_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.deletion.SET_NULL,
                        related_name="reviewed_prescriptions",
                        to="auth.user",
                    ),
                ),
                ("user", models.ForeignKey(on_delete=models.deletion.CASCADE, to="auth.user")),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
