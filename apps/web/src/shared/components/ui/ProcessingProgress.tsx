import React from 'react';
import { Progress } from "@/shared/components/ui/progress";
import { Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';
import { Button } from "@/shared/components/ui/button";

export interface ProcessingTask {
    id: string;
    title: string;
    progress: number;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
    error?: string;
    description?: string;
}

interface ProcessingProgressProps {
    tasks: ProcessingTask[];
    isVisible: boolean;
    onClose: () => void;
    onCancelTask?: (taskId: string) => void;
    title?: string;
    className?: string;
}

const ProcessingProgress: React.FC<ProcessingProgressProps> = ({
    tasks,
    isVisible,
    onClose,
    onCancelTask,
    title = "Processing Tasks",
    className = ""
}) => {
    if (!isVisible || tasks.length === 0) return null;

    const activeTasks = tasks.filter(task =>
        task.status === 'pending' || task.status === 'processing'
    );

    const completedTasks = tasks.filter(task => task.status === 'completed');
    const failedTasks = tasks.filter(task => task.status === 'failed');

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'failed':
                return <AlertCircle className="w-4 h-4 text-red-500" />;
            case 'processing':
            case 'pending':
                return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
            default:
                return null;
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'pending':
                return 'Waiting...';
            case 'processing':
                return 'Processing...';
            case 'completed':
                return 'Completed';
            case 'failed':
                return 'Failed';
            case 'cancelled':
                return 'Cancelled';
            default:
                return status;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed':
                return 'text-green-600';
            case 'failed':
                return 'text-red-600';
            case 'processing':
                return 'text-blue-600';
            case 'pending':
                return 'text-yellow-600';
            default:
                return 'text-gray-600';
        }
    };

    return (
        <div className={`fixed bottom-4 right-4 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 ${className}`}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        {title}
                    </h3>
                    {activeTasks.length > 0 && (
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                            {activeTasks.length} active
                        </span>
                    )}
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="h-8 w-8 p-0"
                >
                    <X className="w-4 h-4" />
                </Button>
            </div>

            <div className="max-h-64 overflow-y-auto">
                {tasks.map((task) => (
                    <div key={task.id} className="p-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                    {task.title}
                                </p>
                                {task.description && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {task.description}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-2 ml-2">
                                {getStatusIcon(task.status)}
                                {(task.status === 'pending' || task.status === 'processing') && onCancelTask && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onCancelTask(task.id)}
                                        className="h-6 w-6 p-0"
                                    >
                                        <X className="w-3 h-3" />
                                    </Button>
                                )}
                            </div>
                        </div>

                        {(task.status === 'processing' || task.status === 'pending') && (
                            <Progress value={task.progress} className="h-2 mb-1" />
                        )}

                        <div className="flex items-center justify-between">
                            <p className={`text-xs ${getStatusColor(task.status)}`}>
                                {getStatusText(task.status)}
                                {task.progress > 0 && task.progress < 100 && ` - ${task.progress}%`}
                            </p>
                        </div>

                        {task.error && (
                            <p className="text-xs text-red-500 mt-1">{task.error}</p>
                        )}
                    </div>
                ))}
            </div>

            {(completedTasks.length > 0 || failedTasks.length > 0) && (
                <div className="p-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                        <span>
                            {completedTasks.length > 0 && `${completedTasks.length} completed`}
                            {completedTasks.length > 0 && failedTasks.length > 0 && ', '}
                            {failedTasks.length > 0 && `${failedTasks.length} failed`}
                        </span>
                        {activeTasks.length === 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onClose}
                                className="h-6 text-xs"
                            >
                                Close
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProcessingProgress;

