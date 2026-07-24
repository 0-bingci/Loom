import { IconCalendarWeek, IconInbox, IconSun, IconTable } from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppSelector } from "../app/store";

function NavItem({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number | string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`relative flex items-center gap-2.5 rounded-lg px-[9px] py-[7px] transition-colors ${
        active
          ? "bg-sidebar-hover font-medium before:absolute before:-left-2.5 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r-[3px] before:bg-accent"
          : "cursor-pointer hover:bg-sidebar-hover"
      }`}
    >
      <span className="w-[18px] text-center text-[17px] text-ink2">{icon}</span>
      <span className="flex-1">{label}</span>
      {count !== undefined && <span className="text-xs text-ink3">{count}</span>}
    </div>
  );
}

export default function Sidebar() {
  const items = useAppSelector((s) => s.dashboard.items);
  const loaded = useAppSelector((s) => s.dashboard.loaded);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <aside className="hidden overflow-y-auto border-r border-line bg-sidebar px-2.5 py-4 xl:block">
      <div className="flex items-baseline gap-2 px-2 pb-4 font-wordmark text-[22px] font-medium tracking-[0.5px]">
        Loom <small className="text-[11px] tracking-normal text-ink3">把一天织成一处</small>
      </div>

      <NavItem
        icon={<IconSun size={17} />}
        label="今天"
        count={loaded ? items.length : "…"}
        active={pathname === "/today"}
        onClick={() => navigate("/today")}
      />
      <NavItem
        icon={<IconCalendarWeek size={17} />}
        label="最近 7 天"
        active={pathname === "/week"}
        onClick={() => navigate("/week")}
      />
      <NavItem
        icon={<IconInbox size={17} />}
        label="收集箱"
        active={pathname === "/inbox"}
        onClick={() => navigate("/inbox")}
      />
      <NavItem
        icon={<IconTable size={17} />}
        label="所有"
        active={pathname === "/all"}
        onClick={() => navigate("/all")}
      />
    </aside>
  );
}
