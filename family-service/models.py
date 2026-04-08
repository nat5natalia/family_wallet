from sqlalchemy import Column, Integer, String, Float, DateTime, Enum, Text, ForeignKey, Date, func
from sqlalchemy.ext.declarative import declarative_base
import enum

Base = declarative_base()


class WaiterStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"


class TaskType(str, enum.Enum):
    goal = "goal"
    payment = "payment"
    ai = "ai"


class TaskStatus(str, enum.Enum):
    pending = "pending"
    completed = "completed"


class FamilyWaiter(Base):
    __tablename__ = "family_waiters"
    id = Column(Integer, primary_key=True, index=True)
    family_id = Column(Integer, nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    invited_by = Column(Integer, nullable=True)
    status = Column(Enum(WaiterStatus), default=WaiterStatus.pending)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Family(Base):
    __tablename__ = "families"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    owner_id = Column(Integer, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class FamilyTask(Base):
    __tablename__ = "family_tasks"
    id = Column(Integer, primary_key=True, index=True)
    family_id = Column(Integer, nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    task_type = Column(Enum(TaskType), default=TaskType.goal)
    status = Column(Enum(TaskStatus), default=TaskStatus.pending)
    amount = Column(Float)
    current_amount = Column(Float, default=0)
    deadline = Column(DateTime)
    assignee_user_id = Column(Integer)
    created_by = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())


class Subscription(Base):
    __tablename__ = "subscriptions"
    id = Column(Integer, primary_key=True, index=True)
    family_id = Column(Integer, nullable=False, index=True)
    owner_user_id = Column(Integer, nullable=False)
    name = Column(String(255), nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default="RUB")
    category = Column(String(100))
    next_billing = Column(Date)
    billing_period = Column(String(20), default="monthly")
    created_at = Column(DateTime, server_default=func.now())


class CalendarEvent(Base):
    __tablename__ = "calendar_events"
    id = Column(Integer, primary_key=True, index=True)
    family_id = Column(Integer, nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    amount = Column(Float)
    event_date = Column(DateTime, nullable=False)
    recurring = Column(String(20))
    responsible_user_id = Column(Integer)
    created_by = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())


class JuniorTask(Base):
    __tablename__ = "junior_tasks"
    id = Column(Integer, primary_key=True, index=True)
    family_id = Column(Integer, nullable=False, index=True)
    child_user_id = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    reward = Column(Float, nullable=False)
    deadline = Column(DateTime)
    status = Column(Enum(TaskStatus), default=TaskStatus.pending)
    created_by = Column(Integer, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class JuniorQuest(Base):
    __tablename__ = "junior_quests"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    reward_text = Column(String(255))
    level_required = Column(Integer, default=1)
