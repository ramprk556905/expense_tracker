from datetime import datetime, timedelta
from typing import List
import os
import secrets
import smtplib
import uuid
from email.message import EmailMessage
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from sqlalchemy import Boolean, Column, DateTime, Float, String, create_engine, inspect, text
from sqlalchemy.orm import Session, declarative_base, sessionmaker


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./expenses.db")
SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production-use-long-random-string")
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 30
SESSION_EXPIRE_HOURS = 12
RESET_CODE_TTL_MINUTES = 15
SESSION_TOUCH_INTERVAL_MINUTES = 5
SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "").strip() or SMTP_USERNAME
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() not in {"0", "false", "no"}


def _parse_cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "")
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    if origins:
        return origins
    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://localhost:5173",
        "https://127.0.0.1:5173",
    ]


connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()


class UserModel(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    email_verified = Column(Boolean, default=False, nullable=False)
    email_verification_code = Column(String, nullable=True)
    email_verification_expires_at = Column(DateTime, nullable=True)
    notify_new_transaction = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class ExpenseModel(Base):
    __tablename__ = "expenses"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)
    description = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    category = Column(String, nullable=False)
    date = Column(String, nullable=False)
    type = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuthSessionModel(Base):
    __tablename__ = "auth_sessions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)
    email = Column(String, nullable=False, index=True)
    remember_me = Column(Boolean, default=False, nullable=False)
    user_agent = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_seen_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    logged_out_at = Column(DateTime, nullable=True)


class PasswordResetTokenModel(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)
    email = Column(String, nullable=False, index=True)
    code = Column(String, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)


Base.metadata.create_all(bind=engine)


def ensure_schema_columns():
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    if "users" not in tables:
        return

    columns = {column["name"] for column in inspector.get_columns("users")}
    statements = []

    if "email_verified" not in columns:
        statements.append("ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT 0")
    if "email_verification_code" not in columns:
        statements.append("ALTER TABLE users ADD COLUMN email_verification_code VARCHAR")
    if "email_verification_expires_at" not in columns:
        statements.append("ALTER TABLE users ADD COLUMN email_verification_expires_at DATETIME")
    if "notify_new_transaction" not in columns:
        statements.append("ALTER TABLE users ADD COLUMN notify_new_transaction BOOLEAN NOT NULL DEFAULT 1")

    if statements:
        with engine.begin() as conn:
            for statement in statements:
                conn.execute(text(statement))


ensure_schema_columns()


pwd = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")
bearer = HTTPBearer()


def password_valid(password: str) -> bool:
    return len(password) >= 6


def make_session_expiry(remember_me: bool) -> datetime:
    if remember_me:
        return datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS)
    return datetime.utcnow() + timedelta(hours=SESSION_EXPIRE_HOURS)


def make_token(email: str, session_id: str, expires_at: datetime) -> str:
    return jwt.encode({"sub": email, "sid": session_id, "exp": expires_at}, SECRET_KEY, algorithm=ALGORITHM)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def current_session(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
):
    try:
        payload = jwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        session_id = payload.get("sid")
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc

    if not email or not session_id:
        raise HTTPException(status_code=401, detail="Invalid session")

    session = db.query(AuthSessionModel).filter_by(id=session_id, email=email).first()
    if not session or session.logged_out_at is not None or session.expires_at <= datetime.utcnow():
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")

    refresh_cutoff = datetime.utcnow() - timedelta(minutes=SESSION_TOUCH_INTERVAL_MINUTES)
    if session.last_seen_at <= refresh_cutoff:
        session.last_seen_at = datetime.utcnow()
        db.commit()
        db.refresh(session)

    return session


def current_user(
    session: AuthSessionModel = Depends(current_session),
    db: Session = Depends(get_db),
):
    user = db.query(UserModel).filter_by(id=session.user_id, email=session.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def create_auth_session(user: UserModel, remember_me: bool, request: Request, db: Session):
    expires_at = make_session_expiry(remember_me)
    session = AuthSessionModel(
        user_id=user.id,
        email=user.email,
        remember_me=remember_me,
        user_agent=(request.headers.get("user-agent") or "")[:255] or None,
        ip_address=(request.client.host if request.client else None),
        expires_at=expires_at,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    token = make_token(user.email, session.id, session.expires_at)
    return token, session


def invalidate_user_sessions(user_id: str, db: Session):
    now = datetime.utcnow()
    active_sessions = db.query(AuthSessionModel).filter(
        AuthSessionModel.user_id == user_id,
        AuthSessionModel.logged_out_at.is_(None),
    )
    for session in active_sessions.all():
        session.logged_out_at = now
    db.commit()


def issue_password_reset(user: UserModel, db: Session):
    now = datetime.utcnow()
    pending_tokens = db.query(PasswordResetTokenModel).filter(
        PasswordResetTokenModel.user_id == user.id,
        PasswordResetTokenModel.used_at.is_(None),
    )
    for token in pending_tokens.all():
        token.used_at = now

    reset_code = secrets.token_hex(3).upper()
    reset_token = PasswordResetTokenModel(
        user_id=user.id,
        email=user.email,
        code=reset_code,
        expires_at=now + timedelta(minutes=RESET_CODE_TTL_MINUTES),
    )
    db.add(reset_token)
    db.commit()
    db.refresh(reset_token)
    return reset_token


def smtp_configured() -> bool:
    return bool(SMTP_HOST and SMTP_PORT and SMTP_FROM_EMAIL)


def send_email(subject: str, to_email: str, body: str):
    if not smtp_configured():
        return False, "Email delivery is not configured on the server."

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM_EMAIL
    msg["To"] = to_email
    msg.set_content(body)

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            if SMTP_USE_TLS:
                server.starttls()
            if SMTP_USERNAME and SMTP_PASSWORD:
                server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
        return True, None
    except Exception as exc:
        return False, str(exc)


class AuthBody(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False


class ForgotPasswordBody(BaseModel):
    email: EmailStr


class ResetPasswordBody(BaseModel):
    email: EmailStr
    code: str
    new_password: str


class TokenOut(BaseModel):
    access_token: str
    email: str
    remember_me: bool
    email_verified: bool
    notify_new_transaction: bool
    expires_at: datetime


class ForgotPasswordOut(BaseModel):
    message: str
    reset_code: str | None = None
    expires_at: datetime | None = None


class ProfileOut(BaseModel):
    email: str
    email_verified: bool
    notify_new_transaction: bool


class ChangePasswordBody(BaseModel):
    current_password: str
    new_password: str


class RequestVerificationOut(BaseModel):
    message: str
    verification_code: str | None = None
    expires_at: datetime | None = None


class VerifyEmailBody(BaseModel):
    code: str


class NotificationPrefsBody(BaseModel):
    notify_new_transaction: bool


class LogoutOut(BaseModel):
    ok: bool


class AuthHistoryOut(BaseModel):
    email: str
    remember_me: bool
    user_agent: str | None
    ip_address: str | None
    created_at: datetime
    last_seen_at: datetime
    logged_out_at: datetime | None
    active: bool


class ExpenseIn(BaseModel):
    description: str
    amount: float
    category: str
    date: str
    type: str


class ExpenseOut(ExpenseIn):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True


class DeploymentStatusOut(BaseModel):
    status: str
    database_engine: str
    database_hint: str
    database_connected: bool
    sqlite_path: str | None = None
    sqlite_file_exists: bool | None = None
    sqlite_dir_writable: bool | None = None
    render_disk_present: bool
    smtp_configured: bool
    smtp_missing_fields: list[str]
    checked_at: datetime


app = FastAPI(title="Expense Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_cors_origins(),
    allow_origin_regex=r"https://.*\.netlify\.app|https://.*\.onrender\.com",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health():
    return {"status": "ok"}


def database_hint(url: str) -> str:
    if url.startswith("sqlite"):
        return url
    if "@" in url:
        # Hide username/password for non-sqlite connection strings.
        prefix, suffix = url.split("@", 1)
        scheme = prefix.split("://", 1)[0] if "://" in prefix else "db"
        return f"{scheme}://***@{suffix}"
    return url


def sqlite_file_path(url: str) -> str | None:
    if not url.startswith("sqlite"):
        return None
    normalized = url
    if normalized.startswith("sqlite+pysqlite://"):
        normalized = normalized.replace("sqlite+pysqlite://", "sqlite://", 1)

    raw_path = normalized.replace("sqlite:///", "", 1)
    if raw_path.startswith("/"):
        return raw_path
    return str((Path.cwd() / raw_path).resolve())


@app.get("/ops/deployment-status", response_model=DeploymentStatusOut)
def deployment_status(db: Session = Depends(get_db)):
    connected = True
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        connected = False

    sqlite_path = sqlite_file_path(DATABASE_URL)
    sqlite_file_exists = None
    sqlite_dir_writable = None
    if sqlite_path:
        sqlite_file = Path(sqlite_path)
        sqlite_file_exists = sqlite_file.exists()
        sqlite_dir_writable = os.access(sqlite_file.parent, os.W_OK)

    missing_smtp = []
    if not SMTP_HOST:
        missing_smtp.append("SMTP_HOST")
    if not SMTP_FROM_EMAIL:
        missing_smtp.append("SMTP_FROM_EMAIL")
    if SMTP_USERNAME and not SMTP_PASSWORD:
        missing_smtp.append("SMTP_PASSWORD")

    return {
        "status": "ok",
        "database_engine": "sqlite" if DATABASE_URL.startswith("sqlite") else "external",
        "database_hint": database_hint(DATABASE_URL),
        "database_connected": connected,
        "sqlite_path": sqlite_path,
        "sqlite_file_exists": sqlite_file_exists,
        "sqlite_dir_writable": sqlite_dir_writable,
        "render_disk_present": Path("/var/data").exists(),
        "smtp_configured": smtp_configured(),
        "smtp_missing_fields": missing_smtp,
        "checked_at": datetime.utcnow(),
    }


@app.post("/auth/register", response_model=TokenOut)
def register(body: AuthBody, request: Request, db: Session = Depends(get_db)):
    if not password_valid(body.password):
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    if db.query(UserModel).filter_by(email=body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = UserModel(email=body.email, password=pwd.hash(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    token, session = create_auth_session(user, body.remember_me, request, db)
    return {
        "access_token": token,
        "email": body.email,
        "remember_me": body.remember_me,
        "email_verified": user.email_verified,
        "notify_new_transaction": user.notify_new_transaction,
        "expires_at": session.expires_at,
    }


@app.post("/auth/login", response_model=TokenOut)
def login(body: AuthBody, request: Request, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter_by(email=body.email).first()
    if not user or not pwd.verify(body.password, user.password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token, session = create_auth_session(user, body.remember_me, request, db)
    return {
        "access_token": token,
        "email": body.email,
        "remember_me": body.remember_me,
        "email_verified": user.email_verified,
        "notify_new_transaction": user.notify_new_transaction,
        "expires_at": session.expires_at,
    }


@app.get("/auth/profile", response_model=ProfileOut)
def profile(user: UserModel = Depends(current_user)):
    return {
        "email": user.email,
        "email_verified": user.email_verified,
        "notify_new_transaction": user.notify_new_transaction,
    }


@app.post("/auth/logout", response_model=LogoutOut)
def logout(session: AuthSessionModel = Depends(current_session), db: Session = Depends(get_db)):
    session.logged_out_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@app.post("/auth/change-password", response_model=LogoutOut)
def change_password(body: ChangePasswordBody, user: UserModel = Depends(current_user), db: Session = Depends(get_db)):
    if not pwd.verify(body.current_password, user.password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if not password_valid(body.new_password):
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    user.password = pwd.hash(body.new_password)
    db.commit()
    return {"ok": True}


@app.post("/auth/request-email-verification", response_model=RequestVerificationOut)
def request_email_verification(user: UserModel = Depends(current_user), db: Session = Depends(get_db)):
    if user.email_verified:
        return {"message": "Your email is already verified."}

    code = secrets.token_hex(3).upper()
    expires_at = datetime.utcnow() + timedelta(minutes=RESET_CODE_TTL_MINUTES)
    user.email_verification_code = code
    user.email_verification_expires_at = expires_at
    db.commit()

    sent, send_error = send_email(
        subject="ExpenseTracker email verification code",
        to_email=user.email,
        body=(
            "Use this code to verify your email: "
            f"{code}\n\n"
            f"This code expires at {expires_at.isoformat()} UTC."
        ),
    )

    if sent:
        return {
            "message": "Verification code sent to your email.",
            "expires_at": expires_at,
        }

    return {
        "message": f"Verification code created, but email delivery failed ({send_error or 'unknown error'}). Use the code below.",
        "verification_code": code,
        "expires_at": expires_at,
    }


@app.post("/auth/verify-email", response_model=ProfileOut)
def verify_email(body: VerifyEmailBody, user: UserModel = Depends(current_user), db: Session = Depends(get_db)):
    code = body.code.strip().upper()
    if (
        not user.email_verification_code
        or not user.email_verification_expires_at
        or user.email_verification_code != code
        or user.email_verification_expires_at <= datetime.utcnow()
    ):
        raise HTTPException(status_code=400, detail="Verification code is invalid or expired")

    user.email_verified = True
    user.email_verification_code = None
    user.email_verification_expires_at = None
    db.commit()
    db.refresh(user)
    return {
        "email": user.email,
        "email_verified": user.email_verified,
        "notify_new_transaction": user.notify_new_transaction,
    }


@app.patch("/auth/preferences", response_model=ProfileOut)
def update_preferences(body: NotificationPrefsBody, user: UserModel = Depends(current_user), db: Session = Depends(get_db)):
    user.notify_new_transaction = body.notify_new_transaction
    db.commit()
    db.refresh(user)
    return {
        "email": user.email,
        "email_verified": user.email_verified,
        "notify_new_transaction": user.notify_new_transaction,
    }


@app.post("/auth/forgot-password", response_model=ForgotPasswordOut)
def forgot_password(body: ForgotPasswordBody, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter_by(email=body.email).first()
    if not user:
        return {"message": "If the account exists, a reset code has been created."}

    reset_token = issue_password_reset(user, db)
    sent, send_error = send_email(
        subject="ExpenseTracker password reset code",
        to_email=user.email,
        body=(
            "Use this code to reset your password: "
            f"{reset_token.code}\n\n"
            f"This code expires at {reset_token.expires_at.isoformat()} UTC."
        ),
    )

    if sent:
        return {
            "message": "Reset code sent to your email. Use it below to set a new password.",
            "expires_at": reset_token.expires_at,
        }

    return {
        "message": f"Reset code created, but email delivery failed ({send_error or 'unknown error'}). Use the code below.",
        "reset_code": reset_token.code,
        "expires_at": reset_token.expires_at,
    }


@app.post("/auth/reset-password", response_model=LogoutOut)
def reset_password(body: ResetPasswordBody, db: Session = Depends(get_db)):
    if not password_valid(body.new_password):
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    reset_token = db.query(PasswordResetTokenModel).filter(
        PasswordResetTokenModel.email == body.email,
        PasswordResetTokenModel.code == body.code.strip().upper(),
        PasswordResetTokenModel.used_at.is_(None),
    ).first()
    if not reset_token or reset_token.expires_at <= datetime.utcnow():
        raise HTTPException(status_code=400, detail="Reset code is invalid or expired")

    user = db.query(UserModel).filter_by(id=reset_token.user_id, email=body.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password = pwd.hash(body.new_password)
    reset_token.used_at = datetime.utcnow()
    invalidate_user_sessions(user.id, db)
    db.commit()
    return {"ok": True}


@app.get("/auth/history", response_model=List[AuthHistoryOut])
def auth_history(_user: UserModel = Depends(current_user), db: Session = Depends(get_db)):
    sessions = db.query(AuthSessionModel).order_by(AuthSessionModel.created_at.desc()).limit(50).all()
    now = datetime.utcnow()
    return [
        {
            "email": session.email,
            "remember_me": session.remember_me,
            "user_agent": session.user_agent,
            "ip_address": session.ip_address,
            "created_at": session.created_at,
            "last_seen_at": session.last_seen_at,
            "logged_out_at": session.logged_out_at,
            "active": session.logged_out_at is None and session.expires_at > now,
        }
        for session in sessions
    ]


@app.get("/expenses", response_model=List[ExpenseOut])
def get_expenses(user: UserModel = Depends(current_user), db: Session = Depends(get_db)):
    return db.query(ExpenseModel).filter_by(user_id=user.id).order_by(ExpenseModel.date.desc()).all()


@app.post("/expenses", response_model=ExpenseOut)
def create_expense(body: ExpenseIn, user: UserModel = Depends(current_user), db: Session = Depends(get_db)):
    expense = ExpenseModel(**body.model_dump(), user_id=user.id)
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@app.put("/expenses/{eid}", response_model=ExpenseOut)
def update_expense(
    eid: str,
    body: ExpenseIn,
    user: UserModel = Depends(current_user),
    db: Session = Depends(get_db),
):
    expense = db.query(ExpenseModel).filter_by(id=eid, user_id=user.id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Not found")

    for key, value in body.model_dump().items():
        setattr(expense, key, value)
    db.commit()
    db.refresh(expense)
    return expense


@app.delete("/expenses/{eid}")
def delete_expense(eid: str, user: UserModel = Depends(current_user), db: Session = Depends(get_db)):
    expense = db.query(ExpenseModel).filter_by(id=eid, user_id=user.id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Not found")

    db.delete(expense)
    db.commit()
    return {"ok": True}


@app.post("/expenses/bulk", response_model=List[ExpenseOut])
def bulk_create(body: List[ExpenseIn], user: UserModel = Depends(current_user), db: Session = Depends(get_db)):
    rows = [ExpenseModel(**expense.model_dump(), user_id=user.id) for expense in body]
    db.add_all(rows)
    db.commit()
    for row in rows:
        db.refresh(row)
    return rows
