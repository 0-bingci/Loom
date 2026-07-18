export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center bg-bg xl:col-span-2">
      <div className="text-center">
        <div className="font-wordmark text-2xl text-ink3">{title}</div>
        <div className="mt-2 text-[13px] text-ink3">规划中 —— 骨架已留好,等它长出来</div>
      </div>
    </div>
  );
}
