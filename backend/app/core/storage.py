import os
import datetime

from dotenv import load_dotenv

load_dotenv()

GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./workspace_uploads")

# Module-level GCS client/bucket, initialized lazily
_gcs_bucket = None


def _get_gcs_bucket():
    global _gcs_bucket
    if _gcs_bucket is None:
        from google.cloud import storage

        client = storage.Client()
        _gcs_bucket = client.bucket(GCS_BUCKET_NAME)
    return _gcs_bucket


def upload_file(file_bytes: bytes, destination_path: str, content_type: str) -> str:
    """Upload file bytes to GCS (if configured) or local filesystem.

    Returns the storage URI: a gs:// path for GCS, or a local file path.
    """
    if GCS_BUCKET_NAME:
        bucket = _get_gcs_bucket()
        blob = bucket.blob(destination_path)
        blob.upload_from_string(file_bytes, content_type=content_type)
        return f"gs://{GCS_BUCKET_NAME}/{destination_path}"

    # Fallback: local filesystem
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    local_path = os.path.join(UPLOAD_DIR, destination_path)
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    with open(local_path, "wb") as f:
        f.write(file_bytes)
    return local_path


def get_file_url(path: str) -> str:
    """Return a URL for the given storage path.

    For GCS paths (gs://...), generates a signed URL valid for 1 hour.
    For local paths, returns the path as-is.
    """
    if path.startswith("gs://"):
        # Parse bucket and blob name from gs:// URI
        without_scheme = path[len("gs://"):]
        bucket_name, blob_name = without_scheme.split("/", 1)

        from google.cloud import storage

        client = storage.Client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(blob_name)
        return blob.generate_signed_url(
            version="v4",
            expiration=datetime.timedelta(hours=1),
            method="GET",
        )

    # Local path — return as-is
    return path
