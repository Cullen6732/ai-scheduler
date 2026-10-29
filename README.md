# AI Scheduler

평소 말투로 일정을 입력하면 AI가 날짜와 할 일을 알아서 정리하고, 당일 아침에 알려주고, 했는지 안 했는지까지 챙겨주는 개인 일정 관리 서비스입니다.

> 🚧 현재 개발 중입니다. 진행 상황은 아래 로드맵에서 확인할 수 있습니다.

## 만든 이유

해야 할 일을 알고 있어도 정해진 시간이 없으면 계속 미루게 되는 문제를 직접 겪었습니다. 반대로 PT나 운동처럼 날짜와 시간이 정해진 약속은 잘 지킨다는 걸 알게 되었고, 일상의 할 일도 약속처럼 관리해주는 도구를 직접 만들어 매일 사용하면서 개선해 나가고 있습니다.

## 주요 기능

- **자연어 일정 입력**: "다음 주 화요일 오후 3시 치과"처럼 입력하면 AI가 날짜, 시간, 할 일로 나누어 저장합니다.
- **아침 알림**: 매일 아침 그날의 일정을 알려줍니다.
- **완료 체크**: 일정이 끝나면 진행 여부를 기록합니다.
- **달성률 통계**: 주간 달성률을 확인할 수 있습니다.

## 기술 스택

| 구분 | 기술 |
|---|---|
| Backend | Python 3.13, FastAPI, SQLModel |
| Database | SQLite |
| Frontend | React (예정) |
| AI | LLM API (예정) |

## 프로젝트 구조

```
ai-scheduler/
├── backend/
│   ├── main.py            # FastAPI 앱, 일정 모델, DB 연결
│   ├── requirements.txt
│   └── .env.example       # 필요한 환경 변수 목록
└── frontend/              # React (예정)
```

## 실행 방법

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
uvicorn main:app --reload
```

서버 실행 후 http://127.0.0.1:8000/docs 에서 API를 확인할 수 있습니다.

## 환경 변수

API 키는 저장소에 올리지 않고 `backend/.env` 파일에서 관리합니다. `.env.example`을 복사해 실제 값을 입력하세요.

```bash
cp .env.example .env
```

## 로드맵

- [x] FastAPI 서버 기본 세팅
- [x] 일정(Schedule) 모델 설계 및 SQLite 연결
- [ ] 일정 추가 / 조회 / 수정 / 삭제 API
- [ ] React 일정 목록 및 입력 화면
- [ ] 자연어 입력을 AI로 해석해 일정으로 변환
- [ ] 매일 아침 일정 알림
- [ ] 완료 체크 및 주간 달성률 통계
- [ ] 배포

## 개발 기록

개발하면서 겪은 문제와 해결 과정을 기록합니다.

**패키지를 설치했는데 `ModuleNotFoundError`가 발생**
가상환경이 꺼진 터미널에서 `pip install`을 실행해 패키지가 다른 위치에 설치된 것이 원인이었습니다. 가상환경을 활성화한 뒤 `python -m pip install`로 설치해 현재 실행 중인 파이썬 환경에 확실히 설치되도록 해결했습니다.

**모델 필드 이름을 `date`, `time`으로 지으면 생기는 충돌**
파이썬의 `date`, `time` 타입과 필드 이름이 겹치면 타입을 인식하지 못하는 문제가 생길 수 있어, `scheduled_date`, `scheduled_time`으로 이름을 구분했습니다.
