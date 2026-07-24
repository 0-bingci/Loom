import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { api, ulid } from "../lib/api";
import { queueLength, sendOrQueue } from "../lib/outbox";
import type { ListWithCount } from "../types";
import { setOffline, setQueued } from "./syncSlice";

// 清单目录:侧边栏和各处选择器共享的那份"有哪些清单"。
// 每轮 syncNow 刷新;写操作乐观更新 + 走发件箱,离线也能改。

interface ListsState {
  items: ListWithCount[];
  loaded: boolean;
}

const initialState: ListsState = { items: [], loaded: false };

export const fetchLists = createAsyncThunk("lists/fetch", () => api<ListWithCount[]>("/lists"));

/** 新建清单:带客户端 ULID(服务端幂等),离线时入队 + 本地立刻出现。 */
export const addList = createAsyncThunk(
  "lists/add",
  async (name: string, { dispatch }) => {
    const id = ulid();
    const r = await sendOrQueue({ method: "POST", path: "/lists", body: { id, name } });
    if (r === "queued") {
      dispatch(setOffline(true));
      dispatch(setQueued(queueLength()));
    }
    return { id, name };
  },
);

/** 改名。 */
export const renameList = createAsyncThunk(
  "lists/rename",
  async ({ id, name }: { id: string; name: string }, { dispatch }) => {
    const r = await sendOrQueue({ method: "PATCH", path: `/lists/${id}`, body: { name } });
    if (r === "queued") {
      dispatch(setOffline(true));
      dispatch(setQueued(queueLength()));
    }
    return { id, name };
  },
);

/** 删清单:其下任务不删,后端把它们的 list_id 置空(回到未分类)。 */
export const removeList = createAsyncThunk(
  "lists/remove",
  async (id: string, { dispatch }) => {
    const r = await sendOrQueue({ method: "DELETE", path: `/lists/${id}` });
    if (r === "queued") {
      dispatch(setOffline(true));
      dispatch(setQueued(queueLength()));
    }
    return { id };
  },
);

const listsSlice = createSlice({
  name: "lists",
  initialState,
  reducers: {
    hydrateLists(state, action: PayloadAction<ListWithCount[]>) {
      if (state.loaded) return;
      state.items = action.payload;
      state.loaded = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLists.fulfilled, (state, { payload }) => {
        state.items = payload;
        state.loaded = true;
      })
      // 乐观更新:联网时下一轮 fetch 会用真相(含计数)覆盖。
      .addCase(addList.fulfilled, (state, { payload }) => {
        if (!state.items.some((l) => l.id === payload.id)) {
          state.items.push({
            id: payload.id,
            name: payload.name,
            color: null,
            sort_order: null,
            archived: false,
            created_at: new Date().toISOString(),
            task_count: 0,
          });
        }
      })
      .addCase(renameList.fulfilled, (state, { payload }) => {
        const l = state.items.find((x) => x.id === payload.id);
        if (l) l.name = payload.name;
      })
      .addCase(removeList.fulfilled, (state, { payload }) => {
        state.items = state.items.filter((l) => l.id !== payload.id);
      });
  },
});

export const { hydrateLists } = listsSlice.actions;
export default listsSlice.reducer;
