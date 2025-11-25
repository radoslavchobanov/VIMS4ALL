from django.apps import AppConfig
import os
import sys


class TermsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.terms"
    label = "terms"

    def ready(self):
        # Check and send low term count alerts on startup
        # Only run once per process (main process only, not autoreloader workers)
        # RUN_MAIN is set by Django's autoreloader to identify the main process
        should_run = (
            os.environ.get('RUN_MAIN') == 'true' or  # Django runserver main process
            'gunicorn' in sys.argv[0] or             # Production gunicorn
            'uvicorn' in sys.argv[0]                  # Production uvicorn
        ) and 'test' not in sys.argv                  # Skip during tests

        if should_run:
            # Run in a background thread to avoid blocking startup
            self._schedule_low_term_alerts()

    def _schedule_low_term_alerts(self):
        """Schedule low term count alert check to run after Django is fully loaded."""
        import threading
        import tempfile
        from pathlib import Path

        def check_alerts():
            # Wait a bit for Django to fully initialize
            import time
            time.sleep(5)

            # Use a lock file to ensure only one process runs this
            lock_file = Path(tempfile.gettempdir()) / 'vims_low_term_alert.lock'

            try:
                # Try to create lock file exclusively
                fd = os.open(str(lock_file), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                os.close(fd)

                # We got the lock, run the alert check
                try:
                    from .emails import check_and_send_low_term_alerts
                    import logging

                    logger = logging.getLogger(__name__)
                    logger.info("Running automatic low term count alert check...")

                    check_and_send_low_term_alerts()

                    logger.info("Low term count alert check completed")

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
                logger.error(f"Failed to run automatic low term count alert check: {e}")

        # Start background thread
        thread = threading.Thread(target=check_alerts, daemon=True)
        thread.start()
