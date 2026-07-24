import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector, type TypedUseSelectorHook } from "react-redux";
import dashboard from "./dashboardSlice";
import lists from "./listsSlice";
import notifications from "./notificationsSlice";
import sync from "./syncSlice";

export const store = configureStore({
  reducer: { dashboard, lists, notifications, sync },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
