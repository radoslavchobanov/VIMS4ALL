# Employee Exit Date Management

## Overview

The `exit_date` field on the Employee model serves as a mechanism to automatically deactivate system accounts for employees who have left the organization. When an employee's exit date arrives or passes, their system account will be automatically deactivated to prevent unauthorized access.

## How It Works

1. **Setting Exit Date**: When an employee is leaving, set their `exit_date` field to the date they will exit the organization.

2. **Automatic Account Closure**: The system automatically checks for exited employees in two ways:
   - **On Application Startup**: Every time the Django application starts (runserver, gunicorn, uvicorn), it runs a check after 5 seconds
   - **Manual Execution**: Run the management command `close_exited_accounts` manually or via cron/scheduler

3. **Account Deactivation**: The system sets `is_active=False` on the user account, which prevents login while preserving the account data.

## Management Command

### Command: `close_exited_accounts`

This command deactivates system accounts for employees whose exit date has arrived or passed.

#### Usage

```bash
# Normal run (makes changes)
python manage.py close_exited_accounts

# Dry run (preview without making changes)
python manage.py close_exited_accounts --dry-run
```

#### With Docker

```bash
# Using docker-compose directly
docker compose -f docker-compose.dev.yml --env-file .env.dev exec web python src/manage.py close_exited_accounts

# Using Make (if configured)
make manage ARGS="close_exited_accounts"
```

### Output

The command provides detailed output:
- Number of employees processed
- Number of accounts closed
- Number of accounts skipped (already inactive, no account, or superuser)
- Any errors encountered

Example output:
```
Checking for employees with exit dates...
Processed: 3 employee(s)
Closed: 2 account(s)
Skipped: 1 account(s)

Completed successfully with no errors
```

## Automatic Startup Behavior

The account closure check runs automatically every time the Django application starts:

- **Development**: When you run `python manage.py runserver`
- **Production**: When gunicorn/uvicorn starts the application
- **Timing**: Runs 5 seconds after startup in a background thread to avoid blocking initialization
- **Logging**: Results are logged to the application logger

### Viewing Startup Logs

Check your application logs to see the automatic closure results:

```bash
# Docker logs
docker compose logs web | grep "exited employee"

# Or follow logs in real-time
docker compose logs -f web
```

Example log output:
```
[INFO] Running automatic exited employee account closure check...
[WARNING] Closed 2 exited employee account(s) on startup
```

## Optional: Additional Scheduling

While the startup check handles most cases, you can optionally set up additional scheduled runs for long-running servers that are rarely restarted.

### Cron Example

Add to your crontab (`crontab -e`):

```bash
# Close exited employee accounts daily at 1:00 AM
0 1 * * * cd /path/to/backend/src && /path/to/venv/bin/python manage.py close_exited_accounts >> /var/log/vims/close_accounts.log 2>&1
```

### Docker Cron Example

```bash
# With docker-compose
0 1 * * * cd /path/to/project && docker compose -f docker-compose.yml --env-file .env exec -T web python src/manage.py close_exited_accounts >> /var/log/vims/close_accounts.log 2>&1
```

### Systemd Timer (Recommended for Production)

Create `/etc/systemd/system/close-exited-accounts.service`:

```ini
[Unit]
Description=Close exited employee accounts
After=network.target postgresql.service

[Service]
Type=oneshot
User=www-data
WorkingDirectory=/path/to/backend/src
Environment="PATH=/path/to/venv/bin:/usr/bin"
ExecStart=/path/to/venv/bin/python manage.py close_exited_accounts
StandardOutput=journal
StandardError=journal
```

Create `/etc/systemd/system/close-exited-accounts.timer`:

```ini
[Unit]
Description=Run close exited accounts daily at 1 AM
Requires=close-exited-accounts.service

[Timer]
OnCalendar=*-*-* 01:00:00
Persistent=true
Unit=close-exited-accounts.service

[Install]
WantedBy=timers.target
```

Enable and start:

```bash
sudo systemctl enable close-exited-accounts.timer
sudo systemctl start close-exited-accounts.timer
sudo systemctl status close-exited-accounts.timer
```

## Service Function

The underlying service function can also be called directly from Python code:

```python
from apps.employees.services.accounts import close_exited_employee_accounts

result = close_exited_employee_accounts()
# Returns: {
#     'processed': 3,
#     'closed': 2,
#     'skipped': 1,
#     'errors': []
# }
```

## Business Rules

1. **Superuser Protection**: Superuser accounts are never automatically deactivated, even if their exit date has passed. These must be handled manually.

2. **Already Inactive**: If an account is already inactive, it will be skipped.

3. **No Account**: Employees without system accounts are skipped.

4. **Exit Date Not Set**: Employees without an exit date are never affected.

5. **Future Exit Dates**: Only employees with `exit_date <= today` are processed.

## Filtering Active vs. Exited Employees

The `exit_date` field can be used to filter current employees from ex-employees:

### In Django ORM

```python
from django.utils import timezone

# Current employees (no exit date or future exit date)
today = timezone.now().date()
current_employees = Employee.objects.filter(
    Q(exit_date__isnull=True) | Q(exit_date__gt=today)
)

# Exited employees
exited_employees = Employee.objects.filter(exit_date__lte=today)
```

### In Frontend/API

The serializers and views can be updated to include an `is_active` or `has_exited` computed field if needed.

## Reactivating an Employee

If an employee returns to the organization:

1. Clear or update their `exit_date` to a future date or `null`
2. Manually reactivate their system account (or create a new one)

```python
employee.exit_date = None
employee.save(update_fields=['exit_date'])

# Reactivate their account
if employee.system_user:
    employee.system_user.is_active = True
    employee.system_user.save(update_fields=['is_active'])
```

## Monitoring

### Check Timer Status (systemd)

```bash
# View timer status
sudo systemctl status close-exited-accounts.timer

# View last run logs
sudo journalctl -u close-exited-accounts.service -n 50
```

### Check Cron Logs

```bash
# View cron logs
tail -f /var/log/vims/close_accounts.log

# Check for recent runs
grep "close_exited_accounts" /var/log/syslog
```

## Testing

### Manual Test

1. Create a test employee with an exit date in the past
2. Create a system account for that employee
3. Run the command in dry-run mode to preview
4. Run the command normally to execute
5. Verify the account is deactivated

```bash
# Preview
python manage.py close_exited_accounts --dry-run

# Execute
python manage.py close_exited_accounts
```

### Automated Testing

Create a test case in your test suite:

```python
from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from apps.employees.models import Employee
from apps.employees.services.accounts import close_exited_employee_accounts

class ExitedAccountTestCase(TestCase):
    def test_close_exited_accounts(self):
        # Create employee with past exit date
        yesterday = timezone.now().date() - timedelta(days=1)
        employee = Employee.objects.create(
            first_name="Test",
            last_name="User",
            exit_date=yesterday,
            # ... other required fields
        )

        # Create active account
        user = User.objects.create_user(
            username="test.user",
            is_active=True
        )
        employee.system_user = user
        employee.save()

        # Run function
        result = close_exited_employee_accounts()

        # Verify
        self.assertEqual(result['closed'], 1)
        user.refresh_from_db()
        self.assertFalse(user.is_active)
```

## Security Considerations

1. **Audit Trail**: Consider adding logging to track when accounts are deactivated
2. **Notification**: Optionally send notifications to admins when accounts are closed
3. **Grace Period**: Consider adding a configurable grace period (e.g., accounts close 1 day after exit date)
4. **Backup**: Ensure you have backups before running in production
5. **Manual Review**: Use dry-run mode first in production to review changes

## Troubleshooting

### Command doesn't find employees

- Verify employees have `exit_date` set and it's <= today
- Verify employees have `system_user` linked
- Check that accounts are `is_active=True`

### Cron job not running

- Check cron service is running: `systemctl status cron`
- Verify crontab syntax: `crontab -l`
- Check cron logs: `/var/log/syslog` or `/var/log/cron`
- Ensure full paths are used in crontab

### Systemd timer not running

- Check timer is enabled: `systemctl is-enabled close-exited-accounts.timer`
- Check timer status: `systemctl status close-exited-accounts.timer`
- View logs: `journalctl -u close-exited-accounts.service`
- Test service manually: `systemctl start close-exited-accounts.service`
