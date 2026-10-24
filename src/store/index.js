"use client";

import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { hcmApi } from "@/store/api";

export const makeStore = () => {
  const store = configureStore({
    reducer: { [hcmApi.reducerPath]: hcmApi.reducer },
    middleware: (getDefault) => getDefault().concat(hcmApi.middleware),
  });
  setupListeners(store.dispatch);
  return store;
};
