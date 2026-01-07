from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.db.base import Base

class File(Base):
    __tablename__ = "files"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    original_name = Column(String, nullable=False)
    stored_name = Column(String, nullable=False)      # имя в MinIO
    mime_type = Column(String, nullable=False)
    size = Column(Integer, nullable=False)
    folder_id = Column(UUID(as_uuid=True), ForeignKey("folders.id"), nullable=True)
    board_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    owner_id = Column(UUID(as_uuid=True), nullable=False)
    is_favorite = Column(Boolean, default=False)
    uploaded_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    folder = relationship("Folder", back_populates="files")