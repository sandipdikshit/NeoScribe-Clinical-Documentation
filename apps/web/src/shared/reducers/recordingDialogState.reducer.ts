import { createSlice } from '@reduxjs/toolkit';

export const recordingDialogStateSlice  = createSlice({
  name: 'recordingDialogState',
  initialState: {
    isOpen: false,
  },
  reducers: {
    openRecordingDialog: (state) => {
      state.isOpen = true;
    },
    closeRecordingDialog: (state) => {
      state.isOpen = false;
    },
    toggleRecordingDialog: (state) => {
      state.isOpen = !state.isOpen;
    },
  },
});

// Action creators are generated for each case reducer function
export const { openRecordingDialog, closeRecordingDialog, toggleRecordingDialog } = recordingDialogStateSlice.actions;

export default recordingDialogStateSlice.reducer;
