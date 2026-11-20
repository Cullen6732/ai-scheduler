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

  useEffect(() => {
    loadSchedules();
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
      setAIfilled(true);
      setNltext("");
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

  async function deleteSchedule(id) {
    if (!window.confirm("이 일정을 삭제할까요?")) return;
    await fetch(`${API_URL}/schedules/${id}`, { method: "DELETE" });
    loadSchedules();
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
          {parsing ? "해석 중..." : "AI로 추가"}
        </button>
      </form>

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
