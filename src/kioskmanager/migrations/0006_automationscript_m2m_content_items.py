from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('kioskmanager', '0005_automationscript_permission'),
    ]

    operations = [
        # Remove the old ForeignKey to ContentItem
        migrations.RemoveField(
            model_name='automationscript',
            name='content_item',
        ),
        # Add the new ManyToManyField (one script can belong to many content items)
        migrations.AddField(
            model_name='automationscript',
            name='content_items',
            field=models.ManyToManyField(
                blank=True,
                help_text='Content items this script is associated with. '
                          'One script can be linked to multiple items.',
                related_name='automation_scripts',
                to='kioskmanager.contentitem',
            ),
        ),
        # Update Meta options (ordering no longer references content_item)
        migrations.AlterModelOptions(
            name='automationscript',
            options={
                'ordering': ['order', 'name'],
                'permissions': [
                    ('manage_automation_scripts', 'Can view and manage automation scripts'),
                ],
                'verbose_name': 'Automation Script',
                'verbose_name_plural': 'Automation Scripts',
            },
        ),
    ]
