import os
import datetime as dt
from fastapi.responses import JSONResponse
from fastapi import UploadFile, HTTPException
from azure.storage.blob import (
    BlobServiceClient as AzureBlobServiceClient,
    generate_blob_sas,
    BlobSasPermissions,
    ContentSettings,
    StandardBlobTier,
)
from azure.storage.blob.aio import BlobServiceClient as AsyncBlobServiceClient
from dotenv import load_dotenv
import logging
from typing import Optional, Dict, Any, Union
import asyncio
from concurrent.futures import ThreadPoolExecutor
import io

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class BlobStorageHandler:
    """
    Class to handle all Blob Storage operations.

    This class provides methods to interact with Azure Blob Storage, including uploading files,
    generating SAS URLs, deleting blobs, and retrieving blob content.
    """

    def __init__(
        self, 
        connection_string: Optional[str] = None, 
        account_name: Optional[str] = None, 
        account_key: Optional[str] = None,
        container_name: Optional[str] = None,
        max_workers: int = 4,
        chunk_size: int = 4 * 1024 * 1024  # 4MB chunks
    ):
        """
        Initialize the BlobStorageHandler with Azure Blob Storage credentials and settings.

        Args:
            connection_string: Azure Storage connection string
            account_name: Azure Storage account name
            account_key: Azure Storage account key
            container_name: Azure Storage container name
            max_workers: Maximum number of parallel upload workers
            chunk_size: Size of chunks for large file uploads (in bytes)
            
        If any parameter is None, it will be loaded from environment variables.
        """
        self.account_name = account_name or os.getenv("AZURE_STORAGE_ACCOUNT_NAME")
        self.account_key = account_key or os.getenv("AZURE_STORAGE_ACCOUNT_KEY")
        self.connection_string = connection_string or os.getenv("AZURE_STORAGE_CONNECTION_STRING")
        self.default_container_name = container_name or os.getenv("AZURE_STORAGE_CONTAINER_NAME")
        self.max_workers = max_workers
        self.chunk_size = chunk_size
        
        # Validate required credentials
        if not self.connection_string:
            if not (self.account_name and self.account_key):
                raise ValueError("Either connection_string or both account_name and account_key must be provided")
                
        # Initialize the blob service client
        self.blob_service_client = AzureBlobServiceClient.from_connection_string(
            conn_str=self.connection_string
        )
        
        logger.info(f"Initialized BlobStorageHandler with account: {self.account_name}")

    def upload_file(
        self, 
        file: UploadFile, 
        provider_id: str,
        patient_id: Optional[str] = None,
        custom_blob_name: Optional[str] = None,
        container_name: Optional[str] = None,
        use_chunked_upload: bool = True
    ) -> Dict[str, Any]:
        """
        Uploads a file to Azure Blob Storage with organizational structure based on provider.

        Args:
            file: The file to upload
            provider_id: Provider ID for organizing files in containers/folders
            patient_id: Optional patient ID for further organization
            custom_blob_name: Optional custom name for the blob
            container_name: Optional container name override
            use_chunked_upload: Whether to use chunked upload for large files
            
        Returns:
            Dictionary containing upload information including the blob name and path
        """
        try:
            # Use provider-specific container or create one if it doesn't exist
            container = container_name or self.default_container_name
            
            # Ensure container exists
            container_client = self.blob_service_client.get_container_client(container)
            if not container_client.exists():
                logger.info(f"Creating container: {container}")
                container_client.create_container()
            
            # Generate a blob path based on provider and patient (if provided)
            timestamp = dt.datetime.now().strftime("%Y%m%d%H%M%S")
            filename = custom_blob_name or f"{timestamp}_{file.filename}"
            
            # Organize by provider and optionally by patient
            if patient_id:
                blob_path = f"provider_{provider_id}/patient_{patient_id}/{filename.replace(' ', '_')}"
            else:
                blob_path = f"provider_{provider_id}/{filename.replace(' ', '_')}"
                
            # Set content settings for the blob
            content_settings = ContentSettings(
                content_type=file.content_type,
                content_disposition=f'attachment; filename="{file.filename}"',
            )
            
            # Get blob client
            blob_client = self.blob_service_client.get_blob_client(
                container=container, 
                blob=blob_path
            )
            
            # Determine upload method based on file size and preference
            file_size = file.size or 0
            should_use_chunked = use_chunked_upload and file_size > self.chunk_size
            
            if should_use_chunked:
                logger.info(f"Using chunked upload for file size: {file_size} bytes")
                self._upload_large_file_chunked(blob_client, file, content_settings)
            else:
                logger.info(f"Using single upload for file size: {file_size} bytes")
                blob_client.upload_blob(
                    file.file, 
                    overwrite=True, 
                    content_settings=content_settings
                )
            
            # Generate a SAS URL for immediate access
            sas_url = self.generate_sas_url(blob_path, container_name=container)
            
            logger.info(f"Uploaded file to {blob_path}")
            
            return {
                "status": "success",
                "blob_name": blob_path,
                "container": container,
                "content_type": file.content_type,
                "size_bytes": file_size,
                "sas_url": sas_url,
                "upload_method": "chunked" if should_use_chunked else "single"
            }
            
        except Exception as e:
            logger.error(f"Error uploading file: {str(e)}")
            raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

    def _upload_large_file_chunked(self, blob_client, file: UploadFile, content_settings: ContentSettings):
        """
        Uploads a large file using Azure's built-in chunked upload for better performance.
        
        Args:
            blob_client: The blob client to upload to
            file: The file to upload
            content_settings: Content settings for the blob
        """
        try:
            # Use Azure's built-in streaming upload which handles chunking automatically
            # This is more efficient than manual chunking
            blob_client.upload_blob(
                file.file,
                overwrite=True,
                content_settings=content_settings,
                max_concurrency=4,  # Use multiple threads for upload
                length=None  # Let Azure determine the length
            )
            
            logger.info("Completed chunked upload using Azure's built-in streaming")
                
        except Exception as e:
            logger.error(f"Error in chunked upload: {str(e)}")
            raise

    def upload_file_streaming(
        self, 
        file: UploadFile, 
        provider_id: str,
        patient_id: Optional[str] = None,
        custom_blob_name: Optional[str] = None,
        container_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Uploads a file using streaming for optimal memory usage and performance.
        
        Args:
            file: The file to upload
            provider_id: Provider ID for organizing files in containers/folders
            patient_id: Optional patient ID for further organization
            custom_blob_name: Optional custom name for the blob
            container_name: Optional container name override
            
        Returns:
            Dictionary containing upload information including the blob name and path
        """
        try:
            # Use provider-specific container
            container = container_name or self.default_container_name
            
            # Ensure container exists
            container_client = self.blob_service_client.get_container_client(container)
            if not container_client.exists():
                logger.info(f"Creating container: {container}")
                container_client.create_container()
            
            # Generate blob path
            timestamp = dt.datetime.now().strftime("%Y%m%d%H%M%S")
            filename = custom_blob_name or f"{timestamp}_{file.filename}"
            
            if patient_id:
                blob_path = f"provider_{provider_id}/patient_{patient_id}/{filename}"
            else:
                blob_path = f"provider_{provider_id}/{filename}"
            
            # Set content settings
            content_settings = ContentSettings(
                content_type=file.content_type,
                content_disposition=f'attachment; filename="{file.filename}"',
            )
            
            # Get blob client
            blob_client = self.blob_service_client.get_blob_client(
                container=container, 
                blob=blob_path
            )
            
            # Upload using streaming with optimized settings
            blob_client.upload_blob(
                file.file,
                overwrite=True,
                content_settings=content_settings,
                max_concurrency=4,  # Parallel upload threads
                length=None,  # Auto-detect file size
                validate_content=False  # Skip MD5 validation for speed
            )
            
            # Generate SAS URL
            sas_url = self.generate_sas_url(blob_path, container_name=container)
            
            logger.info(f"Streaming uploaded file to {blob_path}")
            
            return {
                "status": "success",
                "blob_name": blob_path,
                "container": container,
                "content_type": file.content_type,
                "size_bytes": file.size,
                "sas_url": sas_url,
                "upload_method": "streaming"
            }
            
        except Exception as e:
            logger.error(f"Error in streaming upload: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Streaming upload failed: {str(e)}")

    def upload_file_optimized(
        self, 
        file: UploadFile, 
        provider_id: str,
        patient_id: Optional[str] = None,
        custom_blob_name: Optional[str] = None,
        container_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Optimized upload method that automatically chooses the best upload strategy.
        
        Args:
            file: The file to upload
            provider_id: Provider ID for organizing files in containers/folders
            patient_id: Optional patient ID for further organization
            custom_blob_name: Optional custom name for the blob
            container_name: Optional container name override
            
        Returns:
            Dictionary containing upload information including the blob name and path
        """
        try:
            # Use provider-specific container
            container = container_name or self.default_container_name
            
            # Ensure container exists
            container_client = self.blob_service_client.get_container_client(container)
            if not container_client.exists():
                logger.info(f"Creating container: {container}")
                container_client.create_container()
            
            # Generate blob path
            timestamp = dt.datetime.now().strftime("%Y%m%d%H%M%S")
            filename = custom_blob_name or f"{timestamp}_{file.filename}"
            
            if patient_id:
                blob_path = f"provider_{provider_id}/patient_{patient_id}/{filename}"
            else:
                blob_path = f"provider_{provider_id}/{filename}"
            
            # Set content settings
            content_settings = ContentSettings(
                content_type=file.content_type,
                content_disposition=f'attachment; filename="{file.filename}"',
            )
            
            # Get blob client
            blob_client = self.blob_service_client.get_blob_client(
                container=container, 
                blob=blob_path
            )
            
            # Determine optimal upload method based on file size
            file_size = file.size or 0
            upload_method = "streaming"
            
            if file_size > 100 * 1024 * 1024:  # > 100MB
                # For very large files, use streaming with high concurrency
                blob_client.upload_blob(
                    file.file,
                    overwrite=True,
                    content_settings=content_settings,
                    max_concurrency=8,  # Higher concurrency for large files
                    length=None,
                    validate_content=False
                )
                upload_method = "high_concurrency_streaming"
            elif file_size > 10 * 1024 * 1024:  # > 10MB
                # For medium files, use standard streaming
                blob_client.upload_blob(
                    file.file,
                    overwrite=True,
                    content_settings=content_settings,
                    max_concurrency=4,
                    length=None,
                    validate_content=False
                )
                upload_method = "standard_streaming"
            else:
                # For small files, use simple upload
                blob_client.upload_blob(
                    file.file,
                    overwrite=True,
                    content_settings=content_settings
                )
                upload_method = "simple"
            
            # Generate SAS URL
            sas_url = self.generate_sas_url(blob_path, container_name=container)
            
            logger.info(f"Optimized upload completed: {blob_path} using {upload_method}")
            
            return {
                "status": "success",
                "blob_name": blob_path,
                "container": container,
                "content_type": file.content_type,
                "size_bytes": file_size,
                "sas_url": sas_url,
                "upload_method": upload_method
            }
            
        except Exception as e:
            logger.error(f"Error in optimized upload: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Optimized upload failed: {str(e)}")

    async def upload_file_async(
        self, 
        file: UploadFile, 
        provider_id: str,
        patient_id: Optional[str] = None,
        custom_blob_name: Optional[str] = None,
        container_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Asynchronous version of upload_file for better performance with large files.
        
        Args:
            file: The file to upload
            provider_id: Provider ID for organizing files in containers/folders
            patient_id: Optional patient ID for further organization
            custom_blob_name: Optional custom name for the blob
            container_name: Optional container name override
            
        Returns:
            Dictionary containing upload information including the blob name and path
        """
        try:
            # Use provider-specific container
            container = container_name or self.default_container_name
            
            # Generate blob path
            timestamp = dt.datetime.now().strftime("%Y%m%d%H%M%S")
            filename = custom_blob_name or f"{timestamp}_{file.filename}"
            
            if patient_id:
                blob_path = f"provider_{provider_id}/patient_{patient_id}/{filename}"
            else:
                blob_path = f"provider_{provider_id}/{filename}"
            
            # Initialize async blob service client
            async with AsyncBlobServiceClient.from_connection_string(self.connection_string) as async_blob_service:
                container_client = async_blob_service.get_container_client(container)
                
                # Ensure container exists
                if not await container_client.exists():
                    logger.info(f"Creating container: {container}")
                    await container_client.create_container()
                
                # Get blob client
                blob_client = container_client.get_blob_client(blob_path)
                
                # Set content settings
                content_settings = ContentSettings(
                    content_type=file.content_type,
                    content_disposition=f'attachment; filename="{file.filename}"',
                )
                
                # Read file content
                file_content = await file.read()
                
                # Upload using async client
                await blob_client.upload_blob(
                    file_content,
                    overwrite=True,
                    content_settings=content_settings
                )
                
                logger.info(f"Async uploaded file to {blob_path}")
                
                # Generate SAS URL
                sas_url = self.generate_sas_url(blob_path, container_name=container)
                
                return {
                    "status": "success",
                    "blob_name": blob_path,
                    "container": container,
                    "content_type": file.content_type,
                    "size_bytes": len(file_content),
                    "sas_url": sas_url,
                    "upload_method": "async"
                }
                
        except Exception as e:
            logger.error(f"Error in async upload: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Async file upload failed: {str(e)}")

    def upload_file_with_progress(
        self, 
        file: UploadFile, 
        provider_id: str,
        patient_id: Optional[str] = None,
        custom_blob_name: Optional[str] = None,
        container_name: Optional[str] = None,
        progress_callback: Optional[callable] = None
    ) -> Dict[str, Any]:
        """
        Uploads a file with progress tracking for large files.
        
        Args:
            file: The file to upload
            provider_id: Provider ID for organizing files in containers/folders
            patient_id: Optional patient ID for further organization
            custom_blob_name: Optional custom name for the blob
            container_name: Optional container name override
            progress_callback: Optional callback function to track progress
            
        Returns:
            Dictionary containing upload information including the blob name and path
        """
        try:
            # Use provider-specific container
            container = container_name or self.default_container_name
            
            # Ensure container exists
            container_client = self.blob_service_client.get_container_client(container)
            if not container_client.exists():
                logger.info(f"Creating container: {container}")
                container_client.create_container()
            
            # Generate blob path
            timestamp = dt.datetime.now().strftime("%Y%m%d%H%M%S")
            filename = custom_blob_name or f"{timestamp}_{file.filename}"
            
            if patient_id:
                blob_path = f"provider_{provider_id}/patient_{patient_id}/{filename}"
            else:
                blob_path = f"provider_{provider_id}/{filename}"
            
            # Set content settings
            content_settings = ContentSettings(
                content_type=file.content_type,
                content_disposition=f'attachment; filename="{file.filename}"',
            )
            
            # Get blob client
            blob_client = self.blob_service_client.get_blob_client(
                container=container, 
                blob=blob_path
            )
            
            # Read file in chunks for progress tracking
            file_content = file.file.read()
            file_size = len(file_content)
            
            if progress_callback:
                progress_callback(0, file_size, "Starting upload...")
            
            # Upload with progress tracking
            blob_client.upload_blob(
                file_content,
                overwrite=True,
                content_settings=content_settings
            )
            
            if progress_callback:
                progress_callback(file_size, file_size, "Upload completed")
            
            # Generate SAS URL
            sas_url = self.generate_sas_url(blob_path, container_name=container)
            
            logger.info(f"Uploaded file to {blob_path} with progress tracking")
            
            return {
                "status": "success",
                "blob_name": blob_path,
                "container": container,
                "content_type": file.content_type,
                "size_bytes": file_size,
                "sas_url": sas_url,
                "upload_method": "progress_tracked"
            }
            
        except Exception as e:
            logger.error(f"Error uploading file with progress: {str(e)}")
            raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

    def generate_sas_url(
        self, 
        blob_name: str, 
        expiry_hours: int = 1,
        container_name: Optional[str] = None
    ) -> str:
        """
        Generates a SAS (Shared Access Signature) URL for a blob in Azure Blob Storage.

        Args:
            blob_name: The name/path of the blob in Azure Blob Storage
            expiry_hours: The number of hours until the SAS URL expires (default: 1)
            container_name: Optional container name override
            
        Returns:
            The generated SAS URL for the blob
        """
        try:
            container = container_name or self.default_container_name
            
            sas_token = generate_blob_sas(
                account_name=self.account_name,
                container_name=container,
                blob_name=blob_name,
                account_key=self.account_key,
                permission=BlobSasPermissions(read=True),
                expiry=dt.datetime.utcnow() + dt.timedelta(hours=expiry_hours),
            )
            
            sas_url = f"https://{self.account_name}.blob.core.windows.net/{container}/{blob_name}?{sas_token}"
            return sas_url
            
        except Exception as e:
            logger.error(f"Error generating SAS URL: {str(e)}")
            raise HTTPException(status_code=500, detail=f"SAS URL generation failed: {str(e)}")

    def delete_blob(self, blob_name: str, container_name: Optional[str] = None) -> Dict[str, str]:
        """
        Deletes a blob from Azure Blob Storage.

        Args:
            blob_name: The name/path of the blob in Azure Blob Storage
            container_name: Optional container name override
            
        Returns:
            Dictionary with status message
        """
        try:
            container = container_name or self.default_container_name
            
            blob_client = self.blob_service_client.get_blob_client(
                container=container, 
                blob=blob_name
            )
            
            blob_client.delete_blob()
            logger.info(f"Deleted blob {blob_name} from container {container}")
            
            return {"status": "success", "message": "Blob deleted successfully"}
            
        except Exception as e:
            logger.error(f"Error deleting blob: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Blob deletion failed: {str(e)}")

    def get_blob_content(self, blob_name: str, container_name: Optional[str] = None) -> Union[Dict[str, Any], bytes]:
        """
        Retrieves the content of a blob from Azure Blob Storage.

        Args:
            blob_name: The name/path of the blob in Azure Blob Storage
            container_name: Optional container name override
            
        Returns:
            Either the raw blob content as bytes or a dictionary with the content for text files
        """
        try:
            container = container_name or self.default_container_name
            
            blob_client = self.blob_service_client.get_blob_client(
                container=container, 
                blob=blob_name
            )
            
            # Download the blob
            download_stream = blob_client.download_blob()
            blob_data = download_stream.readall()
            
            # Try to decode as text - if it fails, return the raw bytes
            try:
                text_content = blob_data.decode("utf-8")
                return {"blob_data": text_content}
            except UnicodeDecodeError:
                # Return raw bytes for binary content
                return blob_data
                
        except Exception as e:
            logger.error(f"Error retrieving blob content: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to retrieve blob content: {str(e)}")

    def list_blobs_by_provider(self, provider_id: str, container_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Lists all blobs associated with a specific provider.

        Args:
            provider_id: The provider ID to filter blobs by
            container_name: Optional container name override
            
        Returns:
            Dictionary containing the list of blobs for the provider
        """
        try:
            container = container_name or self.default_container_name
            
            # Get container client
            container_client = self.blob_service_client.get_container_client(container)
            
            # Filter blobs by provider prefix
            prefix = f"provider_{provider_id}/"
            blob_list = container_client.list_blobs(name_starts_with=prefix)
            
            # Compile blob information
            blobs = []
            for blob in blob_list:
                blobs.append({
                    "name": blob.name,
                    "size_bytes": blob.size,
                    "content_type": blob.content_settings.content_type,
                    "last_modified": blob.last_modified.isoformat()
                })
                
            return {
                "provider_id": provider_id,
                "container": container,
                "blob_count": len(blobs),
                "blobs": blobs
            }
            
        except Exception as e:
            logger.error(f"Error listing blobs: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to list blobs: {str(e)}")


if __name__ == "__main__":
    # Example usage
    try:
        # Initialize the handler with optimized settings for large files
        blob_handler = BlobStorageHandler(
            max_workers=8,  # More workers for better performance
            chunk_size=8 * 1024 * 1024  # 8MB chunks for large files
        )
        
        # Test SAS URL generation
        provider_id = "3363146"
        result = blob_handler.generate_sas_url("provider_3363146/patient_fd6a8935-484e-988a-bc3530094eda/20250318033213_Patient 5-15 Well Visit.wav")
        print(f"SAS URL generated: {result}")
        
        # Example of how to use the optimized upload methods:
        # 
        # 1. For automatic optimization based on file size:
        # result = blob_handler.upload_file_optimized(file, provider_id, patient_id)
        #
        # 2. For streaming upload (recommended for large files):
        # result = blob_handler.upload_file_streaming(file, provider_id, patient_id)
        #
        # 3. For async upload (if using async endpoints):
        # result = await blob_handler.upload_file_async(file, provider_id, patient_id)
        #
        # 4. For progress tracking:
        # def progress_callback(bytes_uploaded, total_bytes, message):
        #     print(f"Progress: {bytes_uploaded}/{total_bytes} - {message}")
        # result = blob_handler.upload_file_with_progress(file, provider_id, patient_id, progress_callback=progress_callback)
        
    except Exception as e:
        print(f"Error in test: {str(e)}")