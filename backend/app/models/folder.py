from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from app.db.base import Base

class Folder(Base):
    __tablename__ = "folders"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, default="Новая папка")
    parent_id = Column(UUID(as_uuid=True), ForeignKey("folders.id"), nullable=True)
    board_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    owner_id = Column(UUID(as_uuid=True), nullable=False)

    children = relationship("Folder", backref="parent", remote_side=[id])
    files = relationship("File", back_populates="folder", cascade="all, delete-orphan")