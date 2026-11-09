from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_session
from .models import User

passwords = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2 = OAuth2PasswordBearer(tokenUrl="/auth/token")


def issue_token(user: User) -> str:
    settings = get_settings()
    payload = {"sub": str(user.id), "role": user.role, "exp": __import__("datetime").datetime.now(__import__("datetime").timezone.utc) + __import__("datetime").timedelta(minutes=settings.access_token_minutes)}
    return __import__("jwt").encode(payload, settings.jwt_secret, algorithm="HS256")


def current_user(token: str = Depends(oauth2), session: Session = Depends(get_session)) -> User:
    try:
        payload = __import__("jwt").decode(token, get_settings().jwt_secret, algorithms=["HS256"])
        subject = payload["sub"]
        user_id = UUID(str(subject))
    except (__import__("jwt").InvalidTokenError, KeyError, ValueError, TypeError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid authentication token")
    user = session.get(User, user_id)
    if not user or not user.active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account is unavailable")
    return user


def require(*roles: str):
    def dependency(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permission")
        return user
    return dependency
