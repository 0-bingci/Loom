import { useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { syncNow } from "./app/sync";
import { useAppDispatch, useAppSelector } from "./app/store";
import MobileNav from "./components/MobileNav";
import NotifPanel from "./components/NotifPanel";
import Rail from "./components/Rail";
import Sidebar from "./components/Sidebar";
import TokenGate from "./components/TokenGate";
import AllTasksPage from "./pages/AllTasksPage";
import CalendarPage from "./pages/CalendarPage";
import InboxPage from "./pages/InboxPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import SettingsPage from "./pages/SettingsPage";
import TodayPage from "./pages/TodayPage";
import WeekPage from "./pages/WeekPage";

function OfflineBanner() {
  const { offline, queued } = useAppSelector((s) => s.sync);
  if (!offline) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-40 bg-[#fff3cd] py-1.5 text-center text-xs text-[#7a5d00]">
      ⚠ 离线中 — 改动已保存在本地,恢复后自动同步{queued > 0 && `(${queued} 条待同步)`}
    </div>
  );
}

function Shell() {
  const dispatch = useAppDispatch();
  const auth = useAppSelector((s) => s.dashboard.auth);
  const [bellOpen, setBellOpen] = useState(false);
  const { pathname } = useLocation();
  // 侧边栏是"任务"区的导航,日历/时间线页不需要它
  const showSidebar = ["/today", "/week", "/all", "/inbox"].includes(pathname);

  useEffect(() => {
    void dispatch(syncNow());
    const timer = setInterval(() => void dispatch(syncNow()), 30_000); // 拉取模型:定时来问
    const onOnline = () => void dispatch(syncNow()); // 网络一恢复立刻补发
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", onOnline);
    };
  }, [dispatch]);

  return (
    <div
      className={`grid h-screen grid-cols-1 overflow-hidden md:grid-cols-[56px_1fr] ${
        showSidebar ? "xl:grid-cols-[56px_246px_1fr_336px]" : "xl:grid-cols-[56px_1fr_336px]"
      }`}
    >
      <OfflineBanner />
      <Rail onBell={() => setBellOpen((v) => !v)} />
      {showSidebar && <Sidebar />}
      {auth === "unauthorized" ? <TokenGate /> : <Outlet />}
      {bellOpen && <NotifPanel onClose={() => setBellOpen(false)} />}
      <MobileNav onBell={() => setBellOpen((v) => !v)} />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Navigate to="/today" replace />} />
        <Route path="/today" element={<TodayPage />} />
        <Route path="/week" element={<WeekPage />} />
        <Route path="/all" element={<AllTasksPage />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/timeline" element={<PlaceholderPage title="时间线" />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Route>
    </Routes>
  );
}
