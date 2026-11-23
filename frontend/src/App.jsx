import { useEffect, useState, useRef } from "react";

const API_URL = "http://127.0.0.1:8000";

function formatTime(time) {
  return time ? time.slice(0, 5) : "";
}

function getToday() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function App() {
  const [schedules, setSchedules] = useState([]);
  const [error, setError] = useState(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(getToday());
  const [time, setTime] = useState("");
  const [nlText, setNlText] = useState("");
  const [preview, setPreview] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [aiFilled, setAiFilled] = useState(false);
  const timeRef = useRef(null);
  const [overdue, setOverdue] = useState([]);
  const [suggestions, setSuggestions] = useState({});
  const [suggestingId, setSuggestingId] = useState(null);

  async function loadSchedules() {
    try {
      const res = await fetch(`${API_URL}/schedules`);
      if (!res.ok) throw new Error("일정을 불러오지 못했어요");
      setSchedules(await res.json());
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadOverdue() {
    const res = await fetch(`${API_URL}/schedules/overdue`);
    const data = await res.json();
    setOverdue(data);
  }

  async function getSuggestion(id) {
    setSuggestingId(id);
    try {
      const res = await fetch(`${API_URL}/schedules/${id}/suggest`, {
        method: "POST",
      });
      const data = await res.json();
      console.log("제안 응답", data);
      if (!res.ok) {
        const message =
          typeof data.detail === "string"
            ? data.detail
            : "제안을 받지 못했어요";
        setSuggestions((prev) => ({ ...prev, [id]: { error: message } }));
        return;
      }
      setSuggestions((prev) => ({ ...prev, [id]: data }));
    } catch (e) {
      setSuggestions((prev) => ({
        ...prev,
        [id]: { error: "서버에 연결하지 못했어요" },
      }));
    } finally {
      setSuggestingId(null);
    }
  }

  async function acceptSuggestion(id) {
    const suggestion = suggestions[id];
    const res = await fetch(`${API_URL}/schedules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduled_date: suggestion.scheduled_date,
        scheduled_time: suggestion.scheduled_time,
      }),
    });
    if (!res.ok) {
      setError("일정을 옮기지 못했어요");
      return;
    }
    setSuggestions((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    loadSchedules();
    loadOverdue();
  }

  useEffect(() => {
    loadSchedules();
    loadOverdue();
  }, []);

  async function handleParse(e) {
    e.preventDefault();
    if (!nlText) return;
    setParsing(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/schedules/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: nlText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "해석하지 못했어요");
      const parsedTime = formatTime(data.scheduled_time);
      setTitle(data.title);
      setDate(data.scheduled_date);
      setTime(parsedTime);
      if (timeRef.current) timeRef.current.value = parsedTime;
      setAiFilled(true);
      setNlText("");
    } catch (err) {
      setError(err.message);
    } finally {
      setParsing(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title || !date) return;

    const res = await fetch(`${API_URL}/schedules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        scheduled_date: date,
        scheduled_time: time || null,
      }),
    });
    if (!res.ok) {
      setError("일정을 추가하지 못했어요");
      return;
    }
    e.target.reset();
    setTitle("");
    setDate(getToday());
    setAiFilled(false);
    setTime("");
    loadSchedules();
  }

  async function toggleDone(s) {
    const res = await fetch(`${API_URL}/schedules/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_done: !s.is_done }),
    });
    if (!res.ok) {
      setError("상태를 바꾸지 못했어요");
      return;
    }
    loadSchedules();
    loadOverdue();
  }

  async function deleteSchedule(id) {
    if (!window.confirm("이 일정을 삭제할까요?")) return;
    await fetch(`${API_URL}/schedules/${id}`, { method: "DELETE" });
    loadSchedules();
    loadOverdue();
  }

  return (
    <main>
      <h1>AI 스케줄러</h1>
      <form onSubmit={handleParse}>
        <input
          placeholder="예: 내일 오후 2시 PT"
          value={nlText}
          onChange={(e) => setNlText(e.target.value)}
        />
        <button type="submit" disabled={parsing}>
          {parsing ? "해석 중..." : "AI로 채우기"}
        </button>
      </form>

      {aiFilled && (
        <p>
          AI가 아래 칸을 채웠어요. 확인하고 틀린 부분은 고친 뒤 추가를
          눌러주세요.
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <input
          placeholder="할 일 이름만(예: PT)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <input
          type="time"
          ref={timeRef}
          onChange={(e) => setTime(e.target.value)}
        />
        <button type="submit">추가</button>
      </form>

      {overdue.length > 0 && (
        <section>
          <h2>미룬 일정 {overdue.length}개</h2>
          <ul>
            {overdue.map((s) => (
              <li key={s.id}>
                {s.title} ({s.scheduled_date} {formatTime(s.scheduled_time)})
                <button
                  onClick={() => getSuggestion(s.id)}
                  disabled={suggestingId === s.id}
                >
                  {suggestingId === s.id ? "생각 중..." : "제안 받기"}
                </button>
                {suggestions[s.id]?.error && <p>{suggestions[s.id].error}</p>}
                {suggestions[s.id]?.scheduled_date && (
                  <p>
                    제안: {suggestions[s.id].scheduled_date}{" "}
                    {formatTime(suggestions[s.id].scheduled_time)} ·{" "}
                    {suggestions[s.id].reason}
                    <button onClick={() => acceptSuggestion(s.id)}>수락</button>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && <p>{error}</p>}

      <ul>
        {schedules.map((s) => (
          <li key={s.id}>
            <input
              type="checkbox"
              checked={s.is_done}
              onChange={() => toggleDone(s)}
            />
            {s.scheduled_date} {formatTime(s.scheduled_time)} {s.title}
            <button onClick={() => deleteSchedule(s.id)}>삭제</button>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default App;
