import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { ReactFlow, Controls, Background, useNodesState, useEdgesState, addEdge, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { getModelOptions, MODEL_REGISTRY } from './config/modelRegistry';
import { calculatePreviewCost, formatCost } from './pricing/PricingEngine';
import { X, CheckCircle } from 'lucide-react';

const getDriveDisplayUrl = (url) => {
  if (!url) return '';
  if (url.includes('supabase.co') || url.includes('unsplash.com')) return url;
  const match = url.match(/id=([^&]+)/);
  if (match) {
    const gDriveUrl = `https://drive.google.com/uc?id=${match[1]}`;
    return `https://wsrv.nl/?url=${encodeURIComponent(gDriveUrl)}&output=webp`;
  }
  return url;
};

const CustomNode = ({ data }) => {
  return (
    <div 
      style={{ 
        background: '#050508', 
        border: `1px solid ${data.color || '#333'}`, 
        borderRadius: '8px', 
        padding: '12px', 
        minWidth: '180px', 
        color: 'white', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '8px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
      }}
      className="custom-flow-node"
    >
      <Handle type="target" position={Position.Left} style={{ background: '#fff', width: '12px', height: '12px', left: '-6px' }}>
         <div style={{ position: 'absolute', top: -10, left: -10, right: -10, bottom: -10, cursor: 'crosshair' }}></div>
      </Handle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ fontSize: '10px', color: data.color || '#aaa', textTransform: 'uppercase', fontWeight: 600 }}>{data.typeLabel}</div>
            {data.media?.actual_cost != null ? (
              <span style={{ fontSize: '9px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '1px 4px', borderRadius: '3px', border: '1px solid rgba(16, 185, 129, 0.3)' }}><CheckCircle size={16} className="lucide-icon" /> {formatCost(data.media.actual_cost)}</span>
            ) : (
              <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.05)', color: '#888', padding: '1px 4px', borderRadius: '3px' }}>Est: {formatCost(calculatePreviewCost(data.modelId, { ...data.rawData?.settings, prompt: data.prompt }))}</span>
            )}
          </div>
          <select 
            className="select-mini nodrag" 
            style={{ fontSize: '9px', padding: '2px 4px', background: 'rgba(255,255,255,0.1)', color: '#ccc', border: 'none', borderRadius: '4px', maxWidth: '100px', position: 'relative', zIndex: 10 }}
            value={data.modelId || ''}
            onChange={(e) => data.onChangeNodeModel(data.id, data.typeLabel, e.target.value)}
          >
            {data.typeLabel !== 'Video' && MODEL_REGISTRY.image.map(cat => (
              <optgroup key={cat.company} label={`[ ${cat.company} ]`}>
                {cat.models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </optgroup>
            ))}
            {data.typeLabel === 'Video' && MODEL_REGISTRY.video.map(cat => (
              <optgroup key={cat.company} label={`[ ${cat.company} ]`}>
                {cat.models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        
        {getModelOptions(data.modelId, data.typeLabel?.toLowerCase()).length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
            {getModelOptions(data.modelId, data.typeLabel?.toLowerCase()).map(opt => (
              <div key={opt.key} style={{ display: 'flex', flexDirection: 'column' }}>
                 <label style={{ fontSize: '8px', color: '#888', textTransform: 'uppercase', marginBottom: '2px' }}>{opt.label}</label>
                 <select 
                   className="nodrag"
                   style={{ fontSize: '9px', padding: '2px', background: 'rgba(255,255,255,0.05)', color: '#ccc', border: '1px solid #333', borderRadius: '4px' }}
                   value={data.rawData?.settings?.[opt.key] || opt.default}
                   onChange={(e) => data.onChangeNodeSettings(data.id, data.typeLabel, { ...(data.rawData?.settings || {}), [opt.key]: e.target.value })}
                 >
                   {opt.options.map(o => <option key={o} value={o}>{o}</option>)}
                 </select>
              </div>
            ))}
          </div>
        )}
      </div>
      {data.media && data.media.thumbnailLink ? (
        <div style={{ position: 'relative', width: '100%', height: '140px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #333' }}>
          {data.media.mimeType && data.media.mimeType.includes('video') ? (
            <video src={getDriveDisplayUrl(data.media.webViewLink || data.media.thumbnailLink)} autoPlay loop muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <img src={getDriveDisplayUrl(data.media.thumbnailLink)} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
          <a href={data.media.webViewLink || '#'} target="_blank" rel="noreferrer" style={{
            position: 'absolute', bottom: '6px', right: '6px', background: 'rgba(0,0,0,0.7)', color: '#00f0ff', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', textDecoration: 'none', fontWeight: 'bold', border: '1px solid currentColor', display: 'flex', alignItems: 'center', gap: '4px'
          }}>
            HQ
          </a>
        </div>
      ) : (
        <div style={{ width: '100%', height: '140px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', border: '1px dashed #333', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px' }}>
          <div style={{color: '#444', fontSize: '10px', textTransform: 'uppercase'}}>No Render Yet</div>
          {data.prompt && (
            <div style={{ fontSize: '9px', color: '#666', fontStyle: 'italic', maxHeight: '50px', overflow: 'hidden', padding: '0 10px', textAlign: 'center' }}>{data.prompt}</div>
          )}
        </div>
      )}
      
      {data.errorMedia && (
        <div style={{ width: '100%', marginTop: '4px' }}>
           <div style={{ fontSize: '9px', color: '#ff6b6b', marginBottom: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <span style={{ flex: 1, wordBreak: 'break-word' }}><X size={16} className="lucide-icon" /> {data.errorMedia.statusMessage || 'Generation failed'}</span>
           </div>
           <div style={{ height: '4px', background: '#333', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#ff4444', width: '100%' }} />
           </div>
        </div>
      )}
      {data.processingMedia && !data.errorMedia && (
        <div style={{ width: '100%', marginTop: '4px' }}>
           <div style={{ fontSize: '9px', color: '#ccc', marginBottom: '2px', display: 'flex', justifyContent: 'space-between' }}>
             <span>{data.processingMedia.statusMessage || 'Processing...'}</span>
             <span>{data.processingMedia.progress}%</span>
           </div>
           <div style={{ height: '4px', background: '#333', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: data.color || '#1890ff', width: `${data.processingMedia.progress || 0}%`, transition: 'width 0.3s ease' }} />
           </div>
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: '#fff', width: '12px', height: '12px', right: '-6px' }}>
         <div style={{ position: 'absolute', top: -10, left: -10, right: -10, bottom: -10, cursor: 'crosshair' }}></div>
      </Handle>
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

export default function NodeCanvas({ data, media, onChange, onGenerateNode }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);

  useEffect(() => {
    // Only rebuild if the number of items changes to avoid destroying pan/zoom while editing
    const currentTotal = nodes.length;
    const incomingTotal = (data.characters?.length || 0) + (data.props?.length || 0) + (data.environments?.length || 0) + (data.shots?.length || 0) + (data.videos?.length || 0);
    
    // We update contents but preserve positions if possible
    const startY = 50;
    let charX = 50, propX = 250, envX = 450;
    const newNodes = [];
    const newEdges = [];

    const getNewNodePosition = (defaultX, defaultY) => {
      if (selectedNode) {
        let testX = selectedNode.position.x + 300;
        let testY = selectedNode.position.y;
        const checkCollision = (n) => Math.abs(n.position.x - testX) < 50 && Math.abs(n.position.y - testY) < 50;
        while (newNodes.some(checkCollision) || nodes.some(checkCollision)) {
          testX += 250;
        }
        return { x: testX, y: testY };
      }
      return { x: defaultX, y: defaultY };
    };

    const onChangeNodeModel = (id, typeLabel, newModelId) => {
      const typeArgsMap = { 'Character': 'characters', 'Prop': 'props', 'Environment': 'environments', 'Shot': 'shots', 'Video': 'videos' };
      const collectionKey = typeArgsMap[typeLabel];
      const newCollection = [...data[collectionKey]];
      const idx = newCollection.findIndex(item => item.id === id);
      if (idx >= 0) {
        newCollection[idx] = { ...newCollection[idx], modelId: newModelId };
        onChange({ ...data, [collectionKey]: newCollection });
      }
    };

    const onChangeNodeSettings = (id, typeLabel, newSettings) => {
      const typeArgsMap = { 'Character': 'characters', 'Prop': 'props', 'Environment': 'environments', 'Shot': 'shots', 'Video': 'videos' };
      const collectionKey = typeArgsMap[typeLabel];
      const newCollection = [...data[collectionKey]];
      const idx = newCollection.findIndex(item => item.id === id);
      if (idx >= 0) {
        newCollection[idx] = { ...newCollection[idx], settings: newSettings };
        onChange({ ...data, [collectionKey]: newCollection });
      }
    };

    const extractEdges = (item, color) => {
      const deps = [
        ...(item.relatedNodes || []), 
        ...(item.relatedCharacters || []), 
        ...(item.relatedProps || []), 
        ...(item.relatedEnvironments || []), 
        ...(item.relatedShots || []), 
        ...(item.relatedVideos || [])
      ];
      [...new Set(deps)].forEach(depId => {
        newEdges.push({
          id: `e-${depId}-${item.id}`,
          source: depId,
          target: item.id,
          animated: true,
          style: { stroke: color, strokeWidth: 2 }
        });
      });
    };

    const addGroup = (items, typeLabel, color, isTarget, startX, startYPos) => {
      (items || []).forEach((item, idx) => {
        const existingNode = nodes.find(n => n.id === item.id);
        const position = existingNode ? existingNode.position : getNewNodePosition(startX + (idx % 3) * 200, startYPos + Math.floor(idx / 3) * 150);
        
        newNodes.push({
          id: item.id,
          type: 'custom',
          position,
          data: { label: item.name || item.id, typeLabel, color, media: existingNode?.data?.media, processingMedia: existingNode?.data?.processingMedia, errorMedia: existingNode?.data?.errorMedia, prompt: item.prompt || item.beat, isTarget, rawData: item, modelId: item.modelId, onChangeNodeModel, onChangeNodeSettings }
        });

        extractEdges(item, color);
      });
    };

    addGroup(data.characters, 'Character', '#ff4d4f', false, charX, startY);
    const propStartY = startY + Math.ceil((data.characters || []).length / 3) * 150 + 50;
    addGroup(data.props, 'Prop', '#d4b106', false, propX, propStartY);
    const envStartY = propStartY + Math.ceil((data.props || []).length / 3) * 150 + 50;
    addGroup(data.environments, 'Environment', '#52c41a', false, envX, envStartY);

    const shotStartY = envStartY + Math.ceil((data.environments || []).length / 3) * 150 + 150;
    (data.shots || []).forEach((s, idx) => {
      const existingNode = nodes.find(n => n.id === s.id);
      const position = existingNode ? existingNode.position : getNewNodePosition(50 + (idx % 4) * 220, shotStartY + Math.floor(idx / 4) * 250);
      
      newNodes.push({
        id: s.id,
        type: 'custom',
        position,
        data: { label: s.id, typeLabel: 'Shot', color: '#1890ff', media: existingNode?.data?.media, processingMedia: existingNode?.data?.processingMedia, errorMedia: existingNode?.data?.errorMedia, prompt: s.beat, isTarget: true, rawData: s, modelId: s.modelId, onChangeNodeModel, onChangeNodeSettings }
      });
      extractEdges(s, '#1890ff');
    });

    const videoStartY = shotStartY + Math.ceil((data.shots || []).length / 4) * 250 + 150;
    (data.videos || []).forEach((v, idx) => {
      const existingNode = nodes.find(n => n.id === v.id);
      const position = existingNode ? existingNode.position : getNewNodePosition(50 + (idx % 4) * 220, videoStartY + Math.floor(idx / 4) * 250);
      
      newNodes.push({
        id: v.id,
        type: 'custom',
        position,
        data: { label: v.id, typeLabel: 'Video', color: '#9254de', media: existingNode?.data?.media, processingMedia: existingNode?.data?.processingMedia, errorMedia: existingNode?.data?.errorMedia, prompt: v.prompt, isTarget: true, rawData: v, modelId: v.modelId, onChangeNodeModel, onChangeNodeSettings }
      });
      extractEdges(v, '#9254de');
    });

    setNodes(newNodes);
    setEdges(newEdges);
    
    // Update selected node data if it's currently selected
    if (selectedNode) {
       const updated = newNodes.find(n => n.id === selectedNode.id);
       if (updated) setSelectedNode(updated);
    }
  }, [data]); // Removed media to prevent DOM rebuilds on every progress tick

  // Dedicated fast-path for media updates
  useEffect(() => {
    setNodes(nds => nds.map(node => {
      const activeMedia = media.find(m => m.task_id === node.id && m.status === 'ready');
      const processingMedia = media.find(m => m.task_id === node.id && m.status === 'processing');
      const errorMedia = media.find(m => m.task_id === node.id && m.status === 'error');
      
      if (node.data.media?.id === activeMedia?.id && 
          node.data.processingMedia?.progress === processingMedia?.progress &&
          node.data.errorMedia?.id === errorMedia?.id) {
        return node;
      }
      return {
        ...node,
        data: {
          ...node.data,
          media: activeMedia,
          processingMedia,
          errorMedia
        }
      };
    }));
  }, [media, setNodes]);

  const onConnect = useCallback((params) => {
    // Determine which is target and source
    const targetNode = nodes.find(n => n.id === params.target);
    const sourceNode = nodes.find(n => n.id === params.source);
    if (!targetNode || !sourceNode) return;

    // Use a central edge list if possible, or append to source-specific property
    const sourceType = sourceNode.data.typeLabel;
    const targetType = targetNode.data.typeLabel;

    const typeToKey = {
      'Character': 'characters',
      'Prop': 'props',
      'Environment': 'environments',
      'Shot': 'shots',
      'Video': 'videos'
    };

    const targetListKey = typeToKey[targetType];
    const safeSourceExt = 'relatedNodes';

    if (targetListKey) {
        const list = [...(data[targetListKey] || [])];
        const idx = list.findIndex(n => n.id === targetNode.id);
        if (idx >= 0) {
            list[idx][safeSourceExt] = [...new Set([...(list[idx][safeSourceExt] || []), sourceNode.id])];
            onChange({ ...data, [targetListKey]: list });
        }
    }
  }, [nodes, data, onChange]);

  const onNodeClick = (e, node) => {
    setSelectedNode(node);
  };

  const onNodesDelete = useCallback((deleted) => {
    let newData = { ...data };
    deleted.forEach(node => {
      const typeArgsMap = { 'Character': 'characters', 'Prop': 'props', 'Environment': 'environments', 'Shot': 'shots', 'Video': 'videos' };
      const collectionKey = typeArgsMap[node.data.typeLabel];
      if (collectionKey && newData[collectionKey]) {
        newData[collectionKey] = newData[collectionKey].filter(item => item.id !== node.id);
      }
    });
    // Optional: could manually clean up edge references, but useEffect builder skips missing dependents anyway.
    onChange(newData);
    setSelectedNode(null);
  }, [data, onChange]);

  const onEdgesDelete = useCallback((deletedEdges) => {
    let newData = { ...data };
    deletedEdges.forEach(edge => {
      const targetNode = nodes.find(n => n.id === edge.target);
      const sourceNode = nodes.find(n => n.id === edge.source);
      if (!targetNode || !sourceNode) return;

      const typeToKey = {
        'Character': 'characters', 'Prop': 'props', 'Environment': 'environments', 'Shot': 'shots', 'Video': 'videos'
      };
      
      const targetListKey = typeToKey[targetNode.data.typeLabel];
      if (targetListKey && newData[targetListKey]) {
          const list = [...newData[targetListKey]];
          const idx = list.findIndex(n => n.id === targetNode.id);
          if (idx >= 0) {
              list[idx] = { ...list[idx] };
              // Clean globally from all legacy and new ref arrays
              ['relatedNodes', 'relatedCharacters', 'relatedProps', 'relatedEnvironments', 'relatedShots', 'relatedVideos'].forEach(ext => {
                  if(list[idx][ext]) list[idx][ext] = list[idx][ext].filter(id => id !== edge.source);
              });
              newData[targetListKey] = list;
          }
      }
    });

    onChange(newData);
  }, [nodes, data, onChange]);

  const handleUpdateNode = (field, value) => {
    if (!selectedNode) return;
    const typeArgsMap = {
      'Character': 'characters',
      'Prop': 'props',
      'Environment': 'environments',
      'Shot': 'shots',
      'Video': 'videos'
    };
    const collectionKey = typeArgsMap[selectedNode.data.typeLabel];
    const newCollection = [...data[collectionKey]];
    const idx = newCollection.findIndex(item => item.id === selectedNode.id);
    if (idx >= 0) {
      newCollection[idx] = { ...newCollection[idx], [field]: value };
      onChange({ ...data, [collectionKey]: newCollection });
    }
  };

  const addNewNode = (typeLabel) => {
    const id = `${typeLabel.substring(0,4).toUpperCase()}_${Math.random().toString(36).slice(2,6).toUpperCase()}`;
    const typeArgsMap = { 'Character': 'characters', 'Prop': 'props', 'Environment': 'environments', 'Shot': 'shots', 'Video': 'videos' };
    const collectionKey = typeArgsMap[typeLabel];
    
    let newItem = { id, name: `New ${typeLabel}`, prompt: '', modelId: 'fal-ai/flux-pro/v1.1-ultra' };
    if (typeLabel === 'Shot') newItem = { id, beat: 'New Shot baes on inputs', modelId: 'fal-ai/flux-pro/v1.1-ultra' };
    if (typeLabel === 'Video') newItem = { id, prompt: 'Final output instructions', modelId: 'fal-ai/bytedance/seedance-2.0/image-to-video' };

    onChange({ ...data, [collectionKey]: [...(data[collectionKey] || []), newItem] });
  };

  const handleEdgeDelete = useCallback((event, edge) => {
    if (event) event.preventDefault(); // Prevent default browser context menu for right click
    // Re-use onEdgesDelete logic
    onEdgesDelete([edge]);
  }, [onEdgesDelete]);

  return (
    <div style={{ display: 'flex', width: '100%', height: 'calc(100vh - 56px)', background: '#050508' }}>
      <style>{`
        select.select-mini option { background-color: #1a1a1a; color: #fff; }
      `}</style>
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeContextMenu={handleEdgeDelete}
          onEdgeDoubleClick={handleEdgeDelete}
          nodeTypes={nodeTypes}
          snapToGrid={true}
          snapGrid={[20, 20]}
          fitView
          fitViewOptions={{ padding: 0.2 }}
        >
          <Controls />
          <Background color="#333" gap={16} />
          
          {/* Top Panel for Toolbar */}
          <div style={{ position: 'absolute', top: 20, left: 20, background: 'rgba(20,20,20,0.8)', padding: '10px', borderRadius: '8px', zIndex: 5, border: '1px solid #333', display: 'flex', gap: '8px' }}>
             <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '11px', background: '#ff4d4f' }} onClick={() => addNewNode('Character')}>+ CHARACTER</button>
             <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '11px', background: '#d4b106' }} onClick={() => addNewNode('Prop')}>+ PROP</button>
             <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '11px', background: '#52c41a' }} onClick={() => addNewNode('Environment')}>+ ENVIRONMENT</button>
             <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '11px', background: '#1890ff' }} onClick={() => addNewNode('Shot')}>+ SHOT</button>
             <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '11px', background: '#9254de' }} onClick={() => addNewNode('Video')}>+ VIDEO</button>
          </div>
        </ReactFlow>
      </div>

      {/* Side Panel for Editing */}
      {selectedNode && (
        <div style={{ width: '380px', background: '#111', borderLeft: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
           <div style={{ padding: '20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between' }}>
             <h3 style={{ margin: 0, textTransform: 'uppercase', fontSize: '14px', color: selectedNode.data.color }}>{selectedNode.data.typeLabel} PROPERTIES</h3>
             <button style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }} onClick={() => setSelectedNode(null)}><X size={16} className="lucide-icon" /></button>
           </div>
           
           <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, overflowY: 'auto' }}>
             <div className="form-group">
               <label>ID</label>
               <input disabled className="input-field mono" value={selectedNode.id} />
             </div>

             {selectedNode.data.typeLabel !== 'Shot' && selectedNode.data.typeLabel !== 'Video' && (
               <div className="form-group">
                 <label>Name</label>
                 <input className="input-field" value={selectedNode.data.rawData.name || ''} onChange={(e) => handleUpdateNode('name', e.target.value)} />
               </div>
             )}

             <div className="form-group">
               <label>{selectedNode.data.typeLabel === 'Shot' ? 'Beat / Action' : 'Prompt'}</label>
               <textarea rows={5} className="script-textarea" value={selectedNode.data.rawData.prompt || selectedNode.data.rawData.beat || ''} onChange={(e) => handleUpdateNode(selectedNode.data.typeLabel === 'Shot' ? 'beat' : 'prompt', e.target.value)} />
             </div>

             {selectedNode.data.typeLabel === 'Shot' && (
               <div className="form-group">
                 <label>Camera Move</label>
                 <input className="input-field" value={selectedNode.data.rawData.cameraMove || ''} onChange={(e) => handleUpdateNode('cameraMove', e.target.value)} />
               </div>
             )}

             {selectedNode.data.media?.thumbnailLink && (
               <div style={{ marginTop: '10px' }}>
                 <label style={{ fontSize: '10px', textTransform: 'uppercase', color: '#888', marginBottom: '8px', display: 'block' }}>Current Render</label>
                 <img src={getDriveDisplayUrl(selectedNode.data.media.thumbnailLink)} style={{ width: '100%', borderRadius: '8px', border: '1px solid #333' }} />
               </div>
             )}
             
             <div style={{ marginTop: 'auto', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button className="btn-primary" style={{ width: '100%', background: selectedNode.data.color }} onClick={() => onGenerateNode ? onGenerateNode(selectedNode) : alert('Generator not attached.')}>ACTION PREVIEW</button>
                <button className="btn-primary" style={{ width: '100%', background: 'rgba(255, 77, 79, 0.2)', color: '#ff4d4f', border: '1px solid rgba(255, 77, 79, 0.5)' }} onClick={() => onNodesDelete([selectedNode])}>DELETE {selectedNode.data.typeLabel.toUpperCase()}</button>
             </div>
           </div>
        </div>
      )}
    </div>
  );
}
