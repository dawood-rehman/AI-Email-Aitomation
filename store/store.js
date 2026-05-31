import { configureStore } from "@reduxjs/toolkit";
import emailDraftReducer from "./emailDraftSlice";

export const makeStore = () => {
  return configureStore({
    reducer: {
      emailDraft: emailDraftReducer,
    },
  });
};

