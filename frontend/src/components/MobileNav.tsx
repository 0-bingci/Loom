import {
  IconBell,
  IconCalendar,
  IconCalendarWeek,
  IconCheckbox,
  IconInbox,
} from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppSelector } from "../app/store";

function Tab({
  icon,
  label,
  active,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
        active ? "text-accent" : "text-ink2"
      }`}
    >
      {icon}
      {label}
      {badge ? (
        <span className="absolute top-1 right-[calc(50%-18px)] flex h-4 min-w-4 items-center justify-center rounded-full bg-over px-1 text-[10px] text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

/** 手机端底部导航(md 以上隐藏,由左侧 rail 接管;同步是自动的,"所有"表格适合大屏) */
export default function MobileNav({ onBell }: { onBell: () => void }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const pending = useAppSelector((s) => s.notifications.items.length);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-surface md:hidden">
      <Tab icon={<IconCheckbox size={20} />} label="今天" active={pathname === "/today"} onClick={() => navigate("/today")} />
      <Tab icon={<IconCalendarWeek size={20} />} label="7 天" active={pathname === "/week"} onClick={() => navigate("/week")} />
      <Tab icon={<IconInbox size={20} />} label="收集箱" active={pathname === "/inbox"} onClick={() => navigate("/inbox")} />
      <Tab icon={<IconCalendar size={20} />} label="日历" active={pathname === "/calendar"} onClick={() => navigate("/calendar")} />
      <Tab icon={<IconBell size={20} />} label="提醒" badge={pending} onClick={onBell} />
    </nav>
  );
}
