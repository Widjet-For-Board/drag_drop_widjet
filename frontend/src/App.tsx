import { useCallback, useRef, useMemo, useEffect, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  NodeResizer,
  type Node as FlowNode,
  type Edge as FlowEdge,
  type Connection,
  type NodeProps,
} from '@xyflow/react';
import FileUploadWidget from './widget/widget';
import '@xyflow/react/dist/style.css';

const API_BASE = 'http://localhost:8000/api/v1/files';

interface CustomNodeData {
  label: string;
  url?: string;
  [key: string]: any; // Добавляем индексную сигнатуру
}

type CustomNode = FlowNode<CustomNodeData>;
type CustomEdge = FlowEdge;

function App() {
  const [boardId, setBoardId] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<CustomNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CustomEdge>([]);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Получаем board_id от платформы через postMessage
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      // В реальной платформе будет что-то вроде { type: 'boardContext', boardId: '...' }
      if (event.data && event.data.boardId) {
        setBoardId(event.data.boardId);
        console.log('Получен boardId от платформы:', event.data.boardId);
      }
    };

    window.addEventListener('message', handler);

    // Запросим boardId у платформы (стандарт для Miro-like)
    window.parent.postMessage({ type: 'getBoardContext' }, '*');

    return () => window.removeEventListener('message', handler);
  }, []);

  // Для локального теста — fallback на тестовый ID
  useEffect(() => {
    if (!boardId) {
      // Если платформа не ответила — используем тестовый
      const fallback = '11111111-1111-1111-1111-111111111111';
      setBoardId(fallback);
      console.log('Используем fallback boardId:', fallback);
    }
  }, [boardId]);

  // Загрузка дерева только когда есть boardId
  useEffect(() => {
    if (!boardId) return;

    const loadTree = async () => {
      try {
        const res = await fetch(`${API_BASE}/tree/${boardId}`);
        if (!res.ok) throw new Error('Failed to load tree');
        const tree = await res.json();

        const newNodes: CustomNode[] = [];
        const newEdges: CustomEdge[] = [];

        const traverse = (folder: any, parentId: string | null = null, x = 100, y = 100) => {
          const folderId = folder.id || 'root';
          newNodes.push({
            id: folderId,
            type: 'folderNode',
            position: { x, y },
            data: { label: folder.name || 'Root' },
          });

          if (parentId) {
            newEdges.push({ id: `e-${parentId}-${folderId}`, source: parentId, target: folderId });
          }

          // Файлы
          folder.files?.forEach((file: any, i: number) => {
            const type = file.mime_type.startsWith('image/') ? 'imageNode' :
                         file.mime_type.startsWith('video/') ? 'videoNode' : 'fileNode';

            newNodes.push({
              id: file.id,
              type,
              position: { x: x + 400, y: y + i * 150 },
              data: { label: file.name, url: file.url },
            });
            newEdges.push({ id: `e-${folderId}-${file.id}`, source: folderId, target: file.id });
          });

          // Папки
          folder.folders?.forEach((child: any, i: number) => {
            traverse(child, folderId, x + 400, y + i * 200);
          });
        };

        traverse(tree);
        setNodes(newNodes);
        setEdges(newEdges);
      } catch (err) {
        console.error('Tree load error:', err);
      }
    };

    loadTree();
  }, [boardId, setNodes, setEdges]);

  const handleUploadSuccess = async (file: File) => {
    if (!boardId) {
      alert('boardId не определён');
      return;
    }

    const formData = new FormData();
    formData.append('files', file);

    try {
      const res = await fetch(`${API_BASE}/upload?board_id=${boardId}`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');
      const uploaded = (await res.json())[0];

      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      const position = {
        x: (bounds?.width || 800) / 2 - 150,
        y: (bounds?.height || 600) / 2 - 100,
      };

      const type = uploaded.mime_type.startsWith('image/') ? 'imageNode' :
                   uploaded.mime_type.startsWith('video/') ? 'videoNode' : 'fileNode';

      const newNode: CustomNode = {
        id: uploaded.id,
        type,
        position,
        data: { label: uploaded.original_name, url: uploaded.url },
      };

      setNodes((nds) => [...nds, newNode]);
    } catch (err) {
      alert('Ошибка загрузки');
    }
  };

  const handleUploadError = (error: Error) => {
    alert(`Ошибка: ${error.message}`);
  };

  // Кастомные ноды
  const FolderNode = ({ data }: NodeProps<CustomNode>) => (
    <div className="bg-blue-900 p-6 rounded-lg border-4 border-blue-500 text-white text-xl text-center font-bold">
      📁 {data.label}
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Top} />
      <Handle type="target" position={Position.Bottom} />
    </div>
  );

  const ImageNode = ({ data, selected }: NodeProps<CustomNode>) => (
    <div className="bg-gray-900 rounded-lg border-2 border-indigo-600 p-2">
      {selected && <NodeResizer minWidth={200} minHeight={150} />}
      <img src={data.url} alt={data.label} className="max-w-full max-h-full object-contain" />
      <div className="text-white text-center mt-2">{data.label}</div>
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Top} />
      <Handle type="target" position={Position.Bottom} />
    </div>
  );

  const VideoNode = ({ data }: NodeProps<CustomNode>) => (
    <div className="bg-gray-900 rounded-lg border-2 border-indigo-600 p-2">
      <video src={data.url} controls className="w-full" />
      <div className="text-white text-center mt-2">{data.label}</div>
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Top} />
      <Handle type="target" position={Position.Bottom} />
    </div>
  );

  const FileNode = ({ data }: NodeProps<CustomNode>) => (
    <div className="bg-gray-900 rounded-lg border-2 border-indigo-600 p-8 flex flex-col items-center text-white">
      <div className="text-6xl">📄</div>
      <div className="mt-4 text-center">{data.label}</div>
      <a href={data.url} target="_blank" rel="noopener noreferrer" className="mt-4 text-blue-400 underline">
        Открыть файл
      </a>
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Top} />
      <Handle type="target" position={Position.Bottom} />
    </div>
  );

  const nodeTypes = useMemo(
    () => ({
      folderNode: FolderNode,
      imageNode: ImageNode,
      videoNode: VideoNode,
      fileNode: FileNode,
    }),
    []
  );

  return (
    <div className="w-screen h-screen">
      <div ref={reactFlowWrapper} className="w-full h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
        >
          <Controls />
          <MiniMap />
          <Background />
        </ReactFlow>
      </div>

      <div className="absolute bottom-8 right-8 z-10">
        <FileUploadWidget
          onUploadSuccess={handleUploadSuccess}
          onUploadError={handleUploadError}
        />
      </div>
    </div>
  );
}

export default App;