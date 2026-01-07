import React, { useCallback, useRef, useState } from 'react';
import { FiImage, FiFile, FiCheckSquare, FiMapPin, FiPaperclip, FiPlus, FiUpload, FiX } from 'react-icons/fi';
import './widget.css';

const ACCEPTED_FILE_TYPES = {
  'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
  'video/*': ['.mp4', '.webm', '.mov'],
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/plain': ['.txt'],
  'application/zip': ['.zip'],
  'application/x-rar-compressed': ['.rar'],
  'application/x-7z-compressed': ['.7z'],
};

const ACCEPT_ATTRIBUTE = Object.entries(ACCEPTED_FILE_TYPES)
  .flatMap(([type, exts]) => [...exts, type])
  .join(',');

interface FileUploadWidgetProps {
  onUploadSuccess: (file: File) => void;
  onUploadError?: (error: Error) => void;
}

const FileUploadWidget: React.FC<FileUploadWidgetProps> = ({
  onUploadSuccess,
  onUploadError = () => {},
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const isValidType = Object.entries(ACCEPTED_FILE_TYPES).some(([type, exts]) => {
        const typePattern = new RegExp(`^${type.replace('*', '.*')}$`);
        return typePattern.test(file.type) || exts.some(ext => file.name.toLowerCase().endsWith(ext));
      });

      if (!isValidType) {
        onUploadError(new Error('File type not supported'));
        return;
      }

      const MAX_SIZE = 10 * 1024 * 1024; // 10MB
      if (file.size > MAX_SIZE) {
        onUploadError(new Error('File is too large. Maximum size is 10MB.'));
        return;
      }

      onUploadSuccess(file);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const isValidType = Object.entries(ACCEPTED_FILE_TYPES).some(([type, exts]) => {
        const typePattern = new RegExp(`^${type.replace('*', '.*')}$`);
        return typePattern.test(file.type) || exts.some(ext => file.name.toLowerCase().endsWith(ext));
      });

      if (!isValidType) {
        onUploadError(new Error('File type not supported'));
        return;
      }

      const MAX_SIZE = 10 * 1024 * 1024; // 10MB
      if (file.size > MAX_SIZE) {
        onUploadError(new Error('File is too large. Maximum size is 10MB.'));
        return;
      }

      onUploadSuccess(file);
    }
  };

  const renderMenu = () => (
    <div className="widget-menu">
      <div className="widget-menu-header">
        <h3>Add to board</h3>
        <button 
          className="widget-close-button" 
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(false);
          }}
          aria-label="Close menu"
        >
          <FiX />
        </button>
      </div>
      
      <div className="widget-menu-section">
        <h4>Upload</h4>
        <button 
          className="widget-menu-item" 
          onClick={() => fileInputRef.current?.click()}
        >
          <FiImage className="widget-icon" />
          <div className="widget-menu-item-content">
            <span className="widget-menu-item-title">Photo or video</span>
            <span className="widget-menu-item-subtitle">JPG, PNG, GIF, MP4, WebM</span>
          </div>
        </button>
        <button 
          className="widget-menu-item" 
          onClick={() => fileInputRef.current?.click()}
        >
          <FiFile className="widget-icon" />
          <div className="widget-menu-item-content">
            <span className="widget-menu-item-title">Document</span>
            <span className="widget-menu-item-subtitle">PDF, DOC, XLS, TXT</span>
          </div>
        </button>
      </div>
      
      <div className="widget-menu-section">
        <h4>Create</h4>
        <button className="widget-menu-item">
          <FiCheckSquare className="widget-icon" />
          <div className="widget-menu-item-content">
            <span className="widget-menu-item-title">Checklist</span>
            <span className="widget-menu-item-subtitle">Task list with checkboxes</span>
          </div>
        </button>
        <button className="widget-menu-item">
          <FiMapPin className="widget-icon" />
          <div className="widget-menu-item-content">
            <span className="widget-menu-item-title">Location</span>
            <span className="widget-menu-item-subtitle">Add a map or address</span>
          </div>
        </button>
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        accept={ACCEPT_ATTRIBUTE}
        multiple={false}
      />
    </div>
  );

  return (
    <div 
      className={`widget-container ${isDragging ? 'widget-dragging' : ''} ${isOpen ? 'widget-menu-open' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={(e) => {
        if (isOpen && !(e.target as HTMLElement).closest('.widget-menu')) {
          setIsOpen(false);
        }
      }}
      aria-expanded={isOpen}
    >
      <button 
        className={`widget-trigger ${isOpen ? 'widget-trigger-active' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        aria-label={isOpen ? 'Close widget menu' : 'Open widget menu'}
      >
        <FiPlus className="widget-plus-icon" />
      </button>
      
      <div className={`widget-menu-wrapper ${isOpen ? 'widget-menu-visible' : ''}`} onClick={(e) => e.stopPropagation()}>
        {renderMenu()}
      </div>
      
      {isDragging && (
        <div className="widget-drop-zone" onClick={(e) => e.stopPropagation()}>
          <div className="widget-drop-content">
            <FiUpload className="widget-upload-icon" />
            <p>Drop files here to upload</p>
            <p className="widget-drop-hint">Supports images, videos, and documents</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploadWidget;