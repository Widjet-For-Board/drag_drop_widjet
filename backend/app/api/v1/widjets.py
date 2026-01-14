# app/api/v1/widgets.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import List, Dict, Any
import httpx
import asyncio

from app.db.base import get_db
from app.schemas.widget import WidgetInfoRequest, WidgetInfoResponse
from app.models.widget import WidgetInfo

router = APIRouter(prefix="/widgets", tags=["widgets"])

# Конфигурация внешней платформы
EXTERNAL_PLATFORM_URL = "http://45.155.69.187:9999"
TIMEOUT = 10.0  # таймаут в секундах


@router.post("/getInfo", response_model=Dict[str, Any])
async def get_info_from_external(
        request_data: Dict[str, Any]  # Данные от фронтенда для запроса к платформе
):
    """
    Прокси-эндпоинт: получает данные от фронтенда,
    делает запрос к внешней платформе,
    возвращает ответ фронтенду
    """
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            # Делаем запрос к внешней платформе
            response = await client.post(
                f"{EXTERNAL_PLATFORM_URL}/getInfo",
                json=request_data,
                headers={"Content-Type": "application/json"}
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"External platform error: {response.text}"
                )

            return response.json()

    except httpx.TimeoutException:
        raise HTTPException(504, "External platform timeout")
    except Exception as e:
        raise HTTPException(500, f"Error contacting external platform: {str(e)}")


@router.post("/info", response_model=WidgetInfoResponse)
async def save_widget_info(
        widget_data: WidgetInfoRequest,
        db: AsyncSession = Depends(get_db)
):
    """
    Сохранение информации о виджете (вызывается после получения данных с платформы)
    """
    try:
        print(f"[WIDGET INFO] Received widget data: {widget_data.widgetId}")
        print(f"[WIDGET INFO] Board ID: {widget_data.board.id}")
        print(f"[WIDGET INFO] User ID: {widget_data.userId}")

        # Сохраняем информацию в базу
        widget_record = WidgetInfo(
            widget_id=widget_data.widgetId,
            user_id=widget_data.userId,
            role=widget_data.role,
            config=widget_data.config,
            board_id=widget_data.board.id,
            board_name=widget_data.board.name,
            board_parent_id=widget_data.board.parentId
        )

        db.add(widget_record)
        await db.commit()
        await db.refresh(widget_record)

        # Создаем начальную структуру для доски
        await initialize_board_structure(
            db=db,
            board_id=widget_data.board.id,
            user_id=widget_data.userId
        )

        return WidgetInfoResponse(
            message=f"Widget info saved successfully. Board: {widget_data.board.id}, User: {widget_data.userId}"
        )

    except Exception as e:
        print(f"[WIDGET INFO ERROR] {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save widget info: {str(e)}")


async def initialize_board_structure(
        db: AsyncSession,
        board_id: int,
        user_id: int
):
    """
    Инициализация начальной структуры для новой доски
    """
    try:
        # Проверяем, есть ли уже папки для этой доски
        result = await db.execute(
            text("SELECT COUNT(*) FROM folders WHERE board_id = :board_id"),
            {"board_id": board_id}
        )
        count = result.scalar()

        if count == 0:
            # Создаем корневую папку для доски
            from app.models.folder import Folder
            import uuid as uuid_lib

            root_folder = Folder(
                id=uuid_lib.uuid4(),
                name=f"Board {board_id}",
                board_id=board_id,
                user_id=user_id,
                parent_id=None
            )

            db.add(root_folder)
            await db.commit()
            print(f"[INIT] Created root folder for board {board_id}")

    except Exception as e:
        print(f"[INIT ERROR] Failed to initialize board structure: {e}")
        # Не прерываем основной процесс из-за этой ошибки


@router.get("/info/board/{board_id}")
async def get_widgets_by_board(
        board_id: int,
        db: AsyncSession = Depends(get_db)
):
    """
    Получение информации о виджетах на доске
    """
    result = await db.execute(
        text("""
            SELECT widget_id, user_id, role, board_name, 
                   received_at, stored_at, config
            FROM widgets_info 
            WHERE board_id = :board_id 
            ORDER BY received_at DESC
        """),
        {"board_id": board_id}
    )

    widgets = result.fetchall()

    return [
        {
            "widget_id": w.widget_id,
            "user_id": w.user_id,
            "role": w.role,
            "board_name": w.board_name,
            "received_at": w.received_at.isoformat() if w.received_at else None,
            "stored_at": w.stored_at.isoformat() if w.stored_at else None,
            "config": w.config if w.config else {}
        }
        for w in widgets
    ]


@router.get("/getCurrentContext", response_model=Dict[str, Any])
async def get_current_context(request: Request):
    """
    Эндпоинт для получения текущего контекста (boardId, userId)
    В реальном приложении здесь должна быть логика аутентификации
    и получения данных из сессии/токена
    """
    try:
        # В реальном приложении здесь нужно:
        # 1. Проверить аутентификацию (через JWT, сессию и т.д.)
        # 2. Получить данные пользователя из БД
        # 3. Получить данные о текущей доске

        # Для демонстрации возвращаем тестовые данные
        # В реальности эти данные должны приходить из:
        # - Токена авторизации
        # - Параметров запроса
        # - Сессии пользователя

        # Пример: получение из заголовков
        auth_header = request.headers.get("Authorization")
        board_id_header = request.headers.get("X-Board-ID")

        # Пример логики (замените на реальную)
        if board_id_header:
            board_id = int(board_id_header)
        else:
            # Если нет заголовка - используем демо данные
            board_id = 789  # Пример ID доски

        # Аналогично для пользователя
        user_id = 456  # Пример ID пользователя

        return {
            "boardId": board_id,
            "userId": user_id,
            "boardName": f"Board {board_id}",
            "userRole": "editor",
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get context: {str(e)}")


# Эндпоинт для фронтенда, чтобы получить все данные за один запрос
@router.post("/getInfoAndSave")
async def get_info_and_save(
        request_data: Dict[str, Any],  # Данные для запроса к внешней платформе
        db: AsyncSession = Depends(get_db)
):
    """
    Комбинированный эндпоинт:
    1. Делает запрос к внешней платформе
    2. Сохраняет полученные данные в нашу БД
    3. Возвращает данные фронтенду
    """
    try:
        # 1. Запрос к внешней платформе
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.post(
                f"{EXTERNAL_PLATFORM_URL}/getInfo",
                json=request_data,
                headers={"Content-Type": "application/json"}
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"External platform error: {response.text}"
                )

            platform_data = response.json()

        # 2. Сохранение в нашу БД
        # Преобразуем данные в формат WidgetInfoRequest
        widget_data = WidgetInfoRequest(**platform_data)

        widget_record = WidgetInfo(
            widget_id=widget_data.widgetId,
            user_id=widget_data.userId,
            role=widget_data.role,
            config=widget_data.config,
            board_id=widget_data.board.id,
            board_name=widget_data.board.name,
            board_parent_id=widget_data.board.parentId
        )

        db.add(widget_record)
        await db.commit()
        await db.refresh(widget_record)

        # 3. Инициализация структуры доски
        await initialize_board_structure(
            db=db,
            board_id=widget_data.board.id,
            user_id=widget_data.userId
        )

        # 4. Возвращаем данные фронтенду
        return {
            "success": True,
            "widget_info": platform_data,
            "saved_id": str(widget_record.id),
            "message": f"Widget info saved for board {widget_data.board.id}"
        }

    except httpx.TimeoutException:
        raise HTTPException(504, "External platform timeout")
    except Exception as e:
        await db.rollback()
        raise HTTPException(500, f"Error: {str(e)}")

