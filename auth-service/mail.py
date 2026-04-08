import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import settings
from typing import Optional


def send_email(to_email: str, subject: str, html_content: str) -> bool:
    """Отправка email через SMTP"""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        print(f"[MOCK EMAIL] To: {to_email}, Subject: {subject}")
        print(f"[MOCK EMAIL] Content: {html_content}")
        return True
    
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = settings.SMTP_FROM
        msg['To'] = to_email
        
        html_part = MIMEText(html_content, 'html')
        msg.attach(html_part)
        
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False


def send_verification_email(email: str, token: str) -> bool:
    """Отправка email для верификации"""
    verification_link = f"http://localhost/auth/verify-email?token={token}"
    html_content = f"""
    <html>
        <body>
            <h2>Подтверждение email</h2>
            <p>Перейдите по ссылке для подтверждения вашего email:</p>
            <a href="{verification_link}">Подтвердить email</a>
            <p>Или используйте токен: {token}</p>
        </body>
    </html>
    """
    return send_email(email, "Подтверждение email", html_content)


def send_password_reset_email(email: str, token: str) -> bool:
    """Отправка email для сброса пароля"""
    reset_link = f"http://localhost/auth/reset-password?token={token}"
    html_content = f"""
    <html>
        <body>
            <h2>Сброс пароля</h2>
            <p>Перейдите по ссылке для сброса пароля:</p>
            <a href="{reset_link}">Сбросить пароль</a>
            <p>Или используйте токен: {token}</p>
        </body>
    </html>
    """
    return send_email(email, "Сброс пароля", html_content)
