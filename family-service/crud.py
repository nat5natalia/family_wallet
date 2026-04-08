from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from models import FamilyWaiter, Family, WaiterStatus
from schemas import FamilyWaiterCreate


async def get_waiters_by_email(db: AsyncSession, email: str, skip: int = 0, limit: int = 100) -> tuple[list[FamilyWaiter], int]:
    """Получить приглашения для конкретного пользователя (по email)"""
    count_result = await db.execute(
        select(func.count()).select_from(FamilyWaiter).where(FamilyWaiter.email == email)
    )
    total = count_result.scalar()

    result = await db.execute(
        select(FamilyWaiter)
        .where(FamilyWaiter.email == email)
        .order_by(FamilyWaiter.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all()), total


async def get_waiters_by_family_id(db: AsyncSession, family_id: int) -> list[FamilyWaiter]:
    result = await db.execute(
        select(FamilyWaiter)
        .where(FamilyWaiter.family_id == family_id)
        .order_by(FamilyWaiter.created_at.desc())
    )
    return list(result.scalars().all())


async def create_waiter(db: AsyncSession, email: str, family_id: int, invited_by: int) -> FamilyWaiter:
    db_waiter = FamilyWaiter(
        family_id=family_id,
        email=email,
        invited_by=invited_by
    )
    db.add(db_waiter)
    await db.flush()
    await db.refresh(db_waiter)
    return db_waiter


async def get_waiter_by_id(db: AsyncSession, waiter_id: int) -> FamilyWaiter | None:
    result = await db.execute(select(FamilyWaiter).where(FamilyWaiter.id == waiter_id))
    return result.scalars().first()


async def get_waiter_by_email_and_family(
    db: AsyncSession,
    email: str,
    family_id: int
) -> FamilyWaiter | None:
    result = await db.execute(
        select(FamilyWaiter)
        .where(FamilyWaiter.email == email, FamilyWaiter.family_id == family_id)
    )
    return result.scalars().first()


async def update_waiter_status(db: AsyncSession, waiter_id: int, status: WaiterStatus) -> FamilyWaiter | None:
    waiter = await get_waiter_by_id(db, waiter_id)
    if waiter:
        waiter.status = status
        await db.flush()
        await db.refresh(waiter)
    return waiter


async def delete_waiter(db: AsyncSession, waiter_id: int) -> bool:
    waiter = await get_waiter_by_id(db, waiter_id)
    if waiter:
        await db.delete(waiter)
        await db.flush()
        return True
    return False


async def get_family_by_id(db: AsyncSession, family_id: int) -> Family | None:
    result = await db.execute(select(Family).where(Family.id == family_id))
    return result.scalars().first()


async def get_family_by_owner_id(db: AsyncSession, owner_id: int) -> Family | None:
    """Найти семью по владельцу"""
    result = await db.execute(select(Family).where(Family.owner_id == owner_id))
    return result.scalars().first()


async def get_or_create_family_for_user(db: AsyncSession, owner_id: int, username: str) -> Family:
    """Если семьи нет — создать с дефолтным именем"""
    family = await get_family_by_owner_id(db, owner_id)
    if not family:
        family = Family(
            name=f"Семья {username}",
            owner_id=owner_id
        )
        db.add(family)
        await db.flush()
        await db.refresh(family)
    return family
