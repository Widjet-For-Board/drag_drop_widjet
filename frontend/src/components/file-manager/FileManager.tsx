import { useState, useEffect } from 'react';
import { FiFolder, FiFile, FiUpload, FiTrash2, FiEdit2, FiChevronRight, FiChevronUp, FiFolderPlus, FiX, FiDownload } from 'react-icons/fi';
import axios from 'axios';

interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  size?: number;
  createdAt: string;
  updatedAt: string;
  url?: string;
  mime_type?: string;
}

interface FileManagerProps {
  // Сделаем пропсы опциональными, так как компонент сам их получит
  initialBoardId?: number;    // Можно передать извне, если уже известны
  initialUserId?: number;     // Можно передать извне, если уже известны
  widgetId?: number;
  boardName?: string;
  role?: string;
  apiBaseUrl?: string;
}

const DEFAULT_API_BASE_URL = 'http://localhost:8000/api/v1';

const FileManager = ({
  initialBoardId,
  initialUserId,
  widgetId = Date.now(),
  boardName = '',
  role = 'editor',
  apiBaseUrl = DEFAULT_API_BASE_URL
}: FileManagerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [, setBreadcrumbs] = useState<Array<{ name: string; path: string; id: string | null }>>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Состояния для boardId и userId
  const [boardId, setBoardId] = useState<number | null>(initialBoardId || null);
  const [userId, setUserId] = useState<number | null>(initialUserId || null);
  const [loadingContext, setLoadingContext] = useState(!initialBoardId || !initialUserId);

  // Получаем контекст (boardId и userId) при инициализации
  useEffect(() => {
    const fetchContextData = async () => {
      // Если уже переданы через пропсы - используем их
      if (initialBoardId && initialUserId) {
        setBoardId(initialBoardId);
        setUserId(initialUserId);
        setLoadingContext(false);
        return;
      }

      try {
        setLoadingContext(true);

        // Пытаемся получить из localStorage
        const savedBoardId = localStorage.getItem('fileManager_boardId');
        const savedUserId = localStorage.getItem('fileManager_userId');

        if (savedBoardId && savedUserId) {
          setBoardId(parseInt(savedBoardId));
          setUserId(parseInt(savedUserId));
          setLoadingContext(false);
          return;
        }

        // Если нет в localStorage, делаем API запрос
        const response = await axios.get(`${apiBaseUrl}/widgets/getCurrentContext`, {
          headers: {
            'Accept': 'application/json'
          }
        });

        if (response.data.boardId && response.data.userId) {
          const { boardId: fetchedBoardId, userId: fetchedUserId } = response.data;

          setBoardId(fetchedBoardId);
          setUserId(fetchedUserId);

          // Сохраняем для будущего использования
          localStorage.setItem('fileManager_boardId', fetchedBoardId.toString());
          localStorage.setItem('fileManager_userId', fetchedUserId.toString());
        }
      } catch (err) {
        console.error('Error fetching context:', err);
        setError('Failed to load context. Using demo data.');

        // Fallback для разработки
        setBoardId(1);
        setUserId(1);

        // Сохраняем fallback значения
        localStorage.setItem('fileManager_boardId', '1');
        localStorage.setItem('fileManager_userId', '1');
      } finally {
        setLoadingContext(false);
      }
    };

    fetchContextData();
  }, [initialBoardId, initialUserId, apiBaseUrl]);

  // Сохраняем widget info на бэкенде после получения данных
  useEffect(() => {
    const saveWidgetInfo = async () => {
      if (!boardId || !userId) return;

      try {
        await axios.post(`${apiBaseUrl}/widgets/info`, {
          widgetId,
          userId,
          role,
          config: {},
          board: {
            id: boardId,
            name: boardName || `Board ${boardId}`,
            parentId: null
          }
        });
        console.log('Widget info saved');
      } catch (err) {
        console.error('Error saving widget info:', err);
        // Не прерываем работу из-за этой ошибки
      }
    };

    if (boardId && userId) {
      saveWidgetInfo();
    }
  }, [boardId, userId, widgetId, role, boardName, apiBaseUrl]);

  // Fetch files when path or boardId changes
  useEffect(() => {
    if (boardId && !loadingContext) {
      fetchFiles();
    }
  }, [currentPath, boardId, loadingContext, apiBaseUrl]);

  const formatDate = (dateString?: string): string | null => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return !isNaN(date.getTime()) ? date.toLocaleString() : null;
    } catch (e) {
      return null;
    }
  };

  const processFolder = (folder: any, targetPath: string = '', currentPath: string = ''): any[] => {
    const items: any[] = [];

    if (!targetPath || currentPath === targetPath) {
      if (folder.files && Array.isArray(folder.files)) {
        items.push(...folder.files.map((file: any) => ({
          id: file.id || '',
          name: file.name || 'Unnamed file',
          type: 'file' as const,
          path: currentPath,
          size: file.size || 0,
          created_at: formatDate(file.created_at) || new Date().toLocaleString(),
          updated_at: formatDate(file.updated_at) || new Date().toLocaleString(),
          mime_type: file.mime_type || '',
          url: file.url || ''
        })));
      }

      if (folder.folders && Array.isArray(folder.folders)) {
        folder.folders.forEach((subfolder: any) => {
          items.push({
            id: subfolder.id || '',
            name: subfolder.name || 'Unnamed folder',
            type: 'folder' as const,
            path: currentPath,
            size: 0,
            created_at: formatDate(subfolder.created_at) || new Date().toLocaleString(),
            updated_at: formatDate(subfolder.updated_at) || new Date().toLocaleString()
          });
        });
      }

      return items;
    }

    const pathParts = targetPath.split('/').filter(Boolean);
    const currentPart = pathParts[0];
    const remainingPath = pathParts.slice(1).join('/');

    if (folder.folders && Array.isArray(folder.folders)) {
      const nextFolder = folder.folders.find((f: any) => f.name === currentPart);
      if (nextFolder) {
        const newCurrentPath = currentPath ? `${currentPath}/${nextFolder.name}` : nextFolder.name;
        return processFolder(nextFolder, remainingPath, newCurrentPath);
      }
    }

    return [];
  };

  const fetchFiles = async () => {
    if (!boardId) return;

    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${apiBaseUrl}/files/tree/${boardId}`, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      const itemsToShow = processFolder(response.data || {}, currentPath);
      setFiles(itemsToShow);
    } catch (err) {
      console.error('Error fetching files:', err);
      setError('Не удалось загрузить файлы');
    } finally {
      setLoading(false);
    }
  };

  const handleFileClick = (file: FileItem) => {
    if (file.type === 'folder') {
      const newPath = currentPath ? `${currentPath}/${file.name}` : file.name;
      setCurrentPath(newPath);
      setCurrentFolderId(file.id);

      setBreadcrumbs(prev => [
        ...prev,
        { name: file.name, path: newPath, id: file.id }
      ]);
    } else if (file.url) {
      window.open(file.url, '_blank');
    }
  };

  const navigateToRoot = () => {
    setCurrentPath('');
    setCurrentFolderId(null);
    setBreadcrumbs([]);
    fetchFiles();
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0 || !boardId || !userId) return;

    const formData = new FormData();
    Array.from(uploadedFiles).forEach(file => {
      formData.append('files', file);
    });

    try {
      setIsUploading(true);
      setUploadProgress(0);

      const queryString = new URLSearchParams();
      queryString.append('board_id', boardId.toString());
      queryString.append('user_id', userId.toString());

      if (currentFolderId) {
        queryString.append('folder_id', currentFolderId);
      }

      await axios.post(
        `${apiBaseUrl}/files/upload?${queryString}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Accept': 'application/json'
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(progress);
            }
          },
        }
      );

      await fetchFiles();
    } catch (err) {
      console.error('Error uploading file:', err);
      setError('Ошибка при загрузке файла');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (event.target) event.target.value = '';
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setError('Введите название папки');
      return;
    }

    if (!boardId || !userId) {
      setError('Не удалось определить ID доски или пользователя');
      return;
    }

    try {
      const url = new URL(`${apiBaseUrl}/files/folders`);
      url.searchParams.append('board_id', boardId.toString());
      url.searchParams.append('user_id', userId.toString());
      url.searchParams.append('name', newFolderName.trim());

      if (currentFolderId) {
        url.searchParams.append('parent_id', currentFolderId);
      }

      await axios.post(
        url.toString(),
        {},
        {
          headers: {
            'Accept': 'application/json'
          },
          validateStatus: (status) => status === 200 || status === 201
        }
      );

      setNewFolderName('');
      setIsCreatingFolder(false);
      await fetchFiles();
    } catch (err: any) {
      console.error('Error creating folder:', err);
      const errorMessage = err.response?.data?.detail?.[0]?.msg ||
        err.response?.data?.message ||
        err.message ||
        'Ошибка при создании папки';
      setError(`Ошибка при создании папки: ${errorMessage}`);
    }
  };

  const handleDelete = async (file: FileItem) => {
    if (!window.confirm(`Вы уверены, что хотите удалить ${file.name}?`)) return;

    try {
      const url = new URL(`${apiBaseUrl}/files/items/${file.id}`);

      if (file.type === 'folder') {
        url.searchParams.append('item_type', 'folder');
      }

      await axios.delete(url.toString(), {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      await fetchFiles();
    } catch (err) {
      console.error('Error deleting:', err);
      setError('Ошибка при удалении');
    }
  };

  const startRenaming = (file: FileItem) => {
    setSelectedFile(file);
    setNewName(file.name);
    setIsRenaming(true);
  };

  const handleRename = async () => {
    if (!selectedFile || !newName.trim()) return;

    try {
      const url = new URL(`${apiBaseUrl}/files/rename`);
      url.searchParams.append('item_id', selectedFile.id);
      url.searchParams.append('name', newName.trim());
      url.searchParams.append('item_type', selectedFile.type);

      await axios({
        method: 'patch',
        url: url.toString(),
        headers: {
          'Accept': 'application/json'
        },
        validateStatus: (status) => status === 200
      });

      setIsRenaming(false);
      setSelectedFile(null);
      setNewName('');
      await fetchFiles();
    } catch (err: any) {
      console.error('Error renaming:', err);
      const errorMessage = err.response?.data?.detail?.[0]?.msg ||
        err.response?.data?.message ||
        err.message ||
        'Ошибка при переименовании';
      setError(`Ошибка при переименовании: ${errorMessage}`);
    }
  };

  const navigateUp = () => {
    if (!currentPath) return;
    const pathParts = currentPath.split('/').filter(Boolean);
    pathParts.pop();
    setCurrentPath(pathParts.join('/'));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderBreadcrumbs = () => {
    if (!currentPath) return null;
    currentPath.split('/').filter(Boolean);
    return null;
  };

  // Показываем loading пока получаем контекст
  if (loadingContext) {
    return (
      <div className="file-manager">
        <button className="file-manager-toggle" disabled>
          <FiFolder className="mr-2" />
          Loading...
        </button>
      </div>
    );
  }

  return (
    <div className="file-manager">
      <div className="file-navigation">
        {renderBreadcrumbs()}
      </div>
      <button
        className="file-manager-toggle"
        onClick={() => setIsOpen(!isOpen)}
      >
        <FiFolder className="mr-2" />
        File Manager
      </button>

      {isOpen && (
        <div className="file-manager-modal">
          <div className="file-manager-header">
            <h3>File Manager</h3>
            <button
              className="close-button"
              onClick={() => {
                setIsOpen(false);
                setIsCreatingFolder(false);
                setIsRenaming(false);
                setSelectedFile(null);
              }}
            >
              <FiX />
            </button>
          </div>

          <div className="file-manager-toolbar">
            <button
              className="toolbar-button"
              onClick={navigateUp}
              disabled={!currentPath}
              title="Go up"
            >
              <FiChevronUp />
            </button>
            <div className="path-display">
              <span
                className="path-part"
                onClick={navigateToRoot}
                style={{ cursor: 'pointer' }}
              >
                Root
              </span>
              {currentPath && currentPath.split('/').filter(Boolean).map((part, index, array) => {
                const path = array.slice(0, index + 1).join('/');
                return (
                  <span key={index}>
                    <span className="path-separator">/</span>
                    <span
                      className="path-part"
                      onClick={() => setCurrentPath(path)}
                      style={{ cursor: 'pointer' }}
                    >
                      {part}
                    </span>
                  </span>
                );
              })}
            </div>
            <div className="toolbar-actions">
              <label className="toolbar-button" title="Upload files">
                <FiUpload />
                <input
                  type="file"
                  multiple
                  onChange={handleUpload}
                  style={{ display: 'none' }}
                  disabled={isUploading}
                />
              </label>
              <button
                className="toolbar-button"
                onClick={() => {
                  setIsCreatingFolder(true);
                  setIsRenaming(false);
                  setSelectedFile(null);
                }}
                title="New folder"
              >
                <FiFolderPlus />
              </button>
            </div>
          </div>

          {isUploading && (
            <div className="upload-progress">
              <div
                className="progress-bar"
                style={{ width: `${uploadProgress}%` }}
              ></div>
              <span>Uploading... {uploadProgress}%</span>
            </div>
          )}

          {isCreatingFolder && (
            <div className="create-folder">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                autoFocus
              />
              <button onClick={handleCreateFolder}>Create</button>
              <button onClick={() => setIsCreatingFolder(false)}>Cancel</button>
            </div>
          )}

          {isRenaming && selectedFile && (
            <div className="rename-dialog">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                autoFocus
              />
              <button onClick={handleRename}>Rename</button>
              <button onClick={() => setIsRenaming(false)}>Cancel</button>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <div className="file-list">
            {loading ? (
              <div className="loading">Loading...</div>
            ) : files.length === 0 ? (
              <div className="empty-folder">This folder is empty</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Size</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.id} className="file-item">
                      <td>
                        <div
                          className="file-name"
                          onClick={() => handleFileClick(file)}
                          style={{ cursor: 'pointer' }}
                        >
                          {file.type === 'folder' ? (
                            <>
                              <FiFolder className="file-icon" />
                              <span>{file.name}</span>
                              <FiChevronRight className="folder-arrow" />
                            </>
                          ) : (
                            <>
                              <FiFile className="file-icon" />
                              <span>{file.name}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td>{file.size ? formatFileSize(file.size) : '-'}</td>
                      <td className="file-actions">
                        {file.type === 'file' && (
                          <a
                            href={`${file.url}`}
                            download={file.name}
                            className="action-button"
                            title="Download"
                          >
                            <FiDownload size={16} />
                          </a>
                        )}
                        <button
                          className="action-button"
                          onClick={() => startRenaming(file)}
                          title="Rename"
                        >
                          <FiEdit2 size={16} />
                        </button>
                        <button
                          className="action-button danger"
                          onClick={() => handleDelete(file)}
                          title="Delete"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileManager;