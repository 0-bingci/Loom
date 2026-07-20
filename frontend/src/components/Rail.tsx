import {
  IconBell,
  IconCalendar,
  IconCheckbox,
  IconNeedleThread,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconTimeline,
} from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";
import { syncNow } from "../app/sync";
import { useAppDispatch, useAppSelector } from "../app/store";

function RailButton({
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
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`relative flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-[9px] border-0 text-[19px] transition-colors ${
        active ? "bg-rail-hover text-white" : "bg-transparent text-[#8C887C] hover:bg-rail-hover hover:text-[#CFCABB]"
      }`}
    >
      {icon}
      {badge ? (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-over px-1 text-[10px] text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export default function Rail({ onBell }: { onBell: () => void }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const dispatch = useAppDispatch();
  const pending = useAppSelector((s) => s.notifications.items.length);

  const sync = () => void dispatch(syncNow());

  return (
    <nav aria-label="主导航" className="hidden flex-col items-center gap-1.5 bg-rail py-3.5 md:flex">
      <div className="mb-2.5 flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-accent text-lg text-white">
        <IconNeedleThread size={20} />
      </div>
      <RailButton icon={<IconCheckbox size={20} />} label="任务" active={pathname === "/today"} onClick={() => navigate("/today")} />
      <RailButton icon={<IconCalendar size={20} />} label="日历" active={pathname === "/calendar"} onClick={() => navigate("/calendar")} />
      <RailButton icon={<IconTimeline size={20} />} label="时间线" active={pathname === "/timeline"} onClick={() => navigate("/timeline")} />
      <RailButton icon={<IconSearch size={20} />} label="搜索" />
      <div className="flex-1" />
      <RailButton icon={<IconSettings size={20} />} label="设置" active={pathname === "/settings"} onClick={() => navigate("/settings")} />
      <RailButton icon={<IconRefresh size={20} />} label="同步(补发离线改动并拉取最新)" onClick={sync} />
      <RailButton icon={<IconBell size={20} />} label="提醒" badge={pending} onClick={onBell} />
    </nav>
  );
}
