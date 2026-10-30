from __future__ import annotations
from contextlib import asynccontextmanager
from datetime import date, time, datetime, timezone
from fastapi import FastAPI, Depends, HTTPException
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

class ScheduleUpdate(SQLModel):
    title: str | None = None
    scheduled_date: date | None = None
    scheduled_time: time | None = None
    is_done : bool | None = None

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

@app.patch("/schedules/{schedule_id}")
def update_schedule(schedule_id: int, data: ScheduleUpdate, session: Session = Depends(get_session)):
    schedule = session.get(Schedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="일정을 찾을 수 없습니다")
    update_data = data.model_dump(exclude_unset=True)
    schedule.sqlmodel_update(update_data)
    session.add(schedule)
    session.commit()
    session.refresh(schedule)
    return schedule

@app.delete("/schedules/{schedule_id}")
def delete_schedule(schedule_id: int, session: Session = Depends(get_session)):
    schedule = session.get(Schedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="일정을 찾을 수 없습니다")
    session.delete(schedule)
    session.commit()
    return {"ok":True}
