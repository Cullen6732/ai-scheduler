from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import date, time, datetime, timezone
from fastapi import FastAPI, Depends
from sqlmodel import SQLModel, Field, Session, create_engine, select

class Schedule(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    title: str
    scheduled_date: date
    scheduled_time: time  | None = None
    is_done: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ScheduleCreate(SQLModel):
    title: str
    scheduled_date: date
    scheduled_time: time | None = None

engine = create_engine("sqlite:///schedules.db")

def get_session():
    with Session(engine) as session:
        yield session

@asynccontextmanager
async def lifespan(app: FastAPI):
    SQLModel.metadata.create_all(engine)
    yield

app = FastAPI(lifespan=lifespan)

@app.get("/")
def read_root():
    return {"message": "hello"}

@app.post("/schedules")
def create_schedule(data: ScheduleCreate, session: Session = Depends(get_session)):
    schedule = Schedule.model_validate(data)
    session.add(schedule)
    session.commit()
    session.refresh(schedule)
    return schedule

@app.get("/schedules")
def read_schedules(session: Session = Depends(get_session)):
    statement = select(Schedule).order_by(Schedule.scheduled_date)
    return session.exec(statement).all()