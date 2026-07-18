import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { api } from "../lib/api";
import { queueLength, sendOrQueue } from "../lib/outbox";
import type { Notification } from "../types";
import { setOffline, setQueued } from "./syncSlice";

interface NotificationsState {
  items: Notification[];
  loaded: boolean;
}

const initialState: NotificationsState = { items: [], loaded: false };

export const fetchNotifications = createAsyncThunk("notifications/fetch", () =>
  api<Notification[]>("/notifications?status=pending"),
);

/** 标读:离线时入队,乐观移除保持不变 */
export const markRead = createAsyncThunk(
  "notifications/markRead",
  async (id: string, { dispatch }) => {
    const r = await sendOrQueue({ method: "POST", path: `/notifications/${id}/read`, body: {} });
    if (r === "queued") {
      dispatch(setOffline(true));
      dispatch(setQueued(queueLength()));
    }
    return id;
  },
);

const notificationsSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    hydrate(state, action: PayloadAction<Notification[]>) {
      if (state.loaded) return;
      state.items = action.payload;
      state.loaded = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.fulfilled, (state, { payload }) => {
        state.items = payload;
        state.loaded = true;
      })
      // 乐观移除
      .addCase(markRead.pending, (state, { meta }) => {
        state.items = state.items.filter((n) => n.id !== meta.arg);
      });
  },
});

export const { hydrate: hydrateNotifications } = notificationsSlice.actions;
export default notificationsSlice.reducer;
