from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0005_order_mobile_number"),
    ]

    operations = [
        migrations.AddField(
            model_name="medicine",
            name="brand",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="medicine",
            name="category",
            field=models.CharField(blank=True, default="General", max_length=100),
        ),
        migrations.AddField(
            model_name="medicine",
            name="composition",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="medicine",
            name="description",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="medicine",
            name="prescription_required",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="order",
            name="coupon_code",
            field=models.CharField(blank=True, default="", max_length=40),
        ),
        migrations.AddField(
            model_name="order",
            name="delivery_fee",
            field=models.FloatField(default=0),
        ),
        migrations.AddField(
            model_name="order",
            name="discount_amount",
            field=models.FloatField(default=0),
        ),
        migrations.AddField(
            model_name="order",
            name="payment_method",
            field=models.CharField(blank=True, default="cod", max_length=20),
        ),
        migrations.AddField(
            model_name="order",
            name="status",
            field=models.CharField(
                choices=[
                    ("placed", "Placed"),
                    ("packed", "Packed"),
                    ("shipped", "Shipped"),
                    ("out_for_delivery", "Out for delivery"),
                    ("delivered", "Delivered"),
                    ("cancelled", "Cancelled"),
                ],
                default="placed",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="order",
            name="tax_amount",
            field=models.FloatField(default=0),
        ),
        migrations.AddField(
            model_name="order",
            name="total_amount",
            field=models.FloatField(default=0),
        ),
        migrations.AddField(
            model_name="order",
            name="tracking_id",
            field=models.CharField(blank=True, default="", max_length=40),
        ),
        migrations.CreateModel(
            name="WishlistItem",
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
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "medicine",
                    models.ForeignKey(on_delete=models.deletion.CASCADE, to="api.medicine"),
                ),
                (
                    "user",
                    models.ForeignKey(on_delete=models.deletion.CASCADE, to="auth.user"),
                ),
            ],
            options={"unique_together": {("user", "medicine")}},
        ),
    ]
