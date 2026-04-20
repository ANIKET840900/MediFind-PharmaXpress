from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0007_reviews_returns_notifications"),
    ]

    operations = [
        migrations.AddField(
            model_name="review",
            name="moderated_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="review",
            name="moderated_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.deletion.SET_NULL,
                related_name="moderated_reviews",
                to="auth.user",
            ),
        ),
        migrations.AddField(
            model_name="review",
            name="moderation_status",
            field=models.CharField(
                choices=[("pending", "Pending"), ("approved", "Approved"), ("rejected", "Rejected")],
                default="pending",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="review",
            name="seller_response",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="review",
            name="seller_response_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="returnrequest",
            name="resolution_note",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="returnrequest",
            name="resolved_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="returnrequest",
            name="resolved_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.deletion.SET_NULL,
                related_name="resolved_return_requests",
                to="auth.user",
            ),
        ),
    ]
