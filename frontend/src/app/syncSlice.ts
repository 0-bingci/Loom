import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { queueLength } from "../lib/outbox";

interface SyncState {
  offline: boolean;
  queued: number; // 待补发的操作数
}

const initialState: SyncState = { offline: false, queued: queueLength() };

const syncSlice = createSlice({
  name: "sync",
  initialState,
  reducers: {
    setOffline(state, action: PayloadAction<boolean>) {
      state.offline = action.payload;
    },
    setQueued(state, action: PayloadAction<number>) {
      state.queued = action.payload;
    },
  },
});

export const { setOffline, setQueued } = syncSlice.actions;
export default syncSlice.reducer;
