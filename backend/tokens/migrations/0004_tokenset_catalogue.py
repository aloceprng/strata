from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tokens', '0003_tokenset_layouts'),
    ]

    operations = [
        migrations.AddField(
            model_name='tokenset',
            name='catalogue',
            field=models.JSONField(
                blank=True, default=dict,
                help_text='Sample products, delivery and the starting basket. Layouts refer to products by id.',
            ),
        ),
    ]
