import { useEffect, useState } from "react";

const API_URL = "http://127.0.0.1:8000";

function formatTime(time) {
  return time ? time.slice(0, 5) : "";
}

function App() {
  const [schedules, setSchedules] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/schedules`)
      .then((res) => {
        if (!res.ok) throw new Error("일정을 불러오지 못했어요");
        return res.json();
      })
      .then(setSchedules)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <main>
      <h1>AI 스케줄러</h1>
      {error && <p>{error}</p>}
      <ul>
        {schedules.map((s) => (
          <li key={s.id}>
            {s.scheduled_date} {formatTime(s.scheduled_time ?? "")} {s.title}{" "}
            {s.is_done ? "✅" : ""}
          </li>
        ))}
      </ul>
    </main>
  );
}

export default App;
