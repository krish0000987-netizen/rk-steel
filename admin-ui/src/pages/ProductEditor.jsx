import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Save, ArrowLeft, Upload, X, Plus, Trash2,
    Package, Tag, DollarSign, Hash, Layers,
    Star, Eye, EyeOff, RefreshCw, CheckCircle
} from 'lucide-react';
import api from '../api';

/* ---- Responsive hook ---- */
const useWindowWidth = () => {
    const [width, setWidth] = useState(window.innerWidth);
    useEffect(() => {
        const handler = () => setWidth(window.innerWidth);
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, []);
    return width;
};

/* ---- helpers ---- */
const CATEGORIES = [
    'Almirahs', 'Wardrobes', 'Beds', 'Sofa / Diwan', 'Chairs',
    'Tables', 'Racks / Shelves', 'Lockers', 'Cupboards', 'Other'
];

const SPEC_PRESETS = ['Material', 'Size', 'Color', 'Weight', 'Dimensions', 'Finish', 'Brand', 'Country of Origin'];

const emptyForm = () => ({
    name: '',
    description: '',
    price: '',
    oldPrice: '',
    category: '',
    sku: '',
    stock: '',
    featured: false,
    status: 'published',
    whatsappMsg: '',
    specs: [],         // [{ key: '', value: '' }]
    existingImage: '', // filename of already-saved image (edit mode)
});

/* ---- Validation ---- */
const validate = (form, imageFile) => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Product name is required.';
    if (!form.price.trim()) errors.price = 'Selling price is required.';
    if (!form.category.trim()) errors.category = 'Category is required.';
    if (!imageFile && !form.existingImage) errors.image = 'Please upload a product image.';
    return errors;
};

/* ================================================================
   MAIN COMPONENT
   ================================================================ */
const ProductEditor = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditing = !!id;
    const fileInputRef = useRef(null);
    const windowWidth = useWindowWidth();
    const isMobile = windowWidth <= 768;

    const [form, setForm] = useState(emptyForm());
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [loading, setLoading] = useState(isEditing);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const [toast, setToast] = useState({ type: '', msg: '' });

    /* ---- Load product in edit mode ---- */
    useEffect(() => {
        if (!isEditing) return;
        api.get('/products').then(res => {
            const p = res.data.find(x => x.id === parseInt(id));
            if (p) {
                let specs = [];
                if (p.specs) {
                    try { specs = JSON.parse(p.specs); } catch { specs = []; }
                }
                setForm({
                    name: p.name || '',
                    description: p.description || '',
                    price: p.price || '',
                    oldPrice: p.oldPrice || '',
                    category: p.category || '',
                    sku: p.sku || '',
                    stock: p.stock !== undefined && p.stock !== null ? String(p.stock) : '',
                    featured: !!p.featured,
                    status: p.status || 'published',
                    whatsappMsg: p.whatsappMsg || '',
                    specs,
                    existingImage: p.image || '',
                });
                if (p.imageBase64) setImagePreview('/image/product/' + p.id);
                else if (p.image) setImagePreview(p.image.startsWith('http') ? p.image : `/assets/${p.image}`);
            }
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [id, isEditing]);

    /* ---- Toast helper ---- */
    const showToast = (type, msg) => {
        setToast({ type, msg });
        setTimeout(() => setToast({ type: '', msg: '' }), 4000);
    };

    /* ---- Field handlers ---- */
    const handleChange = e => {
        const { name, value, type, checked } = e.target;
        setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    /* ---- Image handling ---- */
    const handleImageSelect = useCallback(file => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setErrors(prev => ({ ...prev, image: 'Only image files are allowed (JPG, PNG, WebP, GIF).' }));
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setErrors(prev => ({ ...prev, image: 'Image must be smaller than 10MB.' }));
            return;
        }
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
        setErrors(prev => ({ ...prev, image: '' }));
    }, []);

    const handleFileInput = e => handleImageSelect(e.target.files?.[0]);
    const handleDrop = e => {
        e.preventDefault();
        setDragging(false);
        handleImageSelect(e.dataTransfer.files?.[0]);
    };
    const removeImage = () => {
        setImageFile(null);
        setImagePreview(null);
        setForm(prev => ({ ...prev, existingImage: '' }));
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    /* ---- Specs handlers ---- */
    const addSpec = (key = '') => {
        setForm(prev => ({ ...prev, specs: [...prev.specs, { key, value: '' }] }));
    };
    const updateSpec = (index, field, val) => {
        setForm(prev => {
            const specs = [...prev.specs];
            specs[index] = { ...specs[index], [field]: val };
            return { ...prev, specs };
        });
    };
    const removeSpec = index => {
        setForm(prev => ({ ...prev, specs: prev.specs.filter((_, i) => i !== index) }));
    };

    /* ---- Submit ---- */
    const handleSave = async (e, addAnother = false) => {
        e.preventDefault();
        const errs = validate(form, imageFile);
        if (Object.keys(errs).length) {
            setErrors(errs);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        setSaving(true);
        try {
            const fd = new FormData();
            fd.append('name', form.name.trim());
            fd.append('description', form.description.trim());
            fd.append('price', form.price.trim());
            fd.append('oldPrice', form.oldPrice.trim());
            fd.append('category', form.category.trim());
            fd.append('sku', form.sku.trim());
            fd.append('stock', form.stock || '0');
            fd.append('featured', String(form.featured));
            fd.append('status', form.status);
            fd.append('whatsappMsg', form.whatsappMsg.trim());
            fd.append('specs', JSON.stringify(form.specs.filter(s => s.key.trim())));
            if (!imageFile && form.existingImage) {
                fd.append('image', form.existingImage); // keep existing
            }
            if (imageFile) fd.append('productImage', imageFile);

            let result;
            if (isEditing) {
                result = await api.put(`/products/${id}/with-image`, fd, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                result = await api.post('/products/with-image', fd, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }

            showToast('success', isEditing ? 'Product updated successfully!' : 'Product added successfully!');

            if (addAnother) {
                setTimeout(() => {
                    setForm(emptyForm());
                    setImageFile(null);
                    setImagePreview(null);
                    setErrors({});
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }, 1200);
            } else {
                setTimeout(() => navigate('/admin/products'), 1500);
            }
        } catch (err) {
            const msg = err.response?.data?.error || 'Failed to save product. Please try again.';
            showToast('error', msg);
        } finally {
            setSaving(false);
        }
    };

    /* ---- Render helpers ---- */
    const FieldError = ({ field }) =>
        errors[field] ? (
            <span style={{ color: '#dc2626', fontSize: '0.8125rem', marginTop: '0.35rem', display: 'block', fontWeight: 500 }}>
                {errors[field]}
            </span>
        ) : null;

    if (loading) return (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--main-text-secondary)' }}>
            Loading product...
        </div>
    );

    return (
        <div style={{ maxWidth: '960px' }}>
            {/* Page header */}
            <div className="flex-between mb-4">
                <div>
                    <h1 className="page-title">{isEditing ? 'Edit Product' : 'Add New Product'}</h1>
                    <p className="page-subtitle" style={{ marginBottom: 0 }}>
                        {isEditing ? 'Update product details and image.' : 'Fill in all details to add a new product to your catalog.'}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => navigate('/admin/products')}
                    className="btn btn-outline"
                    style={{ flexShrink: 0 }}
                >
                    <ArrowLeft size={16} /> Back
                </button>
            </div>

            {/* Toast */}
            {toast.msg && (
                <div className={toast.type === 'success' ? 'toast-success' : 'toast-error'}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.5rem' }}>
                    {toast.type === 'success'
                        ? <CheckCircle size={18} style={{ flexShrink: 0 }} />
                        : <X size={18} style={{ flexShrink: 0 }} />}
                    <span>{toast.msg}</span>
                </div>
            )}

            <form onSubmit={e => handleSave(e, false)} noValidate>
                {/* ======== IMAGE UPLOAD ======== */}
                <div className="admin-card mb-4">
                    <h3 style={sectionHeadStyle}>
                        <Upload size={18} style={{ color: 'var(--gold)' }} /> Product Image
                    </h3>

                    {imagePreview ? (
                        /* Preview */
                        <div style={previewContainerStyle}>
                            <img src={imagePreview} alt="Preview" style={previewImgStyle} />
                            <div style={previewActionsStyle}>
                                <button
                                    type="button"
                                    className="btn btn-outline"
                                    onClick={() => fileInputRef.current?.click()}
                                    style={{ fontSize: '0.8125rem', padding: '0.5rem 1rem' }}
                                >
                                    <RefreshCw size={14} /> Change Image
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-danger"
                                    onClick={removeImage}
                                    style={{ fontSize: '0.8125rem', padding: '0.5rem 1rem', border: '1px solid #fca5a5' }}
                                >
                                    <Trash2 size={14} /> Remove
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Drop zone */
                        <div
                            style={{
                                ...dropzoneStyle,
                                borderColor: dragging ? 'var(--gold)' : errors.image ? '#dc2626' : '#dadada',
                                background: dragging ? 'rgba(212,175,55,0.05)' : '#fafafa',
                            }}
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={e => { e.preventDefault(); setDragging(true); }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={handleDrop}
                        >
                            <div style={{ marginBottom: '1rem', color: '#c0c0c0' }}>
                                <Upload size={40} />
                            </div>
                            <p style={{ fontWeight: 600, color: 'var(--main-text)', marginBottom: '0.375rem' }}>
                                Click to upload or drag &amp; drop an image
                            </p>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--main-text-secondary)' }}>
                                JPG, PNG, WebP or GIF — max 10 MB
                            </p>
                        </div>
                    )}
                    <FieldError field="image" />
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleFileInput}
                    />
                </div>

                {/* ======== TWO-COLUMN BODY ======== */}
                <div style={{ ...twoColStyle, gridTemplateColumns: isMobile ? '1fr' : '1fr 360px' }}>
                    {/* LEFT */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                        {/* Basic Info */}
                        <div className="admin-card">
                            <h3 style={sectionHeadStyle}>
                                <Package size={18} style={{ color: 'var(--gold)' }} /> Basic Information
                            </h3>

                            <div className="form-group">
                                <label className="form-label">Product Name <span style={{ color: '#dc2626' }}>*</span></label>
                                <input
                                    type="text"
                                    name="name"
                                    value={form.name}
                                    onChange={handleChange}
                                    className="form-control"
                                    placeholder="e.g. 2 Door Steel Almirah"
                                    style={errors.name ? inputErrStyle : {}}
                                />
                                <FieldError field="name" />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Category <span style={{ color: '#dc2626' }}>*</span></label>
                                <select
                                    name="category"
                                    value={form.category}
                                    onChange={handleChange}
                                    className="form-control"
                                    style={errors.category ? inputErrStyle : {}}
                                >
                                    <option value="">— Select Category —</option>
                                    {CATEGORIES.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                                {form.category === 'Other' || !CATEGORIES.includes(form.category) ? (
                                    <input
                                        type="text"
                                        name="category"
                                        value={CATEGORIES.includes(form.category) ? '' : form.category}
                                        onChange={handleChange}
                                        className="form-control"
                                        placeholder="Enter custom category"
                                        style={{ marginTop: '0.5rem' }}
                                    />
                                ) : null}
                                <FieldError field="category" />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea
                                    name="description"
                                    value={form.description}
                                    onChange={handleChange}
                                    className="form-control"
                                    rows={4}
                                    placeholder="Describe the product — materials, features, uses..."
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">WhatsApp Enquiry Message</label>
                                <textarea
                                    name="whatsappMsg"
                                    value={form.whatsappMsg}
                                    onChange={handleChange}
                                    className="form-control"
                                    rows={2}
                                    placeholder="Pre-filled message for customer WhatsApp enquiry..."
                                />
                            </div>
                        </div>

                        {/* Pricing */}
                        <div className="admin-card">
                            <h3 style={sectionHeadStyle}>
                                <DollarSign size={18} style={{ color: 'var(--gold)' }} /> Pricing
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group mb-0">
                                    <label className="form-label">Selling Price <span style={{ color: '#dc2626' }}>*</span></label>
                                    <div style={inputGroupStyle}>
                                        <span style={prefixStyle}>₹</span>
                                        <input
                                            type="text"
                                            name="price"
                                            value={form.price}
                                            onChange={handleChange}
                                            className="form-control"
                                            placeholder="8,999"
                                            style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, ...(errors.price ? inputErrStyle : {}) }}
                                        />
                                    </div>
                                    <FieldError field="price" />
                                </div>
                                <div className="form-group mb-0">
                                    <label className="form-label">Original / MRP</label>
                                    <div style={inputGroupStyle}>
                                        <span style={prefixStyle}>₹</span>
                                        <input
                                            type="text"
                                            name="oldPrice"
                                            value={form.oldPrice}
                                            onChange={handleChange}
                                            className="form-control"
                                            placeholder="10,999"
                                            style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Specs */}
                        <div className="admin-card">
                            <div className="flex-between" style={{ marginBottom: '1.25rem', flexWrap: 'nowrap' }}>
                                <h3 style={{ ...sectionHeadStyle, marginBottom: 0 }}>
                                    <Layers size={18} style={{ color: 'var(--gold)' }} /> Specifications
                                </h3>
                                <button
                                    type="button"
                                    className="btn btn-outline"
                                    onClick={() => addSpec()}
                                    style={{ fontSize: '0.8125rem', padding: '0.4rem 0.875rem', flexShrink: 0 }}
                                >
                                    <Plus size={14} /> Add
                                </button>
                            </div>

                            {/* Quick-add preset buttons */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                                {SPEC_PRESETS.filter(p => !form.specs.find(s => s.key === p)).map(preset => (
                                    <button
                                        key={preset}
                                        type="button"
                                        onClick={() => addSpec(preset)}
                                        style={presetBtnStyle}
                                    >
                                        + {preset}
                                    </button>
                                ))}
                            </div>

                            {form.specs.length === 0 ? (
                                <p style={{ fontSize: '0.8125rem', color: 'var(--main-text-secondary)', textAlign: 'center', padding: '1.5rem 0' }}>
                                    No specifications added. Use the presets above or click "Add".
                                </p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                                    {form.specs.map((spec, i) => (
                                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr auto', gap: '0.625rem', alignItems: 'center' }}>
                                            <input
                                                type="text"
                                                value={spec.key}
                                                onChange={e => updateSpec(i, 'key', e.target.value)}
                                                className="form-control"
                                                placeholder="Property"
                                                style={{ fontSize: '0.875rem' }}
                                            />
                                            <input
                                                type="text"
                                                value={spec.value}
                                                onChange={e => updateSpec(i, 'value', e.target.value)}
                                                className="form-control"
                                                placeholder="Value"
                                                style={{ fontSize: '0.875rem' }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeSpec(i)}
                                                style={removeSpecBtnStyle}
                                                title="Remove"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                        {/* Inventory */}
                        <div className="admin-card">
                            <h3 style={sectionHeadStyle}>
                                <Hash size={18} style={{ color: 'var(--gold)' }} /> Inventory
                            </h3>
                            <div className="form-group">
                                <label className="form-label">SKU / Product Code</label>
                                <input
                                    type="text"
                                    name="sku"
                                    value={form.sku}
                                    onChange={handleChange}
                                    className="form-control"
                                    placeholder="e.g. RK-ALM-001"
                                />
                            </div>
                            <div className="form-group mb-0">
                                <label className="form-label">Stock / Quantity</label>
                                <input
                                    type="number"
                                    name="stock"
                                    value={form.stock}
                                    onChange={handleChange}
                                    className="form-control"
                                    placeholder="0"
                                    min="0"
                                />
                            </div>
                        </div>

                        {/* Publishing */}
                        <div className="admin-card">
                            <h3 style={sectionHeadStyle}>
                                <Tag size={18} style={{ color: 'var(--gold)' }} /> Publishing
                            </h3>

                            {/* Status radio */}
                            <div className="form-group">
                                <label className="form-label">Product Status</label>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    {['published', 'draft'].map(s => (
                                        <label key={s} style={radioLabelStyle(form.status === s)}>
                                            <input
                                                type="radio"
                                                name="status"
                                                value={s}
                                                checked={form.status === s}
                                                onChange={handleChange}
                                                style={{ display: 'none' }}
                                            />
                                            {s === 'published'
                                                ? <><Eye size={14} /> Active</>
                                                : <><EyeOff size={14} /> Draft</>}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Featured toggle */}
                            <div style={toggleRowStyle}>
                                <input
                                    type="checkbox"
                                    id="featured"
                                    name="featured"
                                    checked={form.featured}
                                    onChange={handleChange}
                                    style={{ width: '18px', height: '18px', flexShrink: 0, accentColor: 'var(--gold)', cursor: 'pointer' }}
                                />
                                <div>
                                    <label htmlFor="featured" style={{ fontWeight: 600, color: 'var(--main-text)', fontSize: '0.875rem', display: 'block', cursor: 'pointer', marginBottom: '0.1rem' }}>
                                        <Star size={14} style={{ display: 'inline', marginRight: '0.3rem', verticalAlign: 'middle' }} />
                                        Featured Product
                                    </label>
                                    <small style={{ color: 'var(--main-text-secondary)', fontSize: '0.8125rem' }}>
                                        Highlights this product on the homepage.
                                    </small>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="admin-card" style={{ background: '#fafafa' }}>
                            <h3 style={{ ...sectionHeadStyle, marginBottom: '1.25rem' }}>
                                Save Product
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <button
                                    type="submit"
                                    className="btn btn-gold"
                                    disabled={saving}
                                    style={{ width: '100%', padding: '0.875rem', fontSize: '1rem', fontWeight: 700 }}
                                >
                                    {saving
                                        ? <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</>
                                        : <><Save size={16} /> {isEditing ? 'Update Product' : 'Save Product'}</>}
                                </button>
                                {!isEditing && (
                                    <button
                                        type="button"
                                        className="btn btn-outline"
                                        disabled={saving}
                                        style={{ width: '100%', padding: '0.75rem' }}
                                        onClick={e => handleSave(e, true)}
                                    >
                                        <Plus size={16} /> Save &amp; Add Another
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="btn btn-ghost"
                                    onClick={() => navigate('/admin/products')}
                                    style={{ width: '100%', padding: '0.625rem', color: 'var(--main-text-secondary)' }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </form>

            {/* Spin animation */}
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

/* ---- Inline styles (avoid polluting CSS) ---- */
const sectionHeadStyle = {
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--main-text)',
    marginBottom: '1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
};

const twoColStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 360px',
    gap: '1.5rem',
    alignItems: 'start',
};

const dropzoneStyle = {
    border: '2px dashed #dadada',
    borderRadius: '10px',
    padding: '3rem 2rem',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'border-color 0.2s, background 0.2s',
    userSelect: 'none',
};

const previewContainerStyle = {
    position: 'relative',
    borderRadius: '10px',
    overflow: 'hidden',
    border: '1px solid var(--card-border)',
    background: '#f8f8f8',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
};

const previewImgStyle = {
    maxHeight: '260px',
    width: '100%',
    objectFit: 'contain',
    padding: '0.75rem',
};

const previewActionsStyle = {
    display: 'flex',
    gap: '0.625rem',
    padding: '0.75rem',
    borderTop: '1px solid var(--card-border)',
    width: '100%',
    justifyContent: 'center',
    background: '#ffffff',
};

const inputErrStyle = { borderColor: '#dc2626' };

const inputGroupStyle = {
    display: 'flex',
    alignItems: 'stretch',
};

const prefixStyle = {
    background: '#f5f5f5',
    border: '1px solid var(--input-border)',
    borderRight: 'none',
    borderRadius: '8px 0 0 8px',
    padding: '0 0.875rem',
    display: 'flex',
    alignItems: 'center',
    color: 'var(--main-text-secondary)',
    fontWeight: 600,
    fontSize: '0.9375rem',
    flexShrink: 0,
};

const presetBtnStyle = {
    background: '#f0f0f0',
    border: '1px solid #e0e0e0',
    borderRadius: '999px',
    padding: '0.25rem 0.75rem',
    fontSize: '0.75rem',
    cursor: 'pointer',
    color: 'var(--main-text)',
    fontWeight: 500,
    transition: 'background 0.15s',
    fontFamily: 'inherit',
};

const removeSpecBtnStyle = {
    background: 'transparent',
    border: '1px solid #fca5a5',
    borderRadius: '6px',
    color: '#dc2626',
    cursor: 'pointer',
    padding: '0.4rem',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
};

const toggleRowStyle = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    padding: '0.875rem 1rem',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    background: '#fafafa',
};

const radioLabelStyle = (active) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.5rem 1rem',
    borderRadius: '8px',
    border: `1px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
    background: active ? 'rgba(212,175,55,0.08)' : '#ffffff',
    color: active ? '#7a5c00' : 'var(--main-text)',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    fontSize: '0.875rem',
    transition: 'all 0.15s',
    userSelect: 'none',
});


export default ProductEditor;

