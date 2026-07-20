// 浏览器本地设置(存 localStorage,跨会话持久)。纯客户端,不经后端。
import { useSyncExternalStore } from "react";

export interface Settings {
  /** 临近死线:死线前多少天开始浮在日视图下方 */
  ddlLeadDays: number;
}

const KEY = "loom_settings";
const DEFAULTS: Settings = { ddlLeadDays: 14 };

function read(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULTS;
  }
}

let cache = read();
const subs = new Set<() => void>();

export function getSettings(): Settings {
  return cache;
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  cache = { ...cache, [key]: value };
  localStorage.setItem(KEY, JSON.stringify(cache));
  subs.forEach((f) => f());
}

/** 订阅式读取:设置一改,用到它的组件立刻重渲染。 */
export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    getSettings,
  );
}
