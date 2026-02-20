from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('kioskmanager', '0003_automationscript'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='automationscript',
            name='group',
        ),
        migrations.AddField(
            model_name='automationscript',
            name='content_item',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='automation_scripts',
                to='kioskmanager.contentitem',
                default=1,
            ),
            preserve_default=False,
        ),
        migrations.AlterModelOptions(
            name='automationscript',
            options={
                'ordering': ['content_item', 'order', 'name'],
                'verbose_name': 'Automation Script',
                'verbose_name_plural': 'Automation Scripts',
            },
        ),
    ]
