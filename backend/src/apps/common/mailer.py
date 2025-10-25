from __future__ import annotations
from typing import Iterable, Protocol, Optional
from django.core.mail import EmailMultiAlternatives
from django.conf import settings


class Mailer(Protocol):
    def send(
        self,
        *,
        subject: str,
        to: Iterable[str],
        text: str,
        html: Optional[str] = None,
        reply_to: Optional[Iterable[str]] = None,
    ) -> None: ...


class DjangoMailer:
    def send(
        self,
        *,
        subject: str,
        to: Iterable[str],
        text: str,
        html: Optional[str] = None,
        reply_to: Optional[Iterable[str]] = None,
    ) -> None:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=list(to),
            reply_to=list(reply_to or ["service@vims4all.eu"]),
        )
        if html:
            msg.attach_alternative(html, "text/html")
        msg.send(fail_silently=False)


mailer: Mailer = DjangoMailer()  # default; in tests you can monkeypatch this symbol
