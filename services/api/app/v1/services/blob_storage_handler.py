import os
import datetime as dt
from fastapi.responses import JSONResponse
from fastapi import UploadFile, HTTPException
from azure.storage.blob import (
    BlobServiceClient as AzureBlobServiceClient,
    generate_blob_sas,
    BlobSasPermissions,
    ContentSettings,
)


# SECTION - BlobServiceClient
class BlobServiceClient:
    """
    Class to handle all Blob Storage operations.

    This class provides methods to interact with Azure Blob Storage, including uploading files,
    generating SAS URLs, deleting blobs, and retrieving blob content.

    """

    # initialize the BlobServiceClient with Azure Blob Storage credentials and settings
    def __init__(self):
        """
        Initialize the BlobServiceClient with Azure Blob Storage credentials and settings.

        Attributes:
            account_name (str): The Azure Storage account name, retrieved from environment variables.
            account_key (str): The Azure Storage account key, retrieved from environment variables.
            container_name (str): The Azure Storage container name, retrieved from environment variables.
            connection_string (str): The Azure Storage connection string, retrieved from environment variables.
            blob_service_client (AzureBlobServiceClient): The Azure Blob Service client instance.
        """
        self.account_name = os.getenv("AZURE_STORAGE_ACCOUNT_NAME")
        self.account_key = os.getenv("AZURE_STORAGE_ACCOUNT_KEY")
        self.container_name = os.getenv("AZURE_STORAGE_CONTAINER_NAME")
        self.connection_string = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
        self.blob_service_client = AzureBlobServiceClient.from_connection_string(
            conn_str=self.connection_string
        )

    # upload the file to Azure Blob Storage
    def upload_file(self, file: UploadFile, blob_name: str, filename: str):
        """Uploads a file to Azure Blob Storage.

        Args:
            file (UploadFile): The file to upload.
            blob_name (str): The name of the blob in Azure Blob Storage.

        Raises:
            HTTPException: If there is an error during the upload process.

        Returns:
            JSONResponse: A JSON response with the status of the upload.

        """
        try:
            content_settings = ContentSettings(
                content_type=file.content_type,
                content_disposition=f'attachment; filename="{filename}"',
            )
            blob_client = self.blob_service_client.get_blob_client(
                container=self.container_name, blob=blob_name
            )
            blob_client.upload_blob(
                file.file, overwrite=True, content_settings=content_settings
            )
            return "File uploaded successfully"
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # generate a SAS URL for a blob in Azure Blob Storage
    def generate_sas_url(self, blob_name: str, expiry_hours: int = 1):
        """Generates a SAS (Shared Access Signature) URL for a blob in Azure Blob Storage.

        Args:
            blob_name (str): The name of the blob in Azure Blob Storage.
            expiry_hours (int, optional): The number of hours until the SAS URL expires. Defaults to 1.

        Raises:
            HTTPException: If there is an error during the SAS URL generation process.

        Returns:
            str: The generated SAS URL for the blob.
        """
        try:
            sas_token = generate_blob_sas(
                account_name=self.account_name,
                container_name=self.container_name,
                blob_name=blob_name,
                account_key=self.account_key,
                permission=BlobSasPermissions(read=True),
                expiry=dt.datetime.utcnow() + dt.timedelta(hours=expiry_hours),
            )
            sas_url = f"https://{self.account_name}.blob.core.windows.net/{self.container_name}/{blob_name}?{sas_token}"
            return sas_url
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # delete a blob from Azure Blob Storage
    def delete_blob(self, blob_name: str):
        """Deletes a blob from Azure Blob Storage.

        Args:
            blob_name (str): The name of the blob in Azure Blob Storage.

        Raises:
            HTTPException: If there is an error during the deletion process.

        Returns:
            JSONResponse: A JSON response with the status of the deletion.
        """
        try:
            blob_client = self.blob_service_client.get_blob_client(
                container=self.container_name, blob=blob_name
            )
            blob_client.delete_blob()
            return "Blob deleted successfully"
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # retrieve the content of a blob from Azure Blob Storage
    def get_blob(self, blob_name: str):
        """Retrieves the content of a blob from Azure Blob Storage.

        Args:
            blob_name (str): The name of the blob in Azure Blob Storage.

        Raises:
            HTTPException: If there is an error during the retrieval process.

        Returns:
            JSONResponse: A JSON response containing the blob content.
        """
        try:
            blob_client = self.blob_service_client.get_blob_client(
                container=self.container_name, blob=blob_name
            )
            blob_data = blob_client.download_blob().readall()
            return {"blob_data": blob_data.decode("utf-8")}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


#!SECTION
