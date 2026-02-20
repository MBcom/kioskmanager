from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('kioskmanager', '0002_displaygroup_show_status'),
    ]

    operations = [
        migrations.CreateModel(
            name='AutomationScript',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('url_pattern', models.CharField(
                    blank=True,
                    help_text='URL-Muster für automatischen Start, z.B. *://login.microsoftonline.com/*. Leer lassen für ausschließlich manuellen Start.',
                    max_length=500,
                    null=True,
                )),
                ('content', models.TextField(
                    help_text='Cypress-ähnliches Automation-Script. Verfügbar: cy.get(), .click(), .type(), cy.wait(), cy.waitForUrl(), etc.',
                )),
                ('enabled', models.BooleanField(default=True)),
                ('order', models.PositiveIntegerField(
                    default=0,
                    help_text='Reihenfolge bei mehreren Scripts (aufsteigend).',
                )),
                ('group', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='automation_scripts',
                    to='kioskmanager.displaygroup',
                )),
            ],
            options={
                'verbose_name': 'Automation Script',
                'verbose_name_plural': 'Automation Scripts',
                'ordering': ['group', 'order', 'name'],
            },
        ),
    ]
