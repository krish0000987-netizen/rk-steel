import React, { useState, useEffect } from 'react';
import { UploadCloud, Copy, Trash2, Image as ImageIcon } from 'lucide-react';
import api from '../api';

const Media = () => {
    const [media, setMedia] = useState([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState('');
    const [uploading, setUploading] = useState(false);

    const getMediaSrc = (m) => {
        if (m.imageBase64) return `/image/media/${m.id}`;
        if (m.path && m.path.startsWith('http')) return m.path;
        if (m.path && m.path.startsWith('/image/')) return m.path;
        if (m.path) return m.path;
        return `/image/media/${m.id}`;
    };

    const fetchMedia = () => {
        api.get('/media').then(res => {
            setMedia(res.data);
            setLoading(false);
        }).catch(() => setLoading(false));
    };

    useEffect(() => {
        fetchMedia();
    }, []);

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        
        setUploading(true);
        try {
            await api.post('/media', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setMsg('Image uploaded successfully.');
            fetchMedia();
            setTimeout(() => setMsg(''), 3000);
        } catch (err) {
            alert('Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id, filename) => {
        // Warning about used image as requested
        if(window.confirm(`Are you sure you want to delete ${filename}? Ensure it is not being used in any product or section.`)) {
            try {
                await api.delete(`/media/${id}`);
                setMsg('Image deleted successfully.');
                fetchMedia();
                setTimeout(() => setMsg(''), 3000);
            } catch (err) {
                alert('Delete failed');
            }
        }
    };

    if (loading) return <div style={{ padding: '2rem' }}>Loading media...</div>;

    return (
        <div className="media-page">
            <div className="flex-between mb-4">
                <div>
                    <h1 className="page-title">Media Library</h1>
                    <p className="page-subtitle" style={{ margin: 0 }}>Manage all website images and assets.</p>
                </div>
                <label className="btn btn-gold" style={{ cursor: 'pointer', margin: 0 }}>
                    {uploading ? 'Uploading...' : <><UploadCloud size={18} /> Upload Image</>}
                    <input type="file" onChange={handleUpload} style={{ display: 'none' }} accept="image/*" disabled={uploading} />
                </label>
            </div>

            {msg && <div style={{ background: 'var(--green-bg)', color: 'var(--status-green)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', fontWeight: 500 }}>{msg}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.5rem' }}>
                {media.length === 0 && !loading && (
                    <div style={{ gridColumn: '1 / -1', padding: '4rem 2rem', textAlign: 'center', background: 'var(--card-bg)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
                        <ImageIcon size={48} style={{ color: 'var(--main-text-secondary)', marginBottom: '1rem', opacity: 0.5 }} />
                        <h3 style={{ marginBottom: '0.5rem' }}>No Media Uploaded</h3>
                        <p style={{ color: 'var(--main-text-secondary)' }}>Upload your first image to get started.</p>
                    </div>
                )}
                {media.map(m => (
                    <div key={m.id} className="admin-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ height: '160px', background: 'var(--main-bg)', display: 'flex', justifyContent: 'center', alignItems: 'center', borderBottom: '1px solid var(--border)', position: 'relative' }}>
                            <img src={getMediaSrc(m)} alt={m.filename} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} onError={e => e.target.style.display='none'} />
                        </div>
                        <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <p style={{ fontWeight: 600, marginBottom: '0.25rem', wordBreak: 'break-all', fontSize: '0.875rem' }}>{m.filename}</p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--main-text-secondary)', marginBottom: '1rem' }}>{(m.size / 1024).toFixed(1)} KB</p>
                            
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                                <button onClick={() => navigator.clipboard.writeText(getMediaSrc(m))} className="btn btn-outline" style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem' }} title="Copy Path">
                                    <Copy size={14} /> Copy
                                </button>
                                <button onClick={() => handleDelete(m.id, m.filename)} className="btn btn-outline btn-danger" style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem' }} title="Delete">
                                    <Trash2 size={14} /> Delete
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Media;
