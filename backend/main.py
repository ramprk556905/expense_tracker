from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import create_engine, Column, String, Float, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
from typing import List
from passlib.context import CryptContext
from jose import JWTError, jwt
import uuid, os

# ── Config ────────────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./expenses.db")
SECRET_KEY   = os.getenv("SECRET_KEY", "change-me-in-production-use-long-random-string")
ALGORITHM    = "HS256"
TOKEN_EXPIRE_DAYS = 30

# ── Database ──────────────────────────────────────────────────
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()

class UserModel(Base):
    __tablename__ = "users"
    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email      = Column(String, unique=True, index=True, nullable=False)
    password   = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class ExpenseModel(Base):
    __tablename__ = "expenses"
    id          = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id     = Column(String, nullable=False, index=True)
    description = Column(String, nullable=False)
    amount      = Column(Float, nullable=False)
    category    = Column(String, nullable=False)
    date        = Column(String, nullable=False)
    type        = Column(String, nullable=False)
    created_at  = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

# ── Auth helpers ──────────────────────────────────────────────
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
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

def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(UserModel).filter_by(email=email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# ── Schemas ───────────────────────────────────────────────────
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

# ── App ───────────────────────────────────────────────────────
app = FastAPI(title="Expense Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health():
    return {"status": "ok"}

# Auth
@app.post("/auth/register", response_model=TokenOut)
def register(body: AuthBody, db: Session = Depends(get_db)):
    if db.query(UserModel).filter_by(email=body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = UserModel(email=body.email, password=pwd.hash(body.password))
    db.add(user); db.commit()
    return {"access_token": make_token(body.email), "email": body.email}

@app.post("/auth/login", response_model=TokenOut)
def login(body: AuthBody, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter_by(email=body.email).first()
    if not user or not pwd.verify(body.password, user.password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return {"access_token": make_token(body.email), "email": body.email}

# Expenses
@app.get("/expenses", response_model=List[ExpenseOut])
def get_expenses(user: UserModel = Depends(current_user), db: Session = Depends(get_db)):
    return db.query(ExpenseModel).filter_by(user_id=user.id).order_by(ExpenseModel.date.desc()).all()

@app.post("/expenses", response_model=ExpenseOut)
def create_expense(body: ExpenseIn, user: UserModel = Depends(current_user), db: Session = Depends(get_db)):
    e = ExpenseModel(**body.model_dump(), user_id=user.id)
    db.add(e); db.commit(); db.refresh(e)
    return e

@app.put("/expenses/{eid}", response_model=ExpenseOut)
def update_expense(eid: str, body: ExpenseIn, user: UserModel = Depends(current_user), db: Session = Depends(get_db)):
    e = db.query(ExpenseModel).filter_by(id=eid, user_id=user.id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in body.model_dump().items():
        setattr(e, k, v)
    db.commit(); db.refresh(e)
    return e

@app.delete("/expenses/{eid}")
def delete_expense(eid: str, user: UserModel = Depends(current_user), db: Session = Depends(get_db)):
    e = db.query(ExpenseModel).filter_by(id=eid, user_id=user.id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(e); db.commit()
    return {"ok": True}

@app.post("/expenses/bulk", response_model=List[ExpenseOut])
def bulk_create(body: List[ExpenseIn], user: UserModel = Depends(current_user), db: Session = Depends(get_db)):
    rows = [ExpenseModel(**e.model_dump(), user_id=user.id) for e in body]
    db.add_all(rows); db.commit()
    for r in rows:
        db.refresh(r)
    return rows
