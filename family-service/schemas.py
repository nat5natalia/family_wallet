from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, date
from enum import Enum


class WaiterStatus(str, Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"


class TaskType(str, Enum):
    goal = "goal"
    payment = "payment"
    ai = "ai"


class TaskStatus(str, Enum):
    pending = "pending"
    completed = "completed"


# ===== Waiters =====
class FamilyWaiterCreate(BaseModel):
    email: EmailStr


class FamilyWaiterResponse(BaseModel):
    id: int
    family_id: int
    email: str
    invited_by: int
    invited_by_name: Optional[str] = None
    status: WaiterStatus
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FamilyWaiterListResponse(BaseModel):
    waiters: list[FamilyWaiterResponse]
    total: int


# ===== Family =====
class FamilyInfo(BaseModel):
    id: int
    name: str
    owner_id: int
    owner_name: Optional[str] = None
    tier_name: str = "Старт"
    created_at: Optional[datetime] = None
    members_count: int = 1

    class Config:
        from_attributes = True


# ===== Tasks =====
class TaskCreate(BaseModel):
    title: str
    description: str
    task_type: TaskType
    amount: Optional[float] = None
    deadline: Optional[datetime] = None
    assignee_user_id: Optional[int] = None


class TaskResponse(BaseModel):
    id: int
    title: str
    description: str
    task_type: TaskType
    status: TaskStatus
    amount: Optional[float] = None
    current_amount: Optional[float] = 0
    deadline: Optional[datetime] = None
    assignee_user_id: Optional[int] = None
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ===== Subscriptions =====
class SubscriptionResponse(BaseModel):
    id: int
    name: str
    amount: float
    currency: str = "RUB"
    category: str
    next_billing: Optional[date] = None
    billing_period: str = "monthly"
    owner_user_id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ===== Calendar =====
class CalendarEventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    amount: Optional[float] = None
    event_date: datetime
    recurring: Optional[str] = None  # monthly, weekly, quarterly, yearly
    responsible_user_id: Optional[int] = None


class CalendarEventResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    amount: Optional[float] = None
    event_date: datetime
    recurring: Optional[str] = None
    responsible_user_id: Optional[int] = None
    created_by: Optional[int] = None

    class Config:
        from_attributes = True


# ===== Junior =====
class JuniorTaskCreate(BaseModel):
    title: str
    reward: float
    deadline: Optional[datetime] = None


class JuniorTaskResponse(BaseModel):
    id: int
    title: str
    reward: float
    deadline: Optional[datetime] = None
    status: TaskStatus
    child_user_id: int
    created_by: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class JuniorQuestResponse(BaseModel):
    id: int
    title: str
    description: str
    reward_text: str
    completed: bool
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class JuniorMoneyRequestResponse(BaseModel):
    id: int
    amount: float
    reason: str
    status: str  # pending, approved, rejected
    created_at: Optional[datetime] = None
    child_user_id: int
    parent_approved_by: Optional[int] = None

    class Config:
        from_attributes = True

class FamilyMemberResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    status: str  # member, pending и т.д.

class FamilyMemberResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    status: str
