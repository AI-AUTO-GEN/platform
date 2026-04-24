import { ClipboardList, Package, Download, X, Loader2, CheckCircle2 } from 'lucide-react';
import React, { useState } from 'react'
import { triggerN8NExport } from './exportUtils'

export default function StepExport({ data, session }) {
  const [activeExports, setActiveExports] = useState({}) // { sectionKey: { status: '...', link: null } }
  const [notification, setNotification] = useState(null) // { title, link }

  const handleExportSection = async (section) => {
    if (!data.projectName) return
    
    // Set UI to loading state for this section
    setActiveExports(prev => ({ ...prev, [section]: { status: 'Starting...', link: null } }))
    
    await triggerN8NExport(
      data.projectName, 
      section, 
      (msg) => {
        setActiveExports(prev => ({ ...prev, [section]: { ...prev[section], status: msg } }))
      },
      (link) => {
        if (link) {
          setActiveExports(prev => {
            const next = { ...prev }
            delete next[section]
            return next
          })
          setNotification({
            title: `${data.projectName}${section}.zip is ready!`,
            link: link
          })
        } else {
          setActiveExports(prev => ({ ...prev, [section]: { status: 'Failed', link: null } }))
          setTimeout(() => {
            setActiveExports(prev => {
              const next = { ...prev }
              delete next[section]
              return next
            })
          }, 5000);
        }
      }
    )
  }

  const sections = [
    { id: '_PROJECT', label: 'Full Project', desc: 'Everything: Metadata, Director, Media, Videos', count: '-' },
    { id: '_CHAR', label: 'Characters', desc: 'All Character reference images and descriptions', count: data.characters?.length || 0 },
    { id: '_PROPS', label: 'Props', desc: 'All Prop reference images and descriptions', count: data.props?.length || 0 },
    { id: '_ENVS', label: 'Environments', desc: 'All Environment reference images and descriptions', count: data.environments?.length || 0 },
    { id: '_SHOTS', label: 'Shots', desc: 'All Shot frames and rendering references', count: data.shots?.length || 0 },
    { id: '_VIDEOS', label: 'Videos', desc: 'All final rendered video MP4s and upscales', count: data.videos?.length || 0 },
  ]

  return (
    <div className="step-content fade-in" style={{ paddingBottom: '100px' }}>
      <div className="step-header">
        <h2><Package size={16} className="lucide-icon" /><span className="gradient-text">Export</span> Center</h2>
        <p>Download specific sections of your project directly from Google Drive Vault.</p>
      </div>

      <div className="export-grid-modern">
        {sections.map(sec => {
          const isExporting = activeExports[sec.id]
          const isEmpty = sec.id !== '_PROJECT' && sec.count === 0

          return (
            <div key={sec.id} className="export-card glass" style={{ opacity: isEmpty ? 0.6 : 1, position: 'relative', overflow: 'hidden' }}>
              <div className="export-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ClipboardList size={16} className="lucide-icon" /> {sec.label}
                  </h3>
                  <p style={{ margin: '5px 0 0', fontSize: '12px', color: '#a3a3a3' }}>{sec.desc}</p>
                </div>
                <div style={{ backgroundColor: '#262626', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                  {sec.count} items
                </div>
              </div>

              <div className="export-card-action" style={{ marginTop: 'auto' }}>
                <button 
                  onClick={() => handleExportSection(sec.id)} 
                  disabled={isExporting || !data.projectName || isEmpty}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: isExporting ? '#3b82f6' : isEmpty ? '#262626' : '#10b981',
                    color: isEmpty ? '#737373' : '#fff',
                    fontWeight: '600',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: (isExporting || isEmpty || !data.projectName) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isExporting ? (
                    <>
                      <Loader2 size={16} className="spin" />
                      {isExporting.status}
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      Download {sec.id}
                    </>
                  )}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Elegant Notification Overlay */}
      {notification && (
        <div style={{
          position: 'fixed',
          bottom: '30px',
          right: '30px',
          backgroundColor: '#0a0a0a',
          border: '1px solid #262626',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '15px',
          zIndex: 9999,
          maxWidth: '350px',
          animation: 'slideUp 0.3s ease-out forwards'
        }}>
          <button 
            onClick={() => setNotification(null)}
            style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: '#a3a3a3', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#10b98120', padding: '10px', borderRadius: '50%', color: '#10b981' }}>
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '15px', color: '#fff' }}>Export Complete</h4>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#a3a3a3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {notification.title}
              </p>
            </div>
          </div>
          
          <a 
            href={notification.link} 
            target="_blank" 
            rel="noreferrer"
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#10b981',
              color: '#fff',
              textDecoration: 'none',
              padding: '10px',
              borderRadius: '6px',
              fontWeight: '500',
              fontSize: '14px',
              transition: 'background 0.2s'
            }}
          >
            <Download size={16} /> Save to Device
          </a>
        </div>
      )}
      <style>{`
        .export-grid-modern {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
          margin-top: 20px;
        }
        @keyframes slideUp {
          from { transform: translateY(50px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
