from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import timedelta, datetime
from jose import jwt
from database import get_db
from config import settings
from schemas import UserCreate, UserLogin, UserResponse, Token, PasswordReset, PasswordChange
from crud import (
    get_user_by_email, get_user_by_username, get_user_by_id,
    create_user, verify_user_email, verify_password
)
from dependencies import get_current_user
from mail import send_verification_email, send_password_reset_email
import secrets

router = APIRouter(prefix="/auth", tags=["auth"])


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.JWT_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt


@router.get("/users/{user_id}")
async def get_user_by_id_endpoint(user_id: int, db: AsyncSession = Depends(get_db)):
    """Получить пользователя по ID (для внутренних запросов микросервисов)"""
    user = await get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return {"id": user.id, "username": user.username, "email": user.email}


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    existing_user = await get_user_by_email(db, email=user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email уже зарегистрирован"
        )

    existing_username = await get_user_by_username(db, username=user_data.username)
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Имя пользователя занято"
        )

    user = await create_user(db, user_data)
    verification_token = secrets.token_urlsafe(32)
    send_verification_email(user.email, verification_token)

    return user


@router.post("/login", response_model=Token)
async def login(user_data: UserLogin, db: AsyncSession = Depends(get_db)):
    user = await get_user_by_email(db, email=user_data.email)

    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь неактивен"
        )

    access_token_expires = timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "user_id": user.id},
        expires_delta=access_token_expires
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/verify-email")
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    raise HTTPException(
        status_code=status.HTTP_200_OK,
        detail="Email подтвержден (заглушка)"
    )


@router.post("/forgot-password")
async def forgot_password(reset_data: PasswordReset, db: AsyncSession = Depends(get_db)):
    user = await get_user_by_email(db, email=reset_data.email)
    if not user:
        return {"message": "Если email существует, письмо отправлено"}

    reset_token = secrets.token_urlsafe(32)
    send_password_reset_email(user.email, reset_token)

    return {"message": "Если email существует, письмо отправлено"}


@router.post("/reset-password")
async def reset_password(reset_data: PasswordChange, db: AsyncSession = Depends(get_db)):
    raise HTTPException(
        status_code=status.HTTP_200_OK,
        detail="Пароль изменен (заглушка)"
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user=Depends(get_current_user)):
    return current_user


@router.post("/logout")
async def logout(current_user=Depends(get_current_user)):
    return {"message": "Выход выполнен"}
