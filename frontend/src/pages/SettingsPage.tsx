import { setSetting, useSettings } from "../lib/settings";

/** 设置项外框:标题 + 说明 + 右侧控件 */
function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 border-t border-line py-4">
      <div className="min-w-0 flex-1">
        <div className="text-[14px] text-ink">{title}</div>
        {hint && <div className="mt-0.5 text-[12.5px] text-ink3">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { ddlLeadDays } = useSettings();

  return (
    <main className="flex flex-col overflow-y-auto bg-bg">
      <div className="px-4 pt-5 pb-1.5 md:px-7">
        <h1 className="text-xl font-medium">设置</h1>
        <p className="mt-1 text-[13px] text-ink3">存在这台浏览器里,只影响你自己的显示。</p>
      </div>

      <div className="mx-4 mt-4 max-w-[560px] md:mx-7">
        <div className="px-1 pb-1 text-[11px] tracking-[0.5px] text-ink3">今天视图</div>
        <Row
          title="临近死线提前量"
          hint="死线前多少天,把还没排期的任务浮到「今天」下方提醒你。默认 14 天。"
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={365}
              value={ddlLeadDays}
              onChange={(e) => {
                const n = Math.max(0, Math.min(365, Math.round(Number(e.target.value) || 0)));
                setSetting("ddlLeadDays", n);
              }}
              className="w-20 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[14px] text-ink outline-none focus:border-accent"
            />
            <span className="text-[13px] text-ink3">天</span>
          </div>
        </Row>
      </div>
    </main>
  );
}
