'use client'
import { Button } from "@/shared/components/ui/button";
import { useSelector, useDispatch } from "react-redux";
import { openRecordingDialog } from '@/shared/reducers/recordingDialogState.reducer'
import { createPortal } from "react-dom";


const RecordingIndicator: React.FC = () => {

    const isRecordingDialogIndicatorOpen = useSelector((state: any) => state.recordingDialogIndicatorState.isOpen)

    const dispatch = useDispatch();

    if (isRecordingDialogIndicatorOpen) {
        return (
            createPortal(
                <div
                    className="fixed bottom-4 right-4 z-[9999] pointer-events-auto"
                    style={{
                        position: 'fixed',
                        bottom: '1rem',
                        right: '1rem',
                        zIndex: 9999,
                        transform: 'translateZ(0)', // Force hardware acceleration
                        willChange: 'transform'
                    }}
                >
                    <div
                        className="bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2 transition-all duration-200 hover:shadow-xl hover:scale-105"
                        style={{
                            transform: 'translateZ(0)', // Force hardware acceleration
                            backfaceVisibility: 'hidden' // Prevent flickering
                        }}
                    >
                        <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium">Recording in progress...</span>
                        <Button
                            size="sm"
                            variant="outline"
                            className="ml-2 bg-white text-red-500 border-white hover:bg-gray-100 transition-colors duration-200"
                            onClick={() => dispatch(openRecordingDialog())}
                        >
                            Open
                        </Button>
                    </div>
                </div>, document.body
            )
        ); // Don't render if the dialog is open
    }

    return (
        <></>
    )
}

export default RecordingIndicator;