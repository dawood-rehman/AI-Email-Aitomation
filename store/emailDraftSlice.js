import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  draft: null,
  editedDraft: null,
  isEditingDraft: false,
  selectedContacts: [],
  isBulkEmail: false,
};

const emailDraftSlice = createSlice({
  name: "emailDraft",
  initialState,
  reducers: {
    saveDraft: (state, action) => {
      state.draft = action.payload;
    },
    saveEditedDraft: (state, action) => {
      state.editedDraft = action.payload;
    },
    setIsEditingDraft: (state, action) => {
      state.isEditingDraft = action.payload;
    },
    saveSelectedContacts: (state, action) => {
      state.selectedContacts = action.payload;
    },
    setIsBulkEmail: (state, action) => {
      state.isBulkEmail = action.payload;
    },
    clearDraft: (state) => {
      state.draft = null;
      state.editedDraft = null;
      state.isEditingDraft = false;
      state.selectedContacts = [];
      state.isBulkEmail = false;
    },
  },
});

export const {
  saveDraft,
  saveEditedDraft,
  setIsEditingDraft,
  saveSelectedContacts,
  setIsBulkEmail,
  clearDraft,
} = emailDraftSlice.actions;

export default emailDraftSlice.reducer;

