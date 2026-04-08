from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select
from datetime import datetime
from database import get_db
from schemas import (
    FamilyWaiterCreate, FamilyWaiterResponse, FamilyWaiterListResponse,
    FamilyInfo, TaskCreate, TaskResponse, SubscriptionResponse,
    CalendarEventCreate, CalendarEventResponse,
    JuniorTaskCreate, JuniorTaskResponse, JuniorQuestResponse,
    JuniorMoneyRequestResponse
)
from crud import (
    get_waiters_by_email, create_waiter, get_waiter_by_id,
    update_waiter_status, get_waiter_by_email_and_family,
    delete_waiter, get_family_by_id, get_or_create_family_for_user
)
from dependencies import get_current_user
from models import WaiterStatus, TaskStatus, FamilyTask, Subscription, CalendarEvent, JuniorTask, JuniorQuest
from auth_client import get_username_by_id

router = APIRouter(prefix="/family", tags=["family"])


def _family_id(ctx):
    return ctx["user_id"]  # use user_id as family owner for simplicity


# ===================== WAITERS =====================

@router.get("/family-waiters.json", response_model=FamilyWaiterListResponse)
async def list_waiters(
    skip: int = 0, limit: int = 100,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    waiters, total = await get_waiters_by_email(db, email=current_user["email"], skip=skip, limit=limit)
    result = []
    for w in waiters:
        name = await get_username_by_id(w.invited_by) if w.invited_by else None
        result.append(FamilyWaiterResponse(
            id=w.id, family_id=w.family_id, email=w.email,
            invited_by=w.invited_by, invited_by_name=name,
            status=w.status, created_at=w.created_at, updated_at=w.updated_at
        ))
    return FamilyWaiterListResponse(waiters=result, total=total)


@router.post("/family-waiters", response_model=FamilyWaiterResponse, status_code=status.HTTP_201_CREATED)
async def create_waiter_ep(
    data: FamilyWaiterCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    family = await get_or_create_family_for_user(db, current_user["user_id"], current_user.get("username", ""))
    existing = await get_waiter_by_email_and_family(db, data.email, family.id)
    if existing:
        raise HTTPException(400, "Приглашение уже существует")
    if data.email == current_user["email"]:
        raise HTTPException(400, "Нельзя пригласить себя")
    try:
        w = await create_waiter(db, data.email, family.id, current_user["user_id"])
    except IntegrityError:
        raise HTTPException(400, "Ошибка создания")
    return FamilyWaiterResponse(
        id=w.id, family_id=w.family_id, email=w.email, invited_by=w.invited_by,
        invited_by_name=current_user.get("username"), status=w.status,
        created_at=w.created_at, updated_at=w.updated_at
    )


@router.post("/family-waiters/{wid}/accept", response_model=FamilyWaiterResponse)
async def accept_waiter(wid: int, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    w = await get_waiter_by_id(db, wid)
    if not w: raise HTTPException(404, "Не найдено")
    if w.email != current_user["email"]: raise HTTPException(403, "Не для вас")
    if w.status != WaiterStatus.pending: raise HTTPException(400, "Уже обработано")
    w = await update_waiter_status(db, wid, WaiterStatus.accepted)
    name = await get_username_by_id(w.invited_by) if w.invited_by else None
    return FamilyWaiterResponse(
        id=w.id, family_id=w.family_id, email=w.email, invited_by=w.invited_by,
        invited_by_name=name, status=w.status, created_at=w.created_at, updated_at=w.updated_at
    )


@router.post("/family-waiters/{wid}/reject", response_model=FamilyWaiterResponse)
async def reject_waiter(wid: int, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    w = await get_waiter_by_id(db, wid)
    if not w: raise HTTPException(404, "Не найдено")
    if w.email != current_user["email"]: raise HTTPException(403, "Не для вас")
    if w.status != WaiterStatus.pending: raise HTTPException(400, "Уже обработано")
    w = await update_waiter_status(db, wid, WaiterStatus.rejected)
    name = await get_username_by_id(w.invited_by) if w.invited_by else None
    return FamilyWaiterResponse(
        id=w.id, family_id=w.family_id, email=w.email, invited_by=w.invited_by,
        invited_by_name=name, status=w.status, created_at=w.created_at, updated_at=w.updated_at
    )


@router.delete("/family-waiters/{wid}", status_code=204)
async def delete_waiter_ep(wid: int, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    w = await get_waiter_by_id(db, wid)
    if not w: raise HTTPException(404, "Не найдено")
    if w.invited_by != current_user["user_id"]: raise HTTPException(403, "Только пригласитель")
    await delete_waiter(db, wid)


# ===================== FAMILY =====================

@router.get("/my", response_model=FamilyInfo)
async def get_my_family(current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    family = await get_or_create_family_for_user(db, current_user["user_id"], current_user.get("username", ""))
    owner_name = await get_username_by_id(family.owner_id)
    return FamilyInfo(id=family.id, name=family.name, owner_id=family.owner_id,
                      owner_name=owner_name, created_at=family.created_at)


# ===================== TASKS =====================

@router.get("/tasks", response_model=list[TaskResponse])
async def list_tasks(current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    family = await get_or_create_family_for_user(db, current_user["user_id"], current_user.get("username", ""))
    res = await db.execute(select(FamilyTask).where(FamilyTask.family_id == family.id).order_by(FamilyTask.created_at.desc()))
    tasks = res.scalars().all()
    return [TaskResponse(
        id=t.id, title=t.title, description=t.description, task_type=t.task_type,
        status=t.status, amount=t.amount, current_amount=t.current_amount,
        deadline=t.deadline, assignee_user_id=t.assignee_user_id,
        created_by=t.created_by, created_at=t.created_at
    ) for t in tasks]


@router.post("/tasks", response_model=TaskResponse, status_code=201)
async def create_task(
    data: TaskCreate, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    family = await get_or_create_family_for_user(db, current_user["user_id"], current_user.get("username", ""))
    task = FamilyTask(
        family_id=family.id, title=data.title, description=data.description,
        task_type=data.task_type, amount=data.amount, deadline=data.deadline,
        assignee_user_id=data.assignee_user_id, created_by=current_user["user_id"]
    )
    db.add(task)
    await db.flush()
    await db.refresh(task)
    return TaskResponse(
        id=task.id, title=task.title, description=task.description, task_type=task.task_type,
        status=task.status, amount=task.amount, current_amount=task.current_amount,
        deadline=task.deadline, assignee_user_id=task.assignee_user_id,
        created_by=task.created_by, created_at=task.created_at
    )


# ===================== SUBSCRIPTIONS =====================

@router.get("/subscriptions", response_model=list[SubscriptionResponse])
async def list_subs(current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    family = await get_or_create_family_for_user(db, current_user["user_id"], current_user.get("username", ""))
    res = await db.execute(select(Subscription).where(Subscription.family_id == family.id))
    subs = res.scalars().all()
    return [SubscriptionResponse(
        id=s.id, name=s.name, amount=s.amount, currency=s.currency,
        category=s.category, next_billing=s.next_billing,
        billing_period=s.billing_period, owner_user_id=s.owner_user_id,
        created_at=s.created_at
    ) for s in subs]


# ===================== CALENDAR =====================

@router.get("/calendar", response_model=list[CalendarEventResponse])
async def list_events(current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    family = await get_or_create_family_for_user(db, current_user["user_id"], current_user.get("username", ""))
    res = await db.execute(select(CalendarEvent).where(CalendarEvent.family_id == family.id).order_by(CalendarEvent.event_date))
    events = res.scalars().all()
    return [CalendarEventResponse(
        id=e.id, title=e.title, description=e.description, amount=e.amount,
        event_date=e.event_date, recurring=e.recurring,
        responsible_user_id=e.responsible_user_id, created_by=e.created_by
    ) for e in events]


@router.post("/calendar", response_model=CalendarEventResponse, status_code=201)
async def create_event(
    data: CalendarEventCreate, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    family = await get_or_create_family_for_user(db, current_user["user_id"], current_user.get("username", ""))
    ev = CalendarEvent(
        family_id=family.id, title=data.title, description=data.description,
        amount=data.amount, event_date=data.event_date, recurring=data.recurring,
        responsible_user_id=data.responsible_user_id, created_by=current_user["user_id"]
    )
    db.add(ev)
    await db.flush()
    await db.refresh(ev)
    return CalendarEventResponse(
        id=ev.id, title=ev.title, description=ev.description, amount=ev.amount,
        event_date=ev.event_date, recurring=ev.recurring,
        responsible_user_id=ev.responsible_user_id, created_by=ev.created_by
    )


# ===================== JUNIOR =====================

@router.get("/junior/tasks", response_model=list[JuniorTaskResponse])
async def list_junior_tasks(current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    family = await get_or_create_family_for_user(db, current_user["user_id"], current_user.get("username", ""))
    res = await db.execute(select(JuniorTask).where(JuniorTask.family_id == family.id).order_by(JuniorTask.created_at.desc()))
    tasks = res.scalars().all()
    return [JuniorTaskResponse(
        id=t.id, title=t.title, reward=t.reward, deadline=t.deadline,
        status=t.status, child_user_id=t.child_user_id,
        created_by=t.created_by, created_at=t.created_at
    ) for t in tasks]


@router.post("/junior/tasks", response_model=JuniorTaskResponse, status_code=201)
async def create_junior_task(
    data: JuniorTaskCreate, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    family = await get_or_create_family_for_user(db, current_user["user_id"], current_user.get("username", ""))
    task = JuniorTask(
        family_id=family.id, child_user_id=current_user["user_id"],
        title=data.title, reward=data.reward, deadline=data.deadline,
        created_by=current_user["user_id"]
    )
    db.add(task)
    await db.flush()
    await db.refresh(task)
    return JuniorTaskResponse(
        id=task.id, title=task.title, reward=task.reward, deadline=task.deadline,
        status=task.status, child_user_id=task.child_user_id,
        created_by=task.created_by, created_at=task.created_at
    )


@router.get("/junior/quests", response_model=list[JuniorQuestResponse])
async def list_quests(current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(JuniorQuest).order_by(JuniorQuest.id))
    quests = res.scalars().all()
    return [JuniorQuestResponse(
        id=q.id, title=q.title, description=q.description,
        reward_text=q.reward_text, completed=False
    ) for q in quests]


@router.get("/junior/requests", response_model=list[JuniorMoneyRequestResponse])
async def list_junior_requests(current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Demo - empty list
    return []
