from minio import Minio
from app.core.config import settings
import uuid
from io import BytesIO

client = Minio(
    "minio:9000",
    access_key=settings.MINIO_ACCESS_KEY,
    secret_key=settings.MINIO_SECRET_KEY,
    secure=False,
)

BUCKET_NAME = "board-files"

def init_bucket():
    try:
        if not client.bucket_exists(BUCKET_NAME):
            client.make_bucket(BUCKET_NAME)
        # Делаем бакет публичным — ВСЁ!
        client.set_bucket_policy(
            BUCKET_NAME,
            '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":"*","Action":["s3:GetObject"],"Resource":["arn:aws:s3:::' + BUCKET_NAME + '/*"]}]}'
        )
    except Exception as e:
        print(f"MinIO init:", e)

def upload_file(file_data: bytes, filename: str, content_type: str) -> str:
    object_name = f"{uuid.uuid4()}-{filename}"
    client.put_object(
        BUCKET_NAME,
        object_name,
        BytesIO(file_data),
        len(file_data),
        content_type=content_type,
    )
    return object_name

def get_file_url(object_name: str) -> str:
    return f"http://localhost:9000/{BUCKET_NAME}/{object_name}"
