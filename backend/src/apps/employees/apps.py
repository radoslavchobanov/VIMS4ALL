from django.apps import AppConfig
from django.db import transaction
import os
import sys


class EmployeesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.employees"

    def ready(self):
        from .models import EmployeeFunction
        from .constants import DEFAULT_GLOBAL_EMPLOYEE_FUNCTIONS

        try:
            with transaction.atomic():
                for name, code in DEFAULT_GLOBAL_EMPLOYEE_FUNCTIONS:
                    EmployeeFunction.objects.get_or_create(
                        institute=None, name=name, defaults={"code": code}
                    )
        except Exception:
            pass

        # Close exited employee accounts on startup
        # Only run once per process (main process only, not autoreloader workers)
        # RUN_MAIN is set by Django's autoreloader to identify the main process
        should_run = (
            os.environ.get('RUN_MAIN') == 'true' or  # Django runserver main process
            'gunicorn' in sys.argv[0] or             # Production gunicorn
            'uvicorn' in sys.argv[0]                  # Production uvicorn
        ) and 'test' not in sys.argv                  # Skip during tests

        if should_run:
            # Run in a background thread to avoid blocking startup
            self._schedule_account_closure()

    def _schedule_account_closure(self):
        """Schedule account closure check to run after Django is fully loaded."""
        import threading
        import tempfile
        from pathlib import Path

        def close_accounts():
            # Wait a bit for Django to fully initialize
            import time
            time.sleep(5)

            # Use a lock file to ensure only one process runs this
            lock_file = Path(tempfile.gettempdir()) / 'vims_account_closure.lock'

            try:
                # Try to create lock file exclusively
                fd = os.open(str(lock_file), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                os.close(fd)

                # We got the lock, run the closure
                try:
                    from .services.accounts import close_exited_employee_accounts
                    import logging

                    logger = logging.getLogger(__name__)
                    logger.info("Running automatic exited employee account closure check...")

                    result = close_exited_employee_accounts()

                    if result['closed'] > 0:
                        logger.warning(
                            f"Closed {result['closed']} exited employee account(s) on startup"
                        )
                    elif result['processed'] > 0:
                        logger.info(
                            f"Checked {result['processed']} exited employee(s), "
                            f"no active accounts to close"
                        )

                    if result['errors']:
                        for error in result['errors']:
                            logger.error(f"Account closure error: {error}")

                finally:
                    # Clean up lock file
                    try:
                        lock_file.unlink()
                    except:
                        pass

            except FileExistsError:
                # Another process is already running or just ran
                pass
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Failed to run automatic account closure: {e}")

        # Start background thread
        thread = threading.Thread(target=close_accounts, daemon=True)
        thread.start()
