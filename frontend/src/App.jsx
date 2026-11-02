import { useEffect, useState } from "react";

const API_URL = "http://127.0.0.1:8000";

function formatTime(time) {
  return time ? time.slice(0, 5) : "";
}

function App() {
  const [schedules, setSchedules] = useState([]);
  const [error, setError] = useState(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

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
    setDate("");
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

      <form onSubmit={handleSubmit}>
        <input
          placeholder="할 일"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <input type="time" onChange={(e) => setTime(e.target.value)} />
        <button type="submit">추가</button>
      </form>

      {error && <p>{error}</p>}

      <ul>
        {schedules.map((s) => (
          <li key={s.id}>
            <imput
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
