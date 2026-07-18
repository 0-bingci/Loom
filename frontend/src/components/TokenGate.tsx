import { useState } from "react";
import { fetchDashboard } from "../app/dashboardSlice";
import { fetchNotifications } from "../app/notificationsSlice";
import { useAppDispatch } from "../app/store";
import { setToken } from "../lib/api";

export default function TokenGate() {
  const dispatch = useAppDispatch();
  const [value, setValue] = useState("");

  const submit = () => {
    setToken(value.trim());
    void dispatch(fetchDashboard());
    void dispatch(fetchNotifications());
  };

  return (
    <div className="flex items-center justify-center bg-bg xl:col-span-2">
      <div className="w-80 rounded-xl border border-line bg-surface p-6 text-center">
        <div className="font-wordmark text-xl">Loom</div>
        <p className="mt-2 mb-4 text-[13px] text-ink3">输入 API token(存在浏览器本地)</p>
        <input
          type="password"
          value={value}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="LOOM_API_TOKEN"
          className="w-full rounded-lg border border-line px-3 py-2 text-[13.5px] outline-none focus:border-accent"
        />
        <button onClick={submit} className="mt-3 w-full rounded-lg bg-accent py-2 text-[13.5px] text-white">
          进入
        </button>
      </div>
    </div>
  );
}
