from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('kioskmanager', '0004_automationscript_content_item'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='automationscript',
            options={
                'ordering': ['content_item', 'order', 'name'],
                'permissions': [
                    ('manage_automation_scripts', 'Can view and manage automation scripts'),
                ],
                'verbose_name': 'Automation Script',
                'verbose_name_plural': 'Automation Scripts',
            },
        ),
    ]
