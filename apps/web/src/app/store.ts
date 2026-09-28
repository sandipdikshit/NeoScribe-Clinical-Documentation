import { configureStore } from '@reduxjs/toolkit'
import recordingDialogIndicatorStateReducer from '@/shared/reducers/recordingDialogIndicatorState.reducer'
import recordingDialogStateReducer from '@/shared/reducers/recordingDialogState.reducer'

export default configureStore({
    reducer: {
      recordingDialogIndicatorState: recordingDialogIndicatorStateReducer,
      recordingDialogState: recordingDialogStateReducer
  }
})