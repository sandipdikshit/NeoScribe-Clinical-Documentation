// uploadService.ts
import { EventEmitter } from 'events';
import { postData } from '@/lib/api/crud';

import { securePostData } from '@/lib/api/secure-crud';

interface UploadTask {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  chiefComplaint: string;
  patientId: string;
  visitDate: string;
  noteType: string;
  template: string;
  startTime: number;
  retryCount: number;
}

class UploadService extends EventEmitter {
  private uploads: Map<string, UploadTask> = new Map();
  private uploadQueue: string[] = [];
  private isProcessing = false;
  private maxConcurrent = 3;
  private activeUploads = 0;
  private abortControllers: Map<string, AbortController> = new Map();

  // Chunk size for upload (20MB)
  private CHUNK_SIZE = 20 * 1024 * 1024;

  constructor() {
    super();
    this.startProcessing();
  }

  // Add a new upload to the queue
  addUpload(
    file: File,
    chiefComplaint: string,
    patientId: string,
    visitDate: string,
    noteType: string,
    template: string
  ): string {
    const id = this.generateId();
    const task: UploadTask = {
      id,
      file,
      progress: 0,
      status: 'pending',
      chiefComplaint,
      patientId,
      visitDate,
      noteType,
      template,
      startTime: Date.now(),
      retryCount: 0
    };

    this.uploads.set(id, task);
    this.uploadQueue.push(id);
    this.emit('upload-added', task);
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.startProcessing();
    }

    return id;
  }

  // Cancel an upload
  cancelUpload(id: string) {
    const task = this.uploads.get(id);
    if (!task) return;

    // Abort the HTTP request if active
    const controller = this.abortControllers.get(id);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(id);
    }

    task.status = 'cancelled';
    this.emit('upload-cancelled', task);
    
    // Remove from queue
    const queueIndex = this.uploadQueue.indexOf(id);
    if (queueIndex > -1) {
      this.uploadQueue.splice(queueIndex, 1);
    }

    // Clean up after a delay
    setTimeout(() => {
      this.uploads.delete(id);
    }, 5000);
  }

  // Get all uploads
  getAllUploads(): UploadTask[] {
    return Array.from(this.uploads.values());
  }

  // Get a specific upload
  getUpload(id: string): UploadTask | undefined {
    return this.uploads.get(id);
  }

  // Private methods
  private generateId(): string {
    return `upload-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  private async startProcessing() {
    this.isProcessing = true;

    while (this.uploadQueue.length > 0 || this.activeUploads > 0) {
      // Process uploads concurrently up to the limit
      while (this.uploadQueue.length > 0 && this.activeUploads < this.maxConcurrent) {
        const id = this.uploadQueue.shift();
        if (id) {
          this.processUpload(id);
        }
      }

      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isProcessing = false;
  }

  private async processUpload(id: string) {
    const task = this.uploads.get(id);
    if (!task) return;

    this.activeUploads++;
    task.status = 'uploading';
    this.emit('upload-started', task);

    try {
      // Create abort controller for this upload
      const abortController = new AbortController();
      this.abortControllers.set(id, abortController);

      // Upload the file in chunks
      await this.uploadFileInChunks(task, abortController.signal);

      // If upload was successful, update status
      if (!this.abortControllers.has(id)) {
        task.status = 'completed';
        task.progress = 100;
        this.emit('upload-completed', task);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Upload was cancelled
      } else {
        // Handle upload error
        console.error('Upload error:', error);
        task.status = 'failed';
        task.error = error.message;
        this.emit('upload-failed', task);

        // Retry logic
        if (task.retryCount < 3) {
          task.retryCount++;
          task.status = 'pending';
          this.uploadQueue.push(id);
        }
      }
    } finally {
      this.activeUploads--;
      this.abortControllers.delete(id);
    }
  }

  private async uploadFileInChunks(task: UploadTask, signal: AbortSignal) {
    const { file } = task;
    const totalChunks = Math.ceil(file.size / this.CHUNK_SIZE);
    
    // Initialize upload session
    const sessionId = await this.initializeUpload(task, totalChunks, signal);

    // Upload chunks
    for (let i = 0; i < totalChunks; i++) {
      if (signal.aborted) {
        const err = new Error('Upload cancelled');
        err.name = 'AbortError';
        throw err;
      }

      const start = i * this.CHUNK_SIZE;
      const end = Math.min(start + this.CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      await this.uploadChunk(sessionId, chunk, i, totalChunks, task, signal);

      // Update progress
      task.progress = Math.round(((i + 1) / totalChunks) * 100);
      this.emit('upload-progress', task);
    }

    // Finalize upload
    await this.finalizeUpload(sessionId, task, signal);

    this.emit('upload-finalized', task);
  }

  private async initializeUpload(task: UploadTask, totalChunks: number, signal: AbortSignal): Promise<string> {
          const formdata = new FormData();
      formdata.append('fileName', task.file.name);
      formdata.append('fileSize', task.file.size.toString());
      formdata.append('fileType', task.file.type);
      formdata.append('totalChunks', totalChunks.toString());
      formdata.append('chiefComplaint', task.chiefComplaint);
      formdata.append('patientId', task.patientId);
      formdata.append('visitDate', task.visitDate);
      formdata.append('noteType', task.noteType);
    formdata.append('template', task.template);
    
    const response = await postData('/upload/initialize', formdata, 'multipart/form-data', signal);

    if (!response) {
      throw new Error('Failed to initialize upload');
    }

    return response.sessionId;
  }

  private async uploadChunk(
    sessionId: string,
    chunk: Blob,
    chunkIndex: number,
    totalChunks: number,
    task: UploadTask,
    signal: AbortSignal
  ) {
    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('sessionId', sessionId);
    formData.append('chunkIndex', chunkIndex.toString());
    formData.append('totalChunks', totalChunks.toString());

    const response = await postData('/upload/chunk', formData, 'multipart/form-data', signal);

    if (!response) {
      throw new Error(`Failed to upload chunk ${chunkIndex + 1}`);
    }
  }

  private async finalizeUpload(sessionId: string, task: UploadTask, signal: AbortSignal) {
    task.status = 'completed';
    this.emit('upload-completed', task);
    const formdata = new FormData();
    formdata.append('sessionId', sessionId);

    const response = await postData('/upload/finalize', formdata, 'multipart/form-data', signal);

    if (!response) {
      throw new Error('Failed to finalize upload');
    }

    return response;
  }

  // Cleanup old completed/failed uploads
  cleanup() {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes

    this.uploads.forEach((task, id) => {
      if (
        (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') &&
        now - task.startTime > maxAge
      ) {
        this.uploads.delete(id);
      }
    });
  }
}

// Create singleton instance
export const uploadService = new UploadService();

// Clean up old uploads periodically
setInterval(() => {
  uploadService.cleanup();
}, 5 * 60 * 1000); // Every 5 minutes