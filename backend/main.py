from __future__ import annotations
from contextlib import asynccontextmanager
from datetime import date, time, datetime, timezone, timedelta
from fastapi import FastAPI, Depends, HTTPException
from sqlmodel import SQLModel, Field, Session, create_engine, select
from fastapi.middleware.cors import CORSMiddleware
import json
from zoneinfo import ZoneInfo
import anthropic
from dotenv import load_dotenv

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

load_dotenv()
client = anthropic.Anthropic()
KST = ZoneInfo("Asia/seoul")

SYSTEM_PROMPT = """너는 일정 입력을 해석하는 도우미야. 사용자가 일정을 말하면 아래 형식의 JSON 하나만 출력해. 설명이나 코드 블록 표시는 절때 붙이지 .
{"title": "할 일", "scheduled_date": "YYYY-MM-DD", "schedule_time: "HH:MM" 또는 null}
- 날짜는 아래에 알려주는 오늘 날짜를 기준으로 계산해.
- 시간이 없으면 scheuled_time은 null로 해.
- 시간은 오후 2시면 14:00처럼 24시간 형식으로 써."""

class ParseRequest(SQLModel):
    text: str

class Suggestion(SQLModel):
    scheduled_date: date
    scheduled_time: time | None = None
    reason: str

SUGGEST_PROMPT = """
너는 미룬 일정을 다시 잡아주는 도우미야.
사용자가 완료하지 못한 일정과 앞으로 일주일의 일정 목록을 줄 거야.
겹치지 않고 현실적으로 할 수 있는 새 날짜와 시간을 하나 제안해.
아래의 형식의 JSON 하나만 출력해. 설명이나 코드 블록 표시는 절대 붙이지 마.
{"scheduled_date": "YYYY-MM-DD", "scheduled_time": "HH:MM" 또는 null, "reason": "이유"}
- 반드시 지금 시각 이후로만 제안해.
- 이미 있는 일정과 같은 시간은 피해.
- reason은 사용자에게 바로 보여줄 말투로, 왜 그 시간인지 한두 문장으로 써.
- 날짜와 시간은 scheduled_date와 scheduled_time에만 넣고, title에는 할 일 이름만 써. 예: "내일 오후 2시 PT"의 title은 "PT"."""

def call_ai_json(system_prompt:str, user_text:str) -> dict:
    message = client.messages.create(
        model="claude-haiku-5-5",
        max_tokens=1000,
        system=system_prompt,
        messages=[{"role": "user", "content": user_text}],
    )
    texts= [block.text for block in message.content if block.type == "text"]
    if not texts:
        raise HTTPException(status_code=502, detail="AI가 답을 주지 않았어요")
    raw = texts[0].strip()
    raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail=f"AI 응답을 해석하지 못했어요: {raw}")

def get_session():
    with Session(engine) as session:
        yield session

@asynccontextmanager
async def lifespan(app: FastAPI):
    SQLModel.metadata.create_all(engine)
    yield

app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.post("/schedules/parse")
def parse_schedule(req: ParseRequest):
    today = datetime.now(KST)
    weekday = "월화수목금토일"[today.weekday()]
    message = client.messages.create(
        model="claude-haiku-5-5",
        max_tokens=1000,
        system=SYSTEM_PROMPT + f"\n오늘은 {today:%Y-%m-%d} {weekday}요일이야.",
        messages=[{"role": "user", "content": req.text}],
    )
    texts = [block.text for block in message.content if block.type =="text"]
    if not texts:
        raise HTTPException(status_code=502, detail="AI가 답을 주지 않았습니다")
    raw = texts[0].strip()
    raw = raw.removeprefix("```json").removeprefix("```"). removesuffix("```").strip()
    try:
        return ScheduleCreate.model_validate(json.loads(raw))
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=422, detail=f"AI 응답을 해석하지 못했어:{raw}")

@app.get("/schedules/overdue")
def read_overdue(session: Session = Depends(get_session)):
    today = datetime.now(KST).date()
    statement = (
        select(Schedule)
        .where(Schedule.scheduled_date < today, Schedule.is_done == False) # noqa: E712
        .order_by(Schedule.scheduled_date)
    )
    return session.exec(statement).all()

@app.post("/schedules/{schedule_id}/suggest")
def suggest_reschedule(schedule_id: int, session: Session = Depends(get_session)):
    target = session.get(Schedule, schedule_id)
    if not target:
        raise HTTPException(status_code= 404, detail="일정을 찾을 수 없습니다")

    now = datetime.now(KST)
    today = now.date()
    statement = (
        select(Schedule)
        .where(
            Schedule.scheduled_date >= today,
            Schedule.scheduled_date <= today + timedelta(days=7),
            Schedule.id != schedule_id,
        )
        .order_by(Schedule.scheduled_date, Schedule.scheduled_time)
    )
    upcoming = session.exec(statement).all()

    def describe(s: Schedule) -> str:
        t = s.scheduled_time.strftime("%H:%M") if s.scheduled_time else "시간 없음"
        return f"- {s.scheduled_date} {t} {s.title}"

    lines = [describe(s) for s in upcoming] or ["- (일정 없음)"]
    weekday = "월화수목금토일"[today.weekday()]
    user_text = (
        f"지금은 {now:%Y-%m-%d %H:%M} {weekday}요일이야. \n"
        f"미룬 일정: {describe(target)[2:]}\n"
        f"앞으로 일주일 일정: \n" + "\n".join(lines)
    )

    data =call_ai_json(SUGGEST_PROMPT, user_text)
    try:
        suggestion = Suggestion.model_validate(data)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"AI 제안 형식이 올바르지 않습니다: {e}")

    if suggestion.scheduled_date < today or (
        suggestion.scheduled_date == today
        and suggestion.scheduled_time
        and suggestion.scheduled_time <= now.time()
    ):
        raise HTTPException(status_code=422, detail="AI가 지난 시간을 제안했어요. 다시 시도해주세")

    for s in upcoming:
        if (
            s.scheduled_date == suggestion.scheduled_date
            and s.scheduled_time
            and suggestion.scheduled_time
            and s.scheduled_time.replace(second=0, microsecond=0) == suggestion.scheduled_time
            ):
            raise HTTPException(statuscode=409, detail=f"AI 제안이 '{s.title}' 일정과 겹칩니다. 다시 시도해주세요")

    return suggestion