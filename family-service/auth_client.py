import httpx
from config import settings
from typing import Optional

_cache: dict[int, str] = {}


async def get_username_by_id(user_id: int) -> Optional[str]:
    """Получить имя пользователя из auth-service"""
    if user_id in _cache:
        return _cache[user_id]

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{settings.AUTH_SERVICE_URL}/auth/users/{user_id}"
            )
            if response.status_code == 200:
                data = response.json()
                name = data.get("username")
                if name:
                    _cache[user_id] = name
                    return name
    except Exception:
        pass

    return f"Пользователь #{user_id}"
