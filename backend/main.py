from contextlib import asynccontextmanager
from datetime import date, time, datetime

from fastapi import FastAPI
from sqlmodel import SQLModel, Field, create_engine

class Schedule(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    title: str
    scheduled_date: date
    scheduled_time: time  | None = None
    is_done: bool = False
    created_at: datetime = Field(default_factory=datetime.now)

engine = create_engine("sqlite:///schedules.db")

@asynccontextmanager
async def lifespan(app: FastAPI):
    SQLModel.metadata.create_all(engine)
    yield

app = FastAPI(lifespan=lifespan)

@app.get("/")
def read_root():
    return {"message": "hello"}

