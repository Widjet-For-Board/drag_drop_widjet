from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import uuid as uuid_lib

from app.core.minio_client import upload_file, init_bucket, get_file_url
from app.db.base import get_db
from app.models.folder import Folder
from app.models.file import File as FileModel
from app.schemas.file import FileResponse

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
        board_id: int,  # Изменили на int
        user_id: int,  # Добавили user_id (вместо owner_id)
        folder_id: Optional[UUID] = None,
        files: List[UploadFile] = File(...),
        db: AsyncSession = Depends(get_db)
):
    """
    Загрузка файлов на доску
    """
    results = []

    for f in files:
        contents = await f.read()

        # Проверка размера файла
        if len(contents) > 150 * 1024 * 1024:
            raise HTTPException(400, "Файл больше 150 МБ")

        # Проверка MIME-типа
        if f.content_type not in ALLOWED_MIME:
            raise HTTPException(400, f"Формат {f.content_type} запрещён")

        # Загрузка файла в MinIO
        stored_name = upload_file(
            contents,
            f.filename or "file",
            f.content_type or "application/octet-stream"
        )

        # Создание записи в БД
        file_record = FileModel(
            id=uuid_lib.uuid4(),
            original_name=f.filename or "file",
            stored_name=stored_name,
            mime_type=f.content_type or "application/octet-stream",
            size=len(contents),
            board_id=board_id,
            user_id=user_id,  # Используем user_id вместо owner_id
            folder_id=folder_id,
            is_favorite=False,
        )

        db.add(file_record)
        await db.commit()
        await db.refresh(file_record)

        # Формирование ответа
        results.append(FileResponse(
            id=file_record.id,
            original_name=file_record.original_name,
            mime_type=file_record.mime_type,
            size=file_record.size,
            folder_id=file_record.folder_id,
            board_id=file_record.board_id,
            user_id=file_record.user_id,  # Добавляем user_id в ответ
            is_favorite=file_record.is_favorite,
            url=get_file_url(stored_name),
            uploaded_at=file_record.uploaded_at
        ))

    return results


# 2. Полное дерево файлов и папок
@router.get("/tree/{board_id}")
async def get_tree(
        board_id: int,  # Изменили на int
        db: AsyncSession = Depends(get_db)
):
    """
    Получение дерева файлов и папок для доски
    """
    # Получаем все папки для этой доски (рекурсивно)
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
        {"board_id": board_id}  # Используем int напрямую
    )
    folders = folders_result.fetchall()

    # Получаем все файлы для этой доски
    files_result = await db.execute(
        text("""
            SELECT id, original_name, mime_type, size, folder_id, 
                   stored_name, is_favorite, user_id
            FROM files 
            WHERE board_id = :board_id
        """),
        {"board_id": board_id}
    )
    files = files_result.fetchall()

    # Строим дерево вручную в Python
    tree = {
        "id": None,
        "name": "root",
        "folders": [],
        "files": []
    }
    folder_map = {None: tree}

    # Строим структуру папок
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

    # Добавляем файлы в соответствующие папки
    for f in files:
        folder_id = str(f.folder_id) if f.folder_id else None
        if folder_id not in folder_map:
            continue  # файл в несуществующей папке — пропускаем

        folder_map[folder_id]["files"].append({
            "id": str(f.id),
            "name": f.original_name,
            "mime_type": f.mime_type,
            "size": f.size,
            "user_id": f.user_id,  # Добавляем user_id
            "url": get_file_url(f.stored_name),
            "is_favorite": bool(f.is_favorite)
        })

    return tree


# 3. Создать папку
@router.post("/folders")
async def create_folder(
        board_id: int,  # Изменили на int
        user_id: int,  # Добавили user_id
        name: str = "Новая папка",
        parent_id: Optional[UUID] = None,
        db: AsyncSession = Depends(get_db)
):
    """
    Создание новой папки
    """
    folder = Folder(
        id=uuid_lib.uuid4(),
        name=name,
        board_id=board_id,
        user_id=user_id,  # Используем user_id вместо owner_id
        parent_id=parent_id,
    )

    db.add(folder)
    await db.commit()
    await db.refresh(folder)

    return {
        "id": str(folder.id),
        "name": name,
        "parent_id": parent_id,
        "board_id": board_id,
        "user_id": user_id
    }


# 4. Переименовать (папка или файл)
@router.patch("/rename")
async def rename_item(
        item_id: UUID,
        name: str,
        item_type: str = "file",  # item_type: "file" или "folder"
        db: AsyncSession = Depends(get_db)
):
    """
    Переименование файла или папки
    """
    if item_type == "folder":
        item = await db.get(Folder, item_id)
        if not item:
            raise HTTPException(404, "Папка не найдена")
        item.name = name
    else:
        item = await db.get(FileModel, item_id)
        if not item:
            raise HTTPException(404, "Файл не найден")
        item.original_name = name

    await db.commit()
    return {"success": True, "new_name": name}


# 5. Удалить
@router.delete("/items/{item_id}")
async def delete_item(
        item_id: UUID,
        item_type: str = "file",
        db: AsyncSession = Depends(get_db)
):
    """
    Удаление файла или папки
    """
    if item_type == "folder":
        folder = await db.get(Folder, item_id)
        if not folder:
            raise HTTPException(404, "Папка не найдена")

        # Проверяем, пустая ли папка
        files_count = await db.execute(
            text("SELECT COUNT(*) FROM files WHERE folder_id = :folder_id"),
            {"folder_id": item_id}
        )
        count = files_count.scalar()

        if count > 0:
            raise HTTPException(400, "Папка не пустая. Удалите сначала файлы.")

        await db.delete(folder)

    else:
        file = await db.get(FileModel, item_id)
        if not file:
            raise HTTPException(404, "Файл не найден")

        # Удаляем файл из MinIO
        from app.core.minio_client import client as minio_client
        try:
            minio_client.remove_object("board-files", file.stored_name)
        except Exception as e:
            print(f"Ошибка при удалении файла из MinIO: {e}")

        await db.delete(file)

    await db.commit()
    return {"success": True}


# 6. Переместить
@router.post("/move")
async def move_items(
        items: List[dict],  # [{"id": UUID, "type": "file"|"folder", "target_folder_id": UUID|null}]
        db: AsyncSession = Depends(get_db)
):
    """
    Перемещение файлов и папок
    """
    for item in items:
        item_id = UUID(item["id"]) if isinstance(item["id"], str) else item["id"]
        target_folder_id = item.get("target_folder_id")

        if target_folder_id:
            target_folder_id = UUID(target_folder_id) if isinstance(target_folder_id, str) else target_folder_id

        if item["type"] == "folder":
            obj = await db.get(Folder, item_id)
            if obj:
                obj.parent_id = target_folder_id
        else:
            obj = await db.get(FileModel, item_id)
            if obj:
                obj.folder_id = target_folder_id

    await db.commit()
    return {"success": True, "moved_items": len(items)}


# 7. Получить информацию о файле
@router.get("/{file_id}")
async def get_file_info(
        file_id: UUID,
        db: AsyncSession = Depends(get_db)
):
    """
    Получение информации о конкретном файле
    """
    file = await db.get(FileModel, file_id)
    if not file:
        raise HTTPException(404, "Файл не найден")

    return {
        "id": file.id,
        "original_name": file.original_name,
        "mime_type": file.mime_type,
        "size": file.size,
        "board_id": file.board_id,
        "user_id": file.user_id,
        "folder_id": file.folder_id,
        "is_favorite": file.is_favorite,
        "uploaded_at": file.uploaded_at,
        "url": get_file_url(file.stored_name)
    }


# 8. Получить файлы пользователя на доске
@router.get("/user/{user_id}/board/{board_id}")
async def get_user_files_on_board(
        user_id: int,
        board_id: int,
        db: AsyncSession = Depends(get_db)
):
    """
    Получение файлов конкретного пользователя на доске
    """
    result = await db.execute(
        text("""
            SELECT id, original_name, mime_type, size, folder_id, 
                   is_favorite, uploaded_at, stored_name
            FROM files 
            WHERE user_id = :user_id AND board_id = :board_id
            ORDER BY uploaded_at DESC
        """),
        {"user_id": user_id, "board_id": board_id}
    )

    files = result.fetchall()

    return [
        {
            "id": str(f.id),
            "original_name": f.original_name,
            "mime_type": f.mime_type,
            "size": f.size,
            "folder_id": str(f.folder_id) if f.folder_id else None,
            "is_favorite": f.is_favorite,
            "uploaded_at": f.uploaded_at.isoformat() if f.uploaded_at else None,
            "url": get_file_url(f.stored_name)
        }
        for f in files
    ]


# 9. Добавить/удалить из избранного
@router.post("/{file_id}/favorite")
async def toggle_favorite(
        file_id: UUID,
        favorite: bool,
        db: AsyncSession = Depends(get_db)
):
    """
    Добавление/удаление файла из избранного
    """
    file = await db.get(FileModel, file_id)
    if not file:
        raise HTTPException(404, "Файл не найден")

    file.is_favorite = favorite
    await db.commit()

    return {"success": True, "is_favorite": file.is_favorite}


# 10. Получить избранные файлы
@router.get("/board/{board_id}/favorites")
async def get_favorites(
        board_id: int,
        db: AsyncSession = Depends(get_db)
):
    """
    Получение избранных файлов на доске
    """
    result = await db.execute(
        text("""
            SELECT id, original_name, mime_type, size, user_id, 
                   folder_id, uploaded_at, stored_name
            FROM files 
            WHERE board_id = :board_id AND is_favorite = true
            ORDER BY uploaded_at DESC
        """),
        {"board_id": board_id}
    )

    files = result.fetchall()

    return [
        {
            "id": str(f.id),
            "original_name": f.original_name,
            "mime_type": f.mime_type,
            "size": f.size,
            "user_id": f.user_id,
            "folder_id": str(f.folder_id) if f.folder_id else None,
            "uploaded_at": f.uploaded_at.isoformat() if f.uploaded_at else None,
            "url": get_file_url(f.stored_name)
        }
        for f in files
    ]


# 11. Поиск файлов
@router.get("/search")
async def search_files(
        board_id: int,
        query: str,
        db: AsyncSession = Depends(get_db)
):
    """
    Поиск файлов на доске
    """
    result = await db.execute(
        text("""
            SELECT id, original_name, mime_type, size, user_id, 
                   folder_id, is_favorite, uploaded_at, stored_name
            FROM files 
            WHERE board_id = :board_id 
            AND original_name ILIKE :query
            ORDER BY uploaded_at DESC
        """),
        {"board_id": board_id, "query": f"%{query}%"}
    )

    files = result.fetchall()

    return [
        {
            "id": str(f.id),
            "original_name": f.original_name,
            "mime_type": f.mime_type,
            "size": f.size,
            "user_id": f.user_id,
            "folder_id": str(f.folder_id) if f.folder_id else None,
            "is_favorite": f.is_favorite,
            "uploaded_at": f.uploaded_at.isoformat() if f.uploaded_at else None,
            "url": get_file_url(f.stored_name)
        }
        for f in files
    ]