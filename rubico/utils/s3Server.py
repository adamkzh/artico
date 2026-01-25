import os
import time
import uuid
import boto3
from botocore.exceptions import NoCredentialsError, ClientError
from typing import Optional

# Environment config
AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID', 'your-access-key')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY', 'your-secret-key')
AWS_REGION = os.getenv('AWS_REGION', 'us-east-2')
S3_BUCKET_NAME = os.getenv('S3_BUCKET_NAME', 'rubico-generated-audio')

# Initialize S3 client
try:
    s3_client = boto3.client(
        's3',
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        region_name=AWS_REGION,
        endpoint_url=f"https://s3.{AWS_REGION}.amazonaws.com"
    )
except Exception as e:
    raise RuntimeError(f"Failed to initialize S3 client: {e}")

def generate_object_key(
    session_id: str,
    prefix: str = "sessions",
    extension: str = "mp3"
) -> str:
    """
    Generate a standardized S3 object key for storing audio files.

    Args:
        session_id (str): Unique session identifier.
        prefix (str): Optional top-level folder in S3 (default: 'sessions').
        extension (str): File extension without the leading dot (default: 'mp3').

    Returns:
        str: An S3 object key like 'sessions/{session_id}/{timestamp}.mp3'.
    """
    timestamp = int(time.time())
    return f"{prefix}/{session_id}/{timestamp}.{extension}"

def upload_file_and_get_presigned_url(
    file_bytes: bytes,
    session_id: str,
    expiration_seconds: int = 300,
    content_type: str = "audio/mpeg",
    bucket_name: Optional[str] = None
) -> str:
    """
    Uploads file bytes to S3 and returns a pre-signed URL.

    Args:
        file_bytes (bytes): The file content.
        session_id (str): Session ID to organize files in S3.
        expiration_seconds (int): How long the pre-signed URL is valid (default: 300 seconds).
        content_type (str): MIME type of the file (default: "audio/mpeg").
        bucket_name (Optional[str]): Optionally override the default bucket.

    Returns:
        str: A pre-signed URL to access the uploaded file.
    """
    bucket = bucket_name or S3_BUCKET_NAME
    object_key = generate_object_key(session_id)

    try:
        s3_client.put_object(
            Bucket=bucket,
            Key=object_key,
            Body=file_bytes,
            ContentType=content_type,
        )

        presigned_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket, 'Key': object_key},
            ExpiresIn=expiration_seconds
        )
        return presigned_url

    except NoCredentialsError:
        raise Exception("AWS credentials not found. Please check your environment variables.")
    except ClientError as e:
        raise Exception(f"Failed to upload or generate URL: {e}")


import logging

logger = logging.getLogger(__name__)


def _object_exists(bucket: str, object_key: str) -> bool:
    try:
        s3_client.head_object(Bucket=bucket, Key=object_key)
        return True
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code in ("404", "NoSuchKey", "NotFound"):
            return False
        raise


def get_presigned_url_by_object_key(
    object_key: str,
    expiration_seconds: int = 300,
    bucket_name: Optional[str] = None
) -> Optional[str]:
    """
    Returns a pre-signed URL for an object key if it exists, otherwise None.
    """
    bucket = bucket_name or S3_BUCKET_NAME
    try:
        if not _object_exists(bucket, object_key):
            return None
        return s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket, 'Key': object_key},
            ExpiresIn=expiration_seconds
        )
    except Exception as e:
        logger.error(
            f"[get_presigned_url_by_object_key] Error for key {object_key}: {e}",
            exc_info=True
        )
        return None


def upload_bytes_and_get_presigned_url(
    file_bytes: bytes,
    object_key: str,
    expiration_seconds: int = 300,
    content_type: str = "audio/mpeg",
    bucket_name: Optional[str] = None
) -> str:
    """
    Uploads file bytes to S3 using a specific object key and returns a pre-signed URL.
    """
    bucket = bucket_name or S3_BUCKET_NAME
    try:
        s3_client.put_object(
            Bucket=bucket,
            Key=object_key,
            Body=file_bytes,
            ContentType=content_type,
        )
        return s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket, 'Key': object_key},
            ExpiresIn=expiration_seconds
        )
    except NoCredentialsError:
        raise Exception("AWS credentials not found. Please check your environment variables.")
    except ClientError as e:
        raise Exception(f"Failed to upload or generate URL: {e}")


def get_presigned_url_by_session_id(
        session_id: str,
        expiration_seconds: int = 300,
        bucket_name: Optional[str] = None,
        prefix: str = "sessions",
        extension: str = "mp3"
) -> Optional[str]:
    """
    Finds the audio file with the specified session_id on S3 and returns its presigned URL.
    Returns None if no file is found.

    Args:
        session_id (str): Session ID to look up.
        expiration_seconds (int): How long the pre-signed URL is valid (default: 300 seconds).
        bucket_name (Optional[str]): Optionally override the default bucket.
        prefix (str): Top-level folder in S3 (default: 'sessions').
        extension (str): File extension without the leading dot (default: 'mp3').

    Returns:
        Optional[str]: A pre-signed URL to access the file, or None if not found.
    """
    bucket = bucket_name or S3_BUCKET_NAME
    prefix = f"{prefix}/{session_id}/"

    logger.info(f"[get_presigned_url_by_session_id] Looking for audio file in bucket '{bucket}' with prefix '{prefix}'")

    try:
        response = s3_client.list_objects_v2(Bucket=bucket, Prefix=prefix)
        contents = response.get('Contents', [])

        if not contents:
            logger.info(f"[get_presigned_url_by_session_id] No audio file found for session_id: {session_id}")
            return None

        logger.info(f"[get_presigned_url_by_session_id] Found {len(contents)} files for session_id: {session_id}")

        # Find the latest file by timestamp in the filename
        latest_obj = max(contents, key=lambda x: int(x['Key'].split('/')[-1].split('.')[0]))
        object_key = latest_obj['Key']

        logger.info(f"[get_presigned_url_by_session_id] Latest object key for session_id {session_id}: {object_key}")

        presigned_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket, 'Key': object_key},
            ExpiresIn=expiration_seconds
        )

        logger.info(
            f"[get_presigned_url_by_session_id] Successfully generated presigned URL for session_id: {session_id}")
        return presigned_url

    except Exception as e:
        logger.error(
            f"[get_presigned_url_by_session_id] Error while getting presigned url for session_id {session_id}: {e}",
            exc_info=True)
        return None
