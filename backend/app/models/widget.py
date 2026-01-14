from sqlalchemy import Column, Integer, String, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from app.db.base import Base


class WidgetInfo(Base):
    __tablename__ = "widgets_info"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    widget_id = Column(Integer, nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    role = Column(String, nullable=False)
    config = Column(JSON, nullable=False)
    board_id = Column(Integer, nullable=False, index=True)
    board_name = Column(String, nullable=False)
    board_parent_id = Column(Integer, nullable=True)
    received_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    stored_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)