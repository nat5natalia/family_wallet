@router.get("/members", response_model=list[FamilyMemberResponse])
async def list_family_members(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить всех членов семьи текущего пользователя"""
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"Getting family members for user {current_user['user_id']}")
    
    # Получаем семью пользователя
    family = await get_or_create_family_for_user(db, current_user["user_id"], current_user.get("username", ""))
    
    members = []
    seen_emails = set()
    
    # 1. Добавляем владельца семьи (организатора)
    owner_name = await get_username_by_id(family.owner_id)
    owner_email = current_user.get("email", f"user_{family.owner_id}@example.com")
    members.append(FamilyMemberResponse(
        id=family.owner_id,
        name=owner_name or f"User #{family.owner_id}",
        email=owner_email,
        role="organizer",
        status="member"
    ))
    seen_emails.add(owner_email)
    
    # 2. Получаем всех, кто принял приглашение
    from sqlalchemy import select
    from models import FamilyWaiter, WaiterStatus
    
    waiters_result = await db.execute(
        select(FamilyWaiter).where(
            FamilyWaiter.family_id == family.id,
            FamilyWaiter.status == WaiterStatus.accepted
        )
    )
    accepted_waiters = waiters_result.scalars().all()
    
    logger.info(f"Found {len(accepted_waiters)} accepted waiters")
    
    # 3. Добавляем принявших участников
    for w in accepted_waiters:
        if w.email not in seen_emails:
            members.append(FamilyMemberResponse(
                id=w.id,
                name=w.email.split('@')[0],
                email=w.email,
                role="member",
                status="member"
            ))
            seen_emails.add(w.email)
    
    # 4. Также добавляем текущего пользователя, если он не владелец и не в списке
    current_email = current_user.get("email")
    if current_email and current_email not in seen_emails:
        members.append(FamilyMemberResponse(
            id=current_user["user_id"],
            name=current_user.get("username", "Пользователь"),
            email=current_email,
            role="member",
            status="member"
        ))
    
    logger.info(f"Returning {len(members)} family members")
    
    return members