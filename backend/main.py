from datetime import datetime, timedelta
from typing import List
import os
import uuid

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import Column, DateTime, Float, String, create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./expenses.db")
SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production-use-long-random-string")
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 30


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


Base.metadata.create_all(bind=engine)


# Prefer pbkdf2 for new hashes so signup doesn't depend on bcrypt's native wheel.
# Existing bcrypt hashes still verify because the scheme stays in the context.
pwd = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")
bearer = HTTPBearer()


def make_token(email: str) -> str:
    exp = datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": email, "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
):
    try:
        payload = jwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc

    user = db.query(UserModel).filter_by(email=email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


class AuthBody(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    email: str


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


@app.post("/auth/register", response_model=TokenOut)
def register(body: AuthBody, db: Session = Depends(get_db)):
    if db.query(UserModel).filter_by(email=body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = UserModel(email=body.email, password=pwd.hash(body.password))
    db.add(user)
    db.commit()
    return {"access_token": make_token(body.email), "email": body.email}


@app.post("/auth/login", response_model=TokenOut)
def login(body: AuthBody, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter_by(email=body.email).first()
    if not user or not pwd.verify(body.password, user.password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return {"access_token": make_token(body.email), "email": body.email}


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
