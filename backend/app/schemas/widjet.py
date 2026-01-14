from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime


class BoardInfo(BaseModel):
    id: int = Field(..., description="ID доски")
    name: str = Field(..., description="Название доски")
    parentId: Optional[int] = Field(None, description="ID родительской доски")


class WidgetInfoRequest(BaseModel):
    widgetId: int = Field(..., description="ID виджета")
    userId: int = Field(..., description="ID пользователя")
    role: str = Field(..., description="Роль пользователя")
    config: Dict[str, Any] = Field(..., description="Конфигурация виджета")
    board: BoardInfo = Field(..., description="Информация о доске")


class PlatformRequest(BaseModel):
    """Модель запроса к внешней платформе"""
    widget_type: str = Field(..., description="Тип виджета")
    user_token: Optional[str] = Field(None, description="Токен пользователя")
    board_token: Optional[str] = Field(None, description="Токен доски")
    additional_data: Optional[Dict[str, Any]] = Field(default_factory=dict)


class WidgetInfoResponse(BaseModel):
    success: bool = Field(default=True)
    message: str = Field(default="Widget info received")
    received_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True