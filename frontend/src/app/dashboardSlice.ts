import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { api, ulid } from "../lib/api";
import { sendOrQueue } from "../lib/outbox";
import type { DashboardItem, DashboardResponse } from "../types";
import { setOffline, setQueued } from "./syncSlice";
import { queueLength } from "../lib/outbox";

export type AuthStatus = "unknown" | "ok" | "unauthorized";

interface DashboardState {
  date: string;
  items: DashboardItem[];
  selectedId: string | null;
  loaded: boolean;
  auth: AuthStatus;
}

const initialState: DashboardState = {
  date: "",
  items: [],
  selectedId: null,
  loaded: false,
  auth: "unknown",
};

export const fetchDashboard = createAsyncThunk("dashboard/fetch", () =>
  api<DashboardResponse>("/dashboard"),
);

/** 勾选/取消完成:离线时入队并保留乐观状态。date 用于非今天的循环打卡(日历/最近7天)。 */
export const toggleDone = createAsyncThunk(
  "dashboard/toggleDone",
  async ({ id, done, date }: { id: string; done: boolean; date?: string }, { dispatch }) => {
    const body = date === undefined ? { done } : { done, date };
    const r = await sendOrQueue({ method: "POST", path: `/tasks/${id}/done`, body });
    if (r === "queued") {
      dispatch(setOffline(true));
      dispatch(setQueued(queueLength()));
    }
    return { id, queued: r === "queued" };
  },
);

/** 排期:设/清 plan_date(把任务安排到某天做,或放回待安排)。离线入队,成功后刷新重新分带。 */
export const setPlanDate = createAsyncThunk(
  "dashboard/setPlanDate",
  async ({ id, plan_date }: { id: string; plan_date: string | null }, { dispatch }) => {
    const r = await sendOrQueue({ method: "PATCH", path: `/tasks/${id}`, body: { plan_date } });
    if (r === "queued") {
      dispatch(setOffline(true));
      dispatch(setQueued(queueLength()));
    }
    return { queued: r === "queued" };
  },
);

export interface NewTask {
  title: string;
  kind: "once" | "daily" | "weekly";
  remind_time: string | null;
  due_date: string; // once 用(今天)
  weekdays?: string[]; // weekly 用,如 ["MON","WED"]
  start_date?: string | null; // daily/weekly 的生效区间
  end_date?: string | null;
}

/** 添加任务:带客户端 ULID(服务端幂等),离线时入队 + 本地立刻出现 */
export const addTask = createAsyncThunk(
  "dashboard/addTask",
  async (input: NewTask, { dispatch }) => {
    const base = { id: ulid(), title: input.title, remind_time: input.remind_time };
    const body =
      input.kind === "once"
        ? { ...base, due_date: input.due_date }
        : {
            ...base,
            recurrence: input.kind === "daily" ? "daily" : `weekly:${input.weekdays!.join(",")}`,
            start_date: input.start_date ?? null,
            end_date: input.end_date ?? null,
          };
    const r = await sendOrQueue({ method: "POST", path: "/tasks", body });
    if (r === "queued") {
      dispatch(setOffline(true));
      dispatch(setQueued(queueLength()));
    }
    return { body, kind: input.kind, queued: r === "queued" };
  },
);

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState,
  reducers: {
    selectTask(state, action: PayloadAction<string | null>) {
      state.selectedId = action.payload;
    },
    /** 拖拽排序:就地更新 sort_order 并重排(与后端同一套比较规则) */
    applySortOrders(state, action: PayloadAction<{ id: string; sort_order: number }[]>) {
      for (const p of action.payload) {
        const it = state.items.find((i) => i.task.id === p.id);
        if (it) it.task.sort_order = p.sort_order;
      }
      const band = (x: DashboardItem) => (x.overdue ? 0 : x.due_today ? 1 : x.upcoming ? 3 : 2);
      const ord = (x: DashboardItem) => x.task.sort_order ?? Infinity;
      state.items.sort(
        (a, b) =>
          band(a) - band(b) ||
          (a.upcoming ? (a.days_left ?? 0) - (b.days_left ?? 0) : 0) ||
          ord(a) - ord(b) ||
          (a.task.created_at < b.task.created_at ? -1 : 1),
      );
    },
    /** 离线启动时用快照垫底 */
    hydrate(state, action: PayloadAction<{ date: string; items: DashboardItem[] }>) {
      if (state.loaded) return;
      state.date = action.payload.date;
      state.items = action.payload.items;
      state.loaded = true;
      state.auth = "ok";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboard.fulfilled, (state, { payload }) => {
        state.date = payload.date;
        state.items = payload.items;
        state.loaded = true;
        state.auth = "ok";
        if (state.selectedId && !payload.items.some((i) => i.task.id === state.selectedId)) {
          state.selectedId = null;
        }
      })
      .addCase(fetchDashboard.rejected, (state, { error }) => {
        if (error.name === "AuthError") state.auth = "unauthorized";
      })
      // 乐观更新:点勾立刻变;联网成功由下一次 fetch 校准,离线则挂"待同步"。
      // 只有改的是"这一天"的状态才动 dashboard(在日历里勾未来的循环任务不影响今天)。
      .addCase(toggleDone.pending, (state, { meta }) => {
        const it = state.items.find((i) => i.task.id === meta.arg.id);
        if (it && (meta.arg.date === undefined || meta.arg.date === it.date)) {
          it.done = meta.arg.done;
          // 非循环任务:status 与勾选同步(服务端同样如此,这里让界面立刻一致)
          if (it.kind === "once") it.task.status = meta.arg.done ? "done" : "todo";
        }
      })
      .addCase(toggleDone.fulfilled, (state, { payload }) => {
        if (!payload.queued) return;
        const it = state.items.find((i) => i.task.id === payload.id);
        if (it) it.pendingSync = true;
      })
      // 离线新建:本地直接长出这一条
      .addCase(addTask.fulfilled, (state, { payload }) => {
        if (!payload.queued) return;
        const b = payload.body;
        state.items.push({
          task: {
            id: b.id,
            title: b.title,
            due_date: "due_date" in b ? (b.due_date ?? null) : null,
            plan_date: null,
            recurrence: "recurrence" in b ? (b.recurrence ?? null) : null,
            start_date: "start_date" in b ? (b.start_date ?? null) : null,
            end_date: "end_date" in b ? (b.end_date ?? null) : null,
            remind_time: b.remind_time,
            note: null,
            sort_order: null,
            status: "todo",
            archived: false,
            created_at: new Date().toISOString(),
          },
          date: state.date,
          kind: payload.kind === "once" ? "once" : "recurring",
          overdue: false,
          due_today: false,
          upcoming: false,
          days_left: null,
          done: false,
          done_at: null,
          day_note: null,
          pendingSync: true,
        });
      });
  },
});

export const { selectTask, hydrate, applySortOrders } = dashboardSlice.actions;
export default dashboardSlice.reducer;
