import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { ReactFlow, Controls, Background, useNodesState, useEdgesState, addEdge, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { getModelOptions, MODEL_REGISTRY } from './config/modelRegistry';
import { calculatePreviewCost, formatCost } from './pricing/PricingEngine';
import { X, CheckCircle, Upload, Image as ImageIcon, Trash2 } from 'lucide-react';
import { N8N_UPLOAD_WEBHOOK_URL } from './config/constants';
import { supabase } from './supabase';

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

// P62: Modality options for the type selector
const MODALITY_OPTS = [
  { key: 'image', label: 'IMG' }, { key: 'video', label: 'VID' },
  { key: 'tts', label: 'TTS' }, { key: 't2a', label: 'SFX' },
  { key: 'i23d', label: '3D' },
];
const DEF_MOD = { Character: 'image', Prop: 'image', Environment: 'image', Shot: 'image', Video: 'video' };

const CustomNode = ({ id, data }) => {
  const modality = data.rawData?.modality || DEF_MOD[data.typeLabel] || 'image';
  const modelList = (MODEL_REGISTRY[modality] || []).filter(c => c.company !== 'Loading...');

  // P63: Derive company list and current company
  const companies = modelList.map(c => c.company);
  const currentCompany = data.rawData?.company || companies[0] || '';
  const companyModels = modelList.find(c => c.company === currentCompany)?.models || modelList[0]?.models || [];

  const hasMedia = data.media && data.media.thumbnailLink;
  const promptText = data.prompt || '';

  return (
    <div 
      style={{ 
        background: '#0a0a0f', 
        border: `1px solid ${data.color || '#333'}`, 
        borderRadius: '10px', 
        padding: '10px', 
        width: '220px', 
        color: 'white', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '6px',
        boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 1px ${data.color || '#333'}`
      }}
      className="custom-flow-node"
    >
      <Handle type="target" position={Position.Left} style={{ background: '#fff', width: '10px', height: '10px', left: '-5px' }}>
         <div style={{ position: 'absolute', top: -10, left: -10, right: -10, bottom: -10, cursor: 'crosshair' }}></div>
      </Handle>

      {/* Header: Type + Cost */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '10px', color: data.color || '#aaa', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>{data.typeLabel}</div>
        {data.media?.actual_cost != null ? (
          <span style={{ fontSize: '8px', background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '2px 5px', borderRadius: '3px', border: '1px solid rgba(16,185,129,0.3)' }}><CheckCircle size={10} className="lucide-icon" /> {formatCost(data.media.actual_cost)}</span>
        ) : (
          <span style={{ fontSize: '8px', background: 'rgba(255,255,255,0.05)', color: '#666', padding: '2px 5px', borderRadius: '3px' }}>Est: {formatCost(calculatePreviewCost(data.modelId, { ...data.rawData?.settings, prompt: promptText }))}</span>
        )}
      </div>

      {/* Triple Dropdown: Modality | Company | Model */}
      <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
        <select className="select-mini nodrag" style={{ fontSize: '8px', padding: '2px 3px', background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', width: '56px', cursor: 'pointer' }}
          value={modality} onChange={(e) => data.onChangeNodeModality(id, data.typeLabel, e.target.value)}>
          {MODALITY_OPTS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
        <select className="select-mini nodrag" style={{ fontSize: '8px', padding: '2px 3px', background: 'rgba(255,255,255,0.08)', color: '#aaa', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', flex: 1, minWidth: '60px', cursor: 'pointer' }}
          value={currentCompany} onChange={(e) => data.onChangeNodeCompany(id, data.typeLabel, e.target.value)}>
          {companies.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="select-mini nodrag" style={{ fontSize: '8px', padding: '2px 3px', background: 'rgba(255,255,255,0.06)', color: '#ccc', border: 'none', borderRadius: '4px', width: '100%', cursor: 'pointer' }}
          value={data.modelId || ''} onChange={(e) => data.onChangeNodeModel(id, data.typeLabel, e.target.value)}>
          {companyModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      {/* Model options (aspect ratio, etc) */}
      {getModelOptions(data.modelId, data.typeLabel?.toLowerCase()).length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px' }}>
          {getModelOptions(data.modelId, data.typeLabel?.toLowerCase()).map(opt => (
            <div key={opt.key} style={{ display: 'flex', flexDirection: 'column' }}>
               <label style={{ fontSize: '7px', color: '#666', textTransform: 'uppercase', marginBottom: '1px' }}>{opt.label}</label>
               <select className="nodrag" style={{ fontSize: '8px', padding: '2px', background: 'rgba(255,255,255,0.05)', color: '#ccc', border: '1px solid #222', borderRadius: '3px' }}
                 value={data.rawData?.settings?.[opt.key] || opt.default}
                 onChange={(e) => data.onChangeNodeSettings(id, data.typeLabel, { ...(data.rawData?.settings || {}), [opt.key]: e.target.value })}>
                 {opt.options.map(o => <option key={o} value={o}>{o}</option>)}
               </select>
            </div>
          ))}
        </div>
      )}

      {/* P66: Reference images strip */}
      {data.rawData?.references?.length > 0 && (
        <div style={{ display: 'flex', gap: '3px', alignItems: 'center', flexWrap: 'wrap' }}>
          {data.rawData.references.slice(0, 4).map((ref, i) => (
            <div key={i} style={{ width: '28px', height: '28px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #333', flexShrink: 0 }}>
              <img src={ref.thumbnailUrl || ref.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ))}
          {data.rawData.references.length > 4 && (
            <span style={{ fontSize: '8px', color: '#666' }}>+{data.rawData.references.length - 4}</span>
          )}
          <span style={{ fontSize: '7px', color: '#555', marginLeft: 'auto' }}>REF</span>
        </div>
      )}

      {/* P63: Body — Prompt when no media, Image when rendered */}
      {hasMedia ? (
        <>
          <div style={{ position: 'relative', width: '100%', height: '140px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #222' }}>
            {data.media.mimeType && data.media.mimeType.includes('video') ? (
              <video src={getDriveDisplayUrl(data.media.webViewLink || data.media.thumbnailLink)} autoPlay loop muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <img src={getDriveDisplayUrl(data.media.thumbnailLink)} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
            <a href={data.media.webViewLink || '#'} target="_blank" rel="noreferrer" style={{
              position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.8)', color: '#00f0ff', padding: '3px 6px', borderRadius: '4px', fontSize: '9px', textDecoration: 'none', fontWeight: 'bold', border: '1px solid rgba(0,240,255,0.3)'
            }}>HQ</a>
          </div>
          {/* Prompt shown below image as caption */}
          {promptText && (
            <div style={{ fontSize: '9px', color: '#555', fontStyle: 'italic', lineHeight: '1.3', padding: '0 2px', maxHeight: '36px', overflow: 'hidden', wordBreak: 'break-word' }}>
              {promptText.length > 100 ? promptText.slice(0, 100) + 'â€¦' : promptText}
            </div>
          )}
        </>
      ) : (
        /* No render yet â€” show editable prompt area */
        <textarea
          className="nodrag nowheel"
          placeholder="Describe what to generate..."
          style={{ 
            width: '100%', height: '80px', background: 'rgba(255,255,255,0.03)', border: '1px solid #222', borderRadius: '6px', 
            color: '#ccc', fontSize: '10px', padding: '8px', resize: 'none', fontFamily: 'inherit', lineHeight: '1.4',
            outline: 'none'
          }}
          value={promptText}
          onChange={(e) => data.onChangeNodePrompt(id, data.typeLabel, e.target.value)}
        />
      )}

      {/* Error bar */}
      {data.errorMedia && (
        <div style={{ fontSize: '8px', color: '#ff6b6b', background: 'rgba(255,77,79,0.08)', padding: '4px 6px', borderRadius: '4px', border: '1px solid rgba(255,77,79,0.2)', wordBreak: 'break-word' }}>
          âœ• {data.errorMedia.statusMessage || 'Generation failed'}
        </div>
      )}
      {/* Progress bar */}
      {data.processingMedia && !data.errorMedia && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#aaa', marginBottom: '2px' }}>
            <span>{data.processingMedia.statusMessage || 'Processing...'}</span>
            <span>{data.processingMedia.progress}%</span>
          </div>
          <div style={{ height: '3px', background: '#222', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: data.color || '#1890ff', width: `${data.processingMedia.progress || 0}%`, transition: 'width 0.3s ease' }} />
          </div>
        </div>
      )}

      <Handle type="source" position={Position.Right} style={{ background: '#fff', width: '10px', height: '10px', right: '-5px' }}>
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
  const selectedNodeRef = useRef(null);
  useEffect(() => { selectedNodeRef.current = selectedNode; }, [selectedNode]);

  // P62 FIX: Use refs so callbacks always access current data (no stale closures)
  const dataRef = useRef(data);
  const onChangeRef = useRef(onChange);
  useEffect(() => { dataRef.current = data; onChangeRef.current = onChange; }, [data, onChange]);

  const TYPE_MAP = { 'Character': 'characters', 'Prop': 'props', 'Environment': 'environments', 'Shot': 'shots', 'Video': 'videos' };

  // P62 FIX: Stable callbacks that use refs â€” never go stale
  const onChangeNodeModel = useCallback((id, typeLabel, newModelId) => {
    const d = dataRef.current;
    const key = TYPE_MAP[typeLabel];
    const col = [...(d[key] || [])];
    const idx = col.findIndex(item => item.id === id);
    if (idx >= 0) {
      col[idx] = { ...col[idx], modelId: newModelId };
      onChangeRef.current({ ...d, [key]: col });
    }
    // Immediate visual update
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, modelId: newModelId } } : n));
  }, [setNodes]);

  const onChangeNodeSettings = useCallback((id, typeLabel, newSettings) => {
    const d = dataRef.current;
    const key = TYPE_MAP[typeLabel];
    const col = [...(d[key] || [])];
    const idx = col.findIndex(item => item.id === id);
    if (idx >= 0) {
      col[idx] = { ...col[idx], settings: newSettings };
      onChangeRef.current({ ...d, [key]: col });
    }
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, rawData: { ...n.data.rawData, settings: newSettings } } } : n));
  }, [setNodes]);

  const onChangeNodeModality = useCallback((id, typeLabel, newModality) => {
    const d = dataRef.current;
    const key = TYPE_MAP[typeLabel];
    const col = [...(d[key] || [])];
    const idx = col.findIndex(item => item.id === id);
    if (idx >= 0) {
      // Pick first model of the new modality as default
      const firstCat = (MODEL_REGISTRY[newModality] || []).find(c => c.company !== 'Loading...');
      const firstModelId = firstCat?.models?.[0]?.id || '';
      col[idx] = { ...col[idx], modality: newModality, modelId: firstModelId };
      onChangeRef.current({ ...d, [key]: col });
    }
    setNodes(nds => nds.map(n => {
      if (n.id !== id) return n;
      const firstCat = (MODEL_REGISTRY[newModality] || []).find(c => c.company !== 'Loading...');
      const firstModelId = firstCat?.models?.[0]?.id || '';
      return { ...n, data: { ...n.data, modelId: firstModelId, rawData: { ...n.data.rawData, modality: newModality, modelId: firstModelId } } };
    }));
  }, [setNodes]);

  const onChangeNodeCompany = useCallback((id, typeLabel, newCompany) => {
    const d = dataRef.current;
    const key = TYPE_MAP[typeLabel];
    const col = [...(d[key] || [])];
    const idx = col.findIndex(item => item.id === id);
    if (idx >= 0) {
      const modality = col[idx].modality || DEF_MOD[typeLabel] || 'image';
      const catModels = (MODEL_REGISTRY[modality] || []).find(c => c.company === newCompany);
      const firstModelId = catModels?.models?.[0]?.id || col[idx].modelId;
      col[idx] = { ...col[idx], company: newCompany, modelId: firstModelId };
      onChangeRef.current({ ...d, [key]: col });
    }
    setNodes(nds => nds.map(n => {
      if (n.id !== id) return n;
      const modality = n.data.rawData?.modality || DEF_MOD[typeLabel] || 'image';
      const catModels = (MODEL_REGISTRY[modality] || []).find(c => c.company === newCompany);
      const firstModelId = catModels?.models?.[0]?.id || n.data.modelId;
      return { ...n, data: { ...n.data, modelId: firstModelId, rawData: { ...n.data.rawData, company: newCompany, modelId: firstModelId } } };
    }));
  }, [setNodes]);

  const onChangeNodePrompt = useCallback((id, typeLabel, newPrompt) => {
    const d = dataRef.current;
    const key = TYPE_MAP[typeLabel];
    const col = [...(d[key] || [])];
    const idx = col.findIndex(item => item.id === id);
    if (idx >= 0) {
      col[idx] = { ...col[idx], prompt: newPrompt };
      onChangeRef.current({ ...d, [key]: col });
    }
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, prompt: newPrompt, rawData: { ...n.data.rawData, prompt: newPrompt } } } : n));
  }, [setNodes]);

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
      let refNode = selectedNodeRef.current;
      if (!refNode) {
        const allNodes = [...nodes, ...newNodes];
        if (allNodes.length > 0) {
          refNode = allNodes.reduce((prev, current) => (prev.position.x > current.position.x) ? prev : current);
        }
      }

      if (refNode) {
        let testX = refNode.position.x + 300;
        let testY = refNode.position.y;
        const checkCollision = (n) => Math.abs(n.position.x - testX) < 50 && Math.abs(n.position.y - testY) < 50;
        while (newNodes.some(checkCollision) || nodes.some(checkCollision)) {
          testX += 250;
        }
        return { x: testX, y: testY };
      }
      return { x: defaultX, y: defaultY };
    };

    // P62: handlers moved above useEffect as useCallback

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
          data: { label: item.name || item.id, typeLabel, color, media: existingNode?.data?.media, processingMedia: existingNode?.data?.processingMedia, errorMedia: existingNode?.data?.errorMedia, prompt: item.prompt || item.beat, isTarget, rawData: item, modelId: item.modelId, onChangeNodeModel, onChangeNodeSettings, onChangeNodeModality, onChangeNodeCompany, onChangeNodePrompt }
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
        data: { label: s.id, typeLabel: 'Shot', color: '#1890ff', media: existingNode?.data?.media, processingMedia: existingNode?.data?.processingMedia, errorMedia: existingNode?.data?.errorMedia, prompt: s.prompt || s.beat, isTarget: true, rawData: s, modelId: s.modelId, onChangeNodeModel, onChangeNodeSettings, onChangeNodeModality, onChangeNodeCompany, onChangeNodePrompt }
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
        data: { label: v.id, typeLabel: 'Video', color: '#9254de', media: existingNode?.data?.media, processingMedia: existingNode?.data?.processingMedia, errorMedia: existingNode?.data?.errorMedia, prompt: v.prompt, isTarget: true, rawData: v, modelId: v.modelId, onChangeNodeModel, onChangeNodeSettings, onChangeNodeModality, onChangeNodeCompany, onChangeNodePrompt }
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

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // P66: Reference image upload handler
  const handleReferenceUpload = useCallback(async (file) => {
    if (!selectedNode || !file) return;
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      // Convert file to base64 for webhook
      const reader = new FileReader();
      const base64 = await new Promise((resolve) => {
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });

      const res = await fetch(N8N_UPLOAD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          nodeId: selectedNode.id,
          nodeType: selectedNode.data.typeLabel,
          fileName: file.name,
          mimeType: file.type,
          fileData: base64,
          purpose: 'reference'
        })
      });
      
      const result = await res.json();
      
      // Store reference in node data
      const newRef = {
        url: result.driveUrl || result.url || base64,
        thumbnailUrl: result.thumbnailUrl || result.url || base64,
        driveFileId: result.driveFileId || null,
        fileName: file.name,
        uploadedAt: new Date().toISOString()
      };
      
      const currentRefs = selectedNode.data.rawData?.references || [];
      handleUpdateNode('references', [...currentRefs, newRef]);
    } catch (err) {
      console.error('Reference upload failed:', err);
      // Fallback: store as local base64 preview
      const reader = new FileReader();
      reader.onload = () => {
        const newRef = { url: reader.result, thumbnailUrl: reader.result, fileName: file.name, uploadedAt: new Date().toISOString() };
        const currentRefs = selectedNode.data.rawData?.references || [];
        handleUpdateNode('references', [...currentRefs, newRef]);
      };
      reader.readAsDataURL(file);
    } finally {
      setUploading(false);
    }
  }, [selectedNode]);

  const handleRemoveReference = useCallback((index) => {
    if (!selectedNode) return;
    const currentRefs = [...(selectedNode.data.rawData?.references || [])];
    currentRefs.splice(index, 1);
    handleUpdateNode('references', currentRefs);
  }, [selectedNode]);

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
    if (typeLabel === 'Shot') newItem = { id, prompt: 'New Shot based on inputs', modelId: 'fal-ai/flux-pro/v1.1-ultra' };
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
          
          {/* Top Panel for Toolbar â€” P50 FIX: Added tooltips */}
          <div style={{ position: 'absolute', top: 20, left: 20, background: 'rgba(20,20,20,0.8)', padding: '10px', borderRadius: '8px', zIndex: 5, border: '1px solid #333', display: 'flex', gap: '8px' }}>
             <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '11px', background: '#ff4d4f' }} onClick={() => addNewNode('Character')} title="Add a character entity node" aria-label="Add Character">+ CHARACTER</button>
             <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '11px', background: '#d4b106' }} onClick={() => addNewNode('Prop')} title="Add a prop entity node" aria-label="Add Prop">+ PROP</button>
             <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '11px', background: '#52c41a' }} onClick={() => addNewNode('Environment')} title="Add an environment/location node" aria-label="Add Environment">+ ENVIRONMENT</button>
             <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '11px', background: '#1890ff' }} onClick={() => addNewNode('Shot')} title="Add a shot/image generation node" aria-label="Add Shot">+ SHOT</button>
             <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '11px', background: '#9254de' }} onClick={() => addNewNode('Video')} title="Add a video generation node" aria-label="Add Video">+ VIDEO</button>
          </div>
        </ReactFlow>
      </div>

      {/* Side Panel for Editing */}
      {/* P47 FIX: Side panel z-index elevated above LogMonitor overlay */}
      {selectedNode && (
        <div style={{ width: '380px', background: '#111', borderLeft: '1px solid #333', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 10 }}>
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
               <textarea rows={5} className="script-textarea" value={selectedNode.data.rawData.prompt || selectedNode.data.rawData.beat || ''} onChange={(e) => handleUpdateNode('prompt', e.target.value)} />
             </div>

             {selectedNode.data.typeLabel === 'Shot' && (
               <div className="form-group">
                 <label>Camera Move</label>
                 <input className="input-field" value={selectedNode.data.rawData.cameraMove || ''} onChange={(e) => handleUpdateNode('cameraMove', e.target.value)} />
               </div>
              )}
              {/* P66: Reference Images Upload */}
              <div style={{ marginTop: '10px' }}>
                <label style={{ fontSize: '10px', textTransform: 'uppercase', color: '#888', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ImageIcon size={12} /> Reference Images
                </label>
                
                {/* Upload drop zone */}
                <div 
                  style={{ 
                    border: '2px dashed #333', borderRadius: '8px', padding: '16px', 
                    textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s',
                    background: uploading ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)'
                  }}
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#6366f1'; }}
                  onDragLeave={(e) => { e.currentTarget.style.borderColor = '#333'; }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = '#333';
                    const file = e.dataTransfer.files[0];
                    if (file && file.type.startsWith('image/')) handleReferenceUpload(file);
                  }}
                >
                  <input 
                    ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={(e) => { if (e.target.files[0]) handleReferenceUpload(e.target.files[0]); e.target.value = ''; }}
                  />
                  {uploading ? (
                    <div style={{ color: '#6366f1', fontSize: '11px' }}>
                      <div style={{ animation: 'pulse 1s infinite' }}>Uploading...</div>
                    </div>
                  ) : (
                    <>
                      <Upload size={20} style={{ color: '#555', marginBottom: '4px' }} />
                      <div style={{ fontSize: '10px', color: '#666' }}>Drop image or click to upload</div>
                      <div style={{ fontSize: '8px', color: '#444', marginTop: '2px' }}>PNG, JPG, WebP</div>
                    </>
                  )}
                </div>

                {/* Uploaded references grid */}
                {(selectedNode.data.rawData?.references || []).length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginTop: '10px' }}>
                    {(selectedNode.data.rawData?.references || []).map((ref, i) => (
                      <div key={i} style={{ position: 'relative', borderRadius: '6px', overflow: 'hidden', border: '1px solid #333', aspectRatio: '1' }}>
                        <img src={ref.thumbnailUrl || ref.url} alt={ref.fileName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button 
                          onClick={() => handleRemoveReference(i)}
                          style={{ 
                            position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.7)', 
                            border: 'none', borderRadius: '3px', padding: '2px', cursor: 'pointer', color: '#ff6b6b',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                        >
                          <Trash2 size={10} />
                        </button>
                        <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', background: 'rgba(0,0,0,0.7)', padding: '2px 4px', fontSize: '7px', color: '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ref.fileName}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

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
