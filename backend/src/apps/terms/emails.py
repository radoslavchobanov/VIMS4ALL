"""
Email notification utilities for term transitions.
"""
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from typing import Optional

from .models import AcademicTerm, TermTransition


def send_term_end_reminder(term: AcademicTerm, recipient_email: str) -> bool:
    """
    Send reminder email 1 week before term ends, informing about the need to move students.

    Args:
        term: The academic term that is ending
        recipient_email: Email address of the recipient (director/registrar)

    Returns:
        True if email was sent successfully, False otherwise
    """
    subject = f"Action Required: Term {term.name} Ending Soon"

    message = f"""
Dear Director/Registrar,

This is a reminder that the academic term "{term.name}" will end on {term.end_date.strftime('%B %d, %Y')}.

Following the end of the term, you will have a 1-week window (until {(term.end_date + timedelta(days=7)).strftime('%B %d, %Y')}) to move students to their next classes for the upcoming term.

Please log in to the system and use the "Move students to next class" function in the Students page to complete this transition.

Important:
- This action can only be performed ONCE per term
- Students will automatically progress to the next class level
- Only students below the maximum class level will be moved

Best regards,
VIMS4ALL System
    """.strip()

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient_email],
            fail_silently=False,
        )

        # Update the TermTransition record to mark reminder as sent
        transition, created = TermTransition.objects.get_or_create(
            term=term,
            institute=term.institute,
        )
        transition.reminder_sent_at = timezone.now()
        transition.save(update_fields=["reminder_sent_at", "updated_at"])

        return True
    except Exception as e:
        # Log the error (you might want to use proper logging here)
        print(f"Failed to send term end reminder for {term.name}: {e}")
        return False


def send_term_start_welcome(term: AcademicTerm, recipient_email: str) -> bool:
    """
    Send welcome email 1 day before new term starts.

    Args:
        term: The academic term that is starting
        recipient_email: Email address of the recipient (director/registrar)

    Returns:
        True if email was sent successfully, False otherwise
    """
    subject = f"Welcome to New Term: {term.name}"

    message = f"""
Dear Director/Registrar,

Welcome to the new academic term "{term.name}" which begins on {term.start_date.strftime('%B %d, %Y')}.

We hope you had a successful transition period. All students should now be enrolled in their respective classes for the new term.

If you have not yet moved students to their next classes, please do so as soon as possible through the Students page in the system.

We wish you a productive and successful term!

Best regards,
VIMS4ALL System
    """.strip()

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient_email],
            fail_silently=False,
        )

        # Update the TermTransition record to mark welcome as sent
        transition, created = TermTransition.objects.get_or_create(
            term=term,
            institute=term.institute,
        )
        transition.welcome_sent_at = timezone.now()
        transition.save(update_fields=["welcome_sent_at", "updated_at"])

        return True
    except Exception as e:
        # Log the error (you might want to use proper logging here)
        print(f"Failed to send term start welcome for {term.name}: {e}")
        return False


def check_and_send_term_reminders():
    """
    Check all terms and send reminder emails for terms ending within 1 week.
    This should be called by a scheduled task (e.g., daily cron job).
    """
    from apps.accounts.models import User
    from django.db.models import Q

    today = timezone.now().date()
    one_week_from_now = today + timedelta(days=7)

    # Find terms ending within the next week
    ending_terms = AcademicTerm.objects.filter(
        end_date__gte=today,
        end_date__lte=one_week_from_now
    ).select_related('institute')

    for term in ending_terms:
        # Check if reminder already sent
        try:
            transition = TermTransition.objects.get(term=term)
            if transition.reminder_sent_at:
                continue  # Already sent
        except TermTransition.DoesNotExist:
            pass  # Will create in send_term_end_reminder

        # Find directors and registrars for this institute
        recipients = User.objects.filter(
            institute=term.institute,
            is_active=True
        ).filter(
            Q(role='institute_admin') |
            Q(employee__function_code__in=['director', 'registrar'])
        ).values_list('email', flat=True)

        # Send email to each recipient
        for email in recipients:
            if email:  # Only send if email is set
                send_term_end_reminder(term, email)


def check_and_send_term_welcomes():
    """
    Check all terms and send welcome emails for terms starting within 1 day.
    This should be called by a scheduled task (e.g., daily cron job).
    """
    from apps.accounts.models import User
    from django.db.models import Q

    today = timezone.now().date()
    tomorrow = today + timedelta(days=1)

    # Find terms starting tomorrow
    starting_terms = AcademicTerm.objects.filter(
        start_date=tomorrow
    ).select_related('institute')

    for term in starting_terms:
        # Check if welcome already sent
        try:
            transition = TermTransition.objects.get(term=term)
            if transition.welcome_sent_at:
                continue  # Already sent
        except TermTransition.DoesNotExist:
            pass  # Will create in send_term_start_welcome

        # Find directors and registrars for this institute
        recipients = User.objects.filter(
            institute=term.institute,
            is_active=True
        ).filter(
            Q(role='institute_admin') |
            Q(employee__function_code__in=['director', 'registrar'])
        ).values_list('email', flat=True)

        # Send email to each recipient
        for email in recipients:
            if email:  # Only send if email is set
                send_term_start_welcome(term, email)
