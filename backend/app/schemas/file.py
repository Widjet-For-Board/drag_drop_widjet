from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional

class FileResponse(BaseModel):
    id: UUID = Field(..., description="ID файла")
    original_name: str = Field(..., description="Оригинальное имя файла")
    mime_type: str = Field(..., description="MIME-тип")
    size: int = Field(..., description="Размер в байтах")
    folder_id: Optional[UUID] = Field(None, description="ID родительской папки")
    board_id: UUID = Field(..., description="ID доски")
    is_favorite: bool = Field(default=False, description="В избранном?")
    url: str = Field(..., description="Ссылка на скачивание")
    uploaded_at: datetime = Field(default_factory=datetime.utcnow, description="Дата загрузки")

    class Config:
        from_attributes = True
