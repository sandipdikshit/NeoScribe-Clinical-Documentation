import { createSlice } from '@reduxjs/toolkit';

export const recordingDialogIndicatorStateSlice  = createSlice({
  name: 'recordingDialogIndicatorState',
  initialState: {
    isOpen: false,
  },
  reducers: {
    openRecordingDialogIndicator: (state) => {
      state.isOpen = true;
    },
    closeRecordingDialogIndicator: (state) => {
      state.isOpen = false;
    },
    toggleRecordingDialogIndicator: (state) => {
      state.isOpen = !state.isOpen;
    },
  },
});

// Action creators are generated for each case reducer function
export const { openRecordingDialogIndicator, closeRecordingDialogIndicator, toggleRecordingDialogIndicator } = recordingDialogIndicatorStateSlice.actions;

export default recordingDialogIndicatorStateSlice.reducer;
