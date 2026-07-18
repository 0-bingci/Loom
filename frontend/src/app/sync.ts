import { createAsyncThunk } from "@reduxjs/toolkit";
import { flushQueue, loadSnapshot, saveSnapshot } from "../lib/outbox";
import { fetchDashboard, hydrate } from "./dashboardSlice";
import { fetchNotifications, hydrateNotifications } from "./notificationsSlice";
import type { RootState } from "./store";
import { setOffline, setQueued } from "./syncSlice";

/**
 * 同步一轮:先补发欠账,再拉真相。
 * 成功 → 存快照、清离线标记;失败(非 401)→ 标离线,首屏用快照垫底。
 */
export const syncNow = createAsyncThunk("sync/now", async (_: void, { dispatch, getState }) => {
  const remaining = await flushQueue();
  dispatch(setQueued(remaining));

  const dash = await dispatch(fetchDashboard());
  await dispatch(fetchNotifications());

  if (fetchDashboard.fulfilled.match(dash)) {
    dispatch(setOffline(false));
    const s = getState() as RootState;
    saveSnapshot({ date: s.dashboard.date, items: s.dashboard.items, notifs: s.notifications.items });
  } else if (dash.error.name !== "AuthError") {
    dispatch(setOffline(true));
    const snap = loadSnapshot();
    if (snap) {
      dispatch(hydrate({ date: snap.date, items: snap.items }));
      dispatch(hydrateNotifications(snap.notifs));
    }
  }
});
