import { useCallback, useRef, useState, useMemo } from 'react';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
  Handle,
  Position,
  NodeResizer,
  NodeToolbar,
} from '@xyflow/react';
import FileUploadWidget from './widget/widget';
import '@xyflow/react/dist/style.css';

// Mock server implementation
const mockServer = {
  uploadFile: async (file: File) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          file: {
            name: file.name,
            type: file.type,
            size: file.size,
            previewUrl: URL.createObjectURL(file)
          }
        });
      }, 500);
    });
  }
};

// const initialNodes: Node[] = [];
// const initialEdges: Edge[] = [];

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleUploadSuccess = async (file: File) => {
    if (!reactFlowWrapper.current) {
      console.error('React Flow wrapper not found');
      return;
    }
    
    console.log('Uploading file:', file.name, 'type:', file.type);
    
    const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
    const position = {
      x: (reactFlowBounds.width / 2) - 100,
      y: (reactFlowBounds.height / 2) - 50,
    };

    const fileType = file.type.startsWith('image/') ? 'image' : 
                    file.type.startsWith('video/') ? 'video' : 'file';
    
    const fileUrl = URL.createObjectURL(file);
    console.log('Creating node with type:', fileType + 'Node');
    
    const newNode = {
      id: `node-${Date.now()}`,
      type: fileType + 'Node',
      position,
      data: { 
        label: file.name,
        url: fileUrl,
        type: file.type,
        width: 200,
        height: fileType === 'image' ? 150 : 100,
      },
      style: {
        width: 200,
        height: fileType === 'image' ? 150 : 100,
        border: '2px solid #3b5bdb',
        borderRadius: '8px',
        backgroundColor: '#1e1e2d',
      },
      ...defaultNodeOptions,
    };

    console.log('Adding new node:', newNode);
    setNodes((nds) => [...nds, newNode]);
  };

  const handleUploadError = (error: Error) => {
    console.error('Upload failed:', error);
    alert(`Upload failed: ${error.message}`);
  };

  // Custom node components with connection handles
  const BaseNode = ({ data, children, selected }: { data: any; children: React.ReactNode; selected?: boolean }) => (
    <div className="relative w-full h-full">
      <NodeResizer isVisible={selected} minWidth={150} minHeight={100} />
      <div className="w-full h-full flex flex-col">
        <div className="text-xs text-gray-400 mb-1 truncate">{data.label}</div>
        <div className="flex-1 flex items-center justify-center overflow-hidden">
          {children}
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="w-2 h-2" />
      <Handle type="target" position={Position.Left} className="w-2 h-2" />
      <Handle type="source" position={Position.Top} className="w-2 h-2" />
      <Handle type="target" position={Position.Bottom} className="w-2 h-2" />
    </div>
  );

  const ImageNode = ({ data, selected, id }: { data: any; selected?: boolean; id: string }) => {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          padding: '10px',
          backgroundColor: '#1e1e2d',
          borderRadius: '8px',
          border: `2px solid ${selected ? '#3b82f6' : '#3b5bdb'}`,
          boxSizing: 'border-box',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {selected && (
          <NodeResizer
            minWidth={100}
            minHeight={100}
            lineStyle={{
              borderColor: '#3b82f6',
              borderWidth: '1px',
            }}
            handleStyle={{
              width: '12px',
              height: '12px',
              border: '2px solid white',
              borderRadius: '2px',
              backgroundColor: '#3b82f6',
            }}
          />
        )}
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}>
          <img
            src={data.url}
            alt={data.label}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
            draggable={false}
          />
        </div>
      </div>
    );
  };

  const VideoNode = ({ data }: { data: any }) => (
    <div style={{ 
      width: '100%', 
      height: '100%',
      padding: '10px',
      backgroundColor: '#1e1e2d',
      borderRadius: '8px',
      border: '2px solid #3b5bdb'
    }}>
      <video 
        src={data.url} 
        controls 
        style={{ 
          width: '100%', 
          height: '100%',
          objectFit: 'contain'
        }}
      />
    </div>
  );

  const FileNode = ({ data }: { data: any }) => (
    <div style={{ 
      width: '100%', 
      height: '100%',
      padding: '20px',
      backgroundColor: '#1e1e2d',
      borderRadius: '8px',
      border: '2px solid #3b5bdb',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '48px' }}>📄</div>
      <div style={{ 
        marginTop: '10px',
        color: '#e2e8f0',
        fontSize: '14px',
        wordBreak: 'break-word',
        maxWidth: '100%',
        padding: '0 10px'
      }}>
        {data.label}
      </div>
    </div>
  );

  const nodeTypes = useMemo(
    () => ({
      imageNode: ImageNode,
      videoNode: VideoNode,
      fileNode: FileNode,
    }),
    []
  );
  
  // Node default options
  const defaultNodeOptions = {
    style: { width: 200, height: 150 },
    selectable: true,
    connectable: true,
  };

  // Debug info
  console.log('Rendering App with nodes:', nodes);
  console.log('Node types:', Object.keys(nodeTypes));

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={reactFlowWrapper} style={{ width: '100%', height: '100%' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            nodesDraggable
            nodesConnectable
            elementsSelectable
            defaultEdgeOptions={{
              style: { stroke: '#3b5bdb', strokeWidth: 2 },
              animated: true,
            }}
            nodeExtent={[
              [0, 0],
              [10000, 10000],
            ]}
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#f8fafc'
            }}
          >
            <Controls />
            <MiniMap />
            <Background gap={12} size={1} />
          </ReactFlow>
        </div>

        <div style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          zIndex: 10
        }}>
          <FileUploadWidget
            apiEndpoint="/api/upload"
            onUploadSuccess={handleUploadSuccess}
            onUploadError={handleUploadError}
          />
        </div>
      </div>
    </div>
  );
}

export default App;