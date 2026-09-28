import os
import datetime as dt
from fastapi.responses import JSONResponse
from fastapi import UploadFile, HTTPException
from azure.storage.blob import (
    BlobServiceClient,
    generate_blob_sas,
    BlobSasPermissions,
    ContentSettings,
)

AZURE_STORAGE_ACCOUNT_NAME = os.getenv("AZURE_STORAGE_ACCOUNT_NAME")
AZURE_STORAGE_ACCOUNT_KEY = os.getenv("AZURE_STORAGE_ACCOUNT_KEY")
AZURE_STORAGE_CONTAINER_NAME = os.getenv("AZURE_STORAGE_CONTAINER_NAME")
AZURE_STORAGE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING")


def create_blob_service_client():
    # Create a BlobServiceClient
    blob_service_client = BlobServiceClient.from_connection_string(
        conn_str=AZURE_STORAGE_CONNECTION_STRING
    )
    return blob_service_client


async def upload_file_to_blob(blob_service_client, file: UploadFile, filename: str):

    content_settings = ContentSettings(
        content_type=file.content_type,
        content_disposition=f'attachment; filename="{filename}"',
    )
    # Upload the file to Azure Blob Storage
    blob_client = blob_service_client.get_blob_client(
        container=AZURE_STORAGE_CONTAINER_NAME, blob=filename
    )
    file_content = await file.read()
    blob_client.upload_blob(
        file_content, overwrite=True, content_settings=content_settings
    )


def generate_sas_url(filename: str):
    sas_token = generate_blob_sas(
        account_name=AZURE_STORAGE_ACCOUNT_NAME,
        container_name=AZURE_STORAGE_CONTAINER_NAME,
        blob_name=filename,
        account_key=AZURE_STORAGE_ACCOUNT_KEY,
        permission=BlobSasPermissions(read=True),
        expiry=dt.datetime.now(dt.UTC) + dt.timedelta(hours=1),
    )
    sas_url = f"https://{AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/{AZURE_STORAGE_CONTAINER_NAME}/{filename}?{sas_token}"

    return sas_url


async def upload_audio(file: UploadFile, filename: str):
    # Create a BlobServiceClient
    blob_service_client = create_blob_service_client()

    # Upload the file to Azure Blob Storage
    await upload_file_to_blob(blob_service_client, file, filename)

    # Generate a SAS URL for the uploaded file
    sas_url = generate_sas_url(filename)

    return {"filename": filename, "sas_url": sas_url}
