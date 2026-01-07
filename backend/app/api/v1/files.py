from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List, Optional
from uuid import UUID
from app.core.minio_client import upload_file, init_bucket, get_file_url
from app.db.base import AsyncSessionLocal
from app.models.folder import Folder
from app.models.file import File
from app.schemas.file import FileResponse
from sqlalchemy import text
import uuid as uuid_lib

router = APIRouter(prefix="/files", tags=["files"])

ALLOWED_MIME = {
    "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/svg+xml",
    "video/mp4", "video/quicktime", "video/webm",
    "audio/mpeg", "audio/mp3",
    "application/pdf", "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip"
}


@router.on_event("startup")
async def startup_event():
    init_bucket()


# 1. Загрузка файлов
@router.post("/upload", response_model=List[FileResponse])
async def upload_files(
        board_id: UUID,
        folder_id: Optional[UUID] = None,
        files: List[UploadFile] = File(),
):
    results = []
    async with AsyncSessionLocal() as db:
        for f in files:
            contents = await f.read()
            if len(contents) > 150 * 1024 * 1024:
                raise HTTPException(400, "Файл больше 150 МБ")
            if f.content_type not in ALLOWED_MIME:
                raise HTTPException(400, f"Формат {f.content_type} запрещён")

            stored_name = upload_file(contents, f.filename or "file", f.content_type or "application/octet-stream")

            file_record = File(
                id=uuid_lib.uuid4(),
                original_name=f.filename or "file",
                stored_name=stored_name,
                mime_type=f.content_type or "application/octet-stream",
                size=len(contents),
                board_id=board_id,
                folder_id=folder_id,
                owner_id=UUID("00000000-0000-0000-0000-000000000001"),
                is_favorite=False,
            )
            db.add(file_record)
            await db.commit()
            await db.refresh(file_record)

            results.append(FileResponse(
                id=file_record.id,
                original_name=file_record.original_name,
                mime_type=file_record.mime_type,
                size=file_record.size,
                folder_id=file_record.folder_id,
                board_id=file_record.board_id,
                is_favorite=file_record.is_favorite,
                url=get_file_url(stored_name),
                uploaded_at=file_record.uploaded_at
            ))
    return results


# 2. Полное дерево файлов и папок
@router.get("/tree/{board_id}")
async def get_tree(board_id: UUID):
    async with AsyncSessionLocal() as db:
        # Сначала получаем все папки
        folders_result = await db.execute(
            text("""
                WITH RECURSIVE folder_tree AS (
                    SELECT id, name, parent_id, board_id
                    FROM folders 
                    WHERE board_id = :board_id AND parent_id IS NULL
                    UNION ALL
                    SELECT f.id, f.name, f.parent_id, f.board_id
                    FROM folders f
                    JOIN folder_tree ft ON f.parent_id = ft.id
                    WHERE f.board_id = :board_id
                )
                SELECT id, name, parent_id FROM folder_tree
            """),
            {"board_id": str(board_id)}
        )
        folders = folders_result.fetchall()

        # Получаем все файлы для этой доски
        files_result = await db.execute(
            text("SELECT id, original_name, mime_type, size, folder_id, stored_name, is_favorite "
                 "FROM files WHERE board_id = :board_id"),
            {"board_id": str(board_id)}
        )
        files = files_result.fetchall()

        # Строим дерево вручную в Python
        tree = {"id": None, "name": "root", "folders": [], "files": []}
        folder_map = {None: tree}

        for f in folders:
            folder_id = str(f.id)
            parent_id = str(f.parent_id) if f.parent_id else None
            folder_map[folder_id] = {
                "id": folder_id,
                "name": f.name,
                "folders": [],
                "files": []
            }
            folder_map[parent_id]["folders"].append(folder_map[folder_id])

        for f in files:
            folder_id = str(f.folder_id) if f.folder_id else None
            if folder_id not in folder_map:
                continue  # файл в несуществующей папке — пропускаем
            folder_map[folder_id]["files"].append({
                "id": str(f.id),
                "name": f.original_name,
                "mime_type": f.mime_type,
                "size": f.size,
                "url": get_file_url(f.stored_name),
                "is_favorite": bool(f.is_favorite)
            })

        return tree


# 3. Создать папку
@router.post("/folders")
async def create_folder(board_id: UUID, parent_id: Optional[UUID] = None, name: str = "Новая папка"):
    async with AsyncSessionLocal() as db:
        folder = Folder(
            id=uuid_lib.uuid4(),
            name=name,
            board_id=board_id,
            parent_id=parent_id,
            owner_id=UUID("00000000-0000-0000-0000-000000000001")
        )
        db.add(folder)
        await db.commit()
        return {"id": str(folder.id), "name": name, "parent_id": parent_id}


# 4. Переименовать (папка или файл)
@router.patch("/rename")
async def rename_item(item_id: UUID, name: str, item_type: str = "file"):  # item_type: "file" или "folder"
    async with AsyncSessionLocal() as db:
        if item_type == "folder":
            item = await db.get(Folder, item_id)
        else:
            item = await db.get(File, item_id)
        if not item:
            raise HTTPException(404, "Не найдено")
        if item_type == "file":
            item.original_name = name
        else:
            item.name = name
        await db.commit()
        return {"success": True}


# 5. Удалить
@router.delete("/items/{item_id}")
async def delete_item(item_id: UUID, item_type: str = "file"):
    async with AsyncSessionLocal() as db:
        if item_type == "folder":
            folder = await db.get(Folder, item_id)
            if folder:
                await db.delete(folder)
        else:
            file = await db.get(File, item_id)
            if file:
                from app.core.minio_client import client as minio_client
                minio_client.remove_object("board-files", file.stored_name)
                await db.delete(file)
        await db.commit()
        return {"success": True}


# 6. Переместить
@router.post("/move")
async def move_items(items: List[dict]):  # [{"id": UUID, "type": "file"|"folder", "target_folder_id": UUID|null}]
    async with AsyncSessionLocal() as db:
        for item in items:
            if item["type"] == "folder":
                obj = await db.get(Folder, item["id"])
                if obj: obj.parent_id = item.get("target_folder_id")
            else:
                obj = await db.get(File, item["id"])
                if obj: obj.folder_id = item.get("target_folder_id")
        await db.commit()
        return {"success": True}