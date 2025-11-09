"""
Email templates for VIMS4ALL system.

All email templates are centralized here for easier maintenance and consistency.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class EmailTemplate:
    """Container for email subject, text body, and HTML body."""

    subject: str
    text: str
    html: str


def account_created_with_password(
    *,
    first_name: str,
    username: str,
    password: str,
    institute_name: str,
) -> EmailTemplate:
    """
    Email sent when an employee account is created with a temporary password.

    Args:
        first_name: Employee's first name
        username: Login username (usually email)
        password: Temporary password
        institute_name: Name of the institute the user belongs to
    """
    subject = "Your VIMS4ALL account"

    text = (
        f"Hello {first_name},\n\n"
        f"Your VIMS4ALL account has been created for {institute_name}.\n\n"
        f"Username: {username}\n"
        f"Temporary password: {password}\n\n"
        f"Please sign in and change your password immediately.\n\n"
        f"Best regards,\n"
        f"VIMS4ALL Team"
    )

    html = (
        f"<p>Hello {first_name},</p>"
        f"<p>Your <strong>VIMS4ALL</strong> account has been created for <strong>{institute_name}</strong>.</p>"
        f"<p><b>Username:</b> {username}<br>"
        f"<b>Temporary password:</b> {password}</p>"
        f"<p>Please sign in and change your password immediately.</p>"
        f"<p>Best regards,<br>VIMS4ALL Team</p>"
    )

    return EmailTemplate(subject=subject, text=text, html=html)


def account_created_with_invite_link(
    *,
    first_name: str,
    username: str,
    set_password_url: str,
    institute_name: str,
) -> EmailTemplate:
    """
    Email sent when an employee account is created with an invite link to set password.

    Args:
        first_name: Employee's first name
        username: Login username (usually email)
        set_password_url: One-time URL to set password
        institute_name: Name of the institute the user belongs to
    """
    subject = "Your VIMS4ALL account – set your password"

    text = (
        f"Hello {first_name},\n\n"
        f"Your VIMS4ALL account has been created for {institute_name}.\n\n"
        f"Username (email): {username}\n"
        f"Set your password here (valid once):\n{set_password_url}\n\n"
        f"If you did not request this, please ignore this email.\n\n"
        f"Best regards,\n"
        f"VIMS4ALL Team"
    )

    html = (
        f"<p>Hello {first_name},</p>"
        f"<p>Your <strong>VIMS4ALL</strong> account has been created for <strong>{institute_name}</strong>.</p>"
        f"<p><b>Username:</b> {username}</p>"
        f"<p><a href='{set_password_url}' style='display:inline-block;padding:10px 20px;background-color:#1976d2;color:white;text-decoration:none;border-radius:4px;'>Set Your Password</a></p>"
        f"<p>Or copy and paste this link into your browser:<br>"
        f"<small>{set_password_url}</small></p>"
        f"<p>If you did not request this, please ignore this email.</p>"
        f"<p>Best regards,<br>VIMS4ALL Team</p>"
    )

    return EmailTemplate(subject=subject, text=text, html=html)


def password_reset_email(
    *,
    first_name: str,
    reset_password_url: str,
    institute_name: Optional[str] = None,
) -> EmailTemplate:
    """
    Email sent when a user requests a password reset.

    Args:
        first_name: User's first name
        reset_password_url: One-time URL to reset password
        institute_name: Optional institute name
    """
    subject = "VIMS4ALL – Password Reset Request"

    institute_text = f" for {institute_name}" if institute_name else ""

    text = (
        f"Hello {first_name},\n\n"
        f"We received a request to reset your VIMS4ALL password{institute_text}.\n\n"
        f"Reset your password here (valid once):\n{reset_password_url}\n\n"
        f"If you did not request this, please ignore this email. Your password will remain unchanged.\n\n"
        f"Best regards,\n"
        f"VIMS4ALL Team"
    )

    html = (
        f"<p>Hello {first_name},</p>"
        f"<p>We received a request to reset your <strong>VIMS4ALL</strong> password{institute_text}.</p>"
        f"<p><a href='{reset_password_url}' style='display:inline-block;padding:10px 20px;background-color:#1976d2;color:white;text-decoration:none;border-radius:4px;'>Reset Your Password</a></p>"
        f"<p>Or copy and paste this link into your browser:<br>"
        f"<small>{reset_password_url}</small></p>"
        f"<p>If you did not request this, please ignore this email. Your password will remain unchanged.</p>"
        f"<p>Best regards,<br>VIMS4ALL Team</p>"
    )

    return EmailTemplate(subject=subject, text=text, html=html)


# Add more email templates as needed:
# - Welcome email
# - Account deactivation
# - Institute notifications
# - etc.
