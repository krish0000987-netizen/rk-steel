import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Edit2, Trash2, Eye, EyeOff, Search, RefreshCw, Package, X } from 'lucide-react';
import api from '../api';

const Products = () => {
    const [products, setProducts] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });
    const [deleteModal, setDeleteModal] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const showMsg = (type, text) => {
        setMsg({ type, text });
        setTimeout(() => setMsg({ type: '', text: '' }), 3500);
    };

    const fetchProducts = useCallback(() => {
        setLoading(true);
        setLoadError(false);
        api.get('/products')
            .then(res => {
                const data = Array.isArray(res.data) ? res.data : [];
                setProducts(data);
                setFiltered(data);
                setLoading(false);
            })
            .catch(() => {
                setLoadError(true);
                setLoading(false);
            });
    }, []);

    useEffect(() => { fetchProducts(); }, [fetchProducts]);

    useEffect(() => {
        if (!search.trim()) { setFiltered(products); return; }
        const q = search.toLowerCase();
        setFiltered(products.filter(p =>
            (p.name || '').toLowerCase().includes(q) ||
            (p.category || '').toLowerCase().includes(q) ||
            (p.sku || '').toLowerCase().includes(q)
        ));
    }, [search, products]);

    const toggleStatus = async (id, currentStatus) => {
        const newStatus = currentStatus === 'published' ? 'draft' : 'published';
        try {
            await api.put(`/products/${id}`, { status: newStatus });
            showMsg('success', `Product ${newStatus === 'published' ? 'published' : 'set to draft'}.`);
            fetchProducts();
        } catch {
            showMsg('error', 'Failed to update status.');
        }
    };

    const handleDelete = async () => {
        if (!deleteModal) return;
        setDeleting(true);
        try {
            await api.delete(`/products/${deleteModal.id}`);
            const name = deleteModal.name;
            setDeleteModal(null);
            showMsg('success', `"${name}" deleted successfully.`);
            fetchProducts();
        } catch {
            showMsg('error', 'Failed to delete product.');
        } finally {
            setDeleting(false);
        }
    };

    const getImage = (p) => {
        if (p.imageBase64) return '/image/product/' + p.id;
        if (p.image) return p.image.startsWith('http') ? p.image : `/assets/${p.image}`;
        if (p.images) { try { return `/assets/${JSON.parse(p.images)[0]}`; } catch { return null; } }
        return null;
    };

    if (loading) return (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--main-text-secondary)' }}>
            <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: '1rem', color: 'var(--gold)' }} />
            <p style={{ color: 'var(--main-text-secondary)' }}>Loading products...</p>
            <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
        </div>
    );

    if (loadError) return (
        <div>
            <h1 className="page-title" style={{ marginBottom: '1.5rem' }}>Products</h1>
            <div className="toast-error" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <span style={{ flex: 1, color: '#7f1d1d' }}>Unable to load products. Please check server and try again.</span>
                <button onClick={fetchProducts} className="btn btn-gold" style={{ flexShrink: 0 }}>
                    <RefreshCw size={16} /> Retry
                </button>
            </div>
        </div>
    );

    return (
        <div className="products-page">
            <div className="flex-between mb-4">
                <div>
                    <h1 className="page-title">Products</h1>
                    <p className="page-subtitle" style={{ margin: 0 }}>
                        {products.length} product{products.length !== 1 ? 's' : ''} in your catalog
                    </p>
                </div>
                <Link to="/admin/products/new" className="btn btn-gold">
                    <PlusCircle size={18} /> Add Product
                </Link>
            </div>

            {msg.text && (
                <div className={msg.type === 'success' ? 'toast-success' : 'toast-error'} style={{ marginBottom: '1.25rem' }}>
                    {msg.text}
                </div>
            )}

            <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Search size={17} style={{ color: 'var(--main-text-secondary)', flexShrink: 0 }} />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name, category or SKU..."
                        className="form-control"
                        style={{ border: 'none', boxShadow: 'none', padding: '0.375rem 0', maxWidth: '360px' }}
                    />
                    {search && (
                        <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--main-text-secondary)', padding: 0, display: 'flex' }}>
                            <X size={16} />
                        </button>
                    )}
                </div>

                <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Price</th>
                                <th>Category</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="5">
                                        <div style={{ textAlign: 'center', padding: '3.5rem 2rem', color: 'var(--main-text-secondary)' }}>
                                            <Package size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                                            <p style={{ fontWeight: 600, color: 'var(--main-text)', marginBottom: '0.5rem', fontSize: '1.05rem' }}>
                                                {search ? 'No products match your search' : 'No Products Yet'}
                                            </p>
                                            <p style={{ fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                                                {search ? `Try a different keyword.` : 'Click "Add Product" to get started.'}
                                            </p>
                                            {!search && (
                                                <Link to="/admin/products/new" className="btn btn-gold">
                                                    <PlusCircle size={16} /> Add First Product
                                                </Link>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : filtered.map(p => {
                                const imgSrc = getImage(p);
                                return (
                                    <tr key={p.id}>
                                        <td style={{ minWidth: '220px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                                                {imgSrc ? (
                                                    <img
                                                        src={imgSrc}
                                                        alt={p.name}
                                                        style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--card-border)', flexShrink: 0 }}
                                                        onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                                                    />
                                                ) : null}
                                                <div style={{ width: '48px', height: '48px', background: '#f0f0f0', borderRadius: '8px', border: '1px solid var(--card-border)', flexShrink: 0, display: imgSrc ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Package size={20} style={{ color: '#c0c0c0' }} />
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <strong style={{ display: 'block', color: 'var(--main-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>{p.name}</strong>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--main-text-secondary)' }}>
                                                        {p.sku ? `SKU: ${p.sku}` : 'No SKU'}
                                                        {p.featured && <span className="badge badge-gold" style={{ marginLeft: '0.5rem', fontSize: '0.65rem' }}>Featured</span>}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ fontWeight: 700, color: 'var(--main-text)', whiteSpace: 'nowrap' }}>
                                            ₹{p.price}
                                            {p.oldPrice && <span style={{ textDecoration: 'line-through', color: 'var(--main-text-secondary)', marginLeft: '0.5rem', fontWeight: 400, fontSize: '0.8125rem' }}>₹{p.oldPrice}</span>}
                                        </td>
                                        <td style={{ color: 'var(--main-text-secondary)' }}>{p.category || '—'}</td>
                                        <td>
                                            <span className={`badge ${p.status === 'published' ? 'badge-success' : 'badge-gray'}`}>
                                                {p.status === 'published' ? 'Published' : 'Draft'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.25rem', alignItems: 'center' }}>
                                                <button onClick={() => toggleStatus(p.id, p.status)} className="btn btn-ghost" title={p.status === 'published' ? 'Set to Draft' : 'Publish'} style={{ padding: '0.4rem' }}>
                                                    {p.status === 'published' ? <EyeOff size={17} /> : <Eye size={17} />}
                                                </button>
                                                <Link to={`/admin/products/edit/${p.id}`} className="btn btn-ghost" title="Edit" style={{ padding: '0.4rem' }}>
                                                    <Edit2 size={17} />
                                                </Link>
                                                <button onClick={() => setDeleteModal(p)} className="btn btn-ghost btn-danger" title="Delete" style={{ padding: '0.4rem' }}>
                                                    <Trash2 size={17} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {deleteModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }} onClick={() => !deleting && setDeleteModal(null)}>
                    <div style={{ background: '#fff', borderRadius: '12px', padding: '2rem', width: '100%', maxWidth: '400px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
                            <div style={{ width: '56px', height: '56px', background: '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                                <Trash2 size={24} style={{ color: '#dc2626' }} />
                            </div>
                            <h3 style={{ fontSize: '1.125rem', color: '#171717', marginBottom: '0.625rem' }}>Delete Product?</h3>
                            <p style={{ color: '#666', fontSize: '0.9rem' }}>
                                <strong style={{ color: '#171717' }}>"{deleteModal.name}"</strong> will be permanently removed. This cannot be undone.
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button onClick={() => setDeleteModal(null)} disabled={deleting} className="btn btn-outline" style={{ flex: 1 }}>Cancel</button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                style={{ flex: 1, background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.625rem', fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: deleting ? 0.7 : 1, fontFamily: 'inherit', fontSize: '0.875rem' }}
                            >
                                {deleting ? <><RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> Deleting...</> : <><Trash2 size={15} /> Delete</>}
                            </button>
                        </div>
                    </div>
                    <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
                </div>
            )}
        </div>
    );
};

export default Products;
