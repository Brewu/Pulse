// src/components/Signup.jsx
import { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import axios from 'axios';
import { getRankFromScore, SIGNUP_BONUS } from '../utils/ranking';

import { auth, db } from '../firebase';
import './Signup.css';

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'your-cloud-name-here';
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'profile_pics_unsigned';

const rankTiers = [
  { min: 0, name: 'New Member', color: '#9ca3af' },
  { min: 50, name: 'Active', color: '#3b82f6' },
  { min: 250, name: 'Rising Star', color: '#8b5cf6' },
  { min: 1000, name: 'Influencer', color: '#ec4899' },
  { min: 5000, name: 'Pulse Legend', color: '#eab308' },
];

const Signup = () => {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  });

  const [form, setForm] = useState({
    username: '', email: '', phone: '', password: '', confirmPassword: '',
    profilePicture: null, termsAccepted: false,
  });

  const [preview, setPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const validate = (name, value, values = form) => {
    switch (name) {
      case 'username': return !value.trim() ? 'Required' : value.trim().length < 3 ? '≥ 3 chars' : '';
      case 'email': return !value.trim() ? 'Required' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? 'Invalid email' : '';
      case 'phone': return value.trim() && !/^\+?[1-9][0-9\s-]{6,14}$/.test(value) ? 'Invalid format' : '';
      case 'password': return !value ? 'Required' : value.length < 8 ? '≥ 8 chars' : '';
      case 'confirmPassword': return value !== values.password ? 'No match' : '';
      case 'termsAccepted': return value ? '' : 'Required';
      default: return '';
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    let newVal = type === 'checkbox' ? checked : type === 'file' ? files?.[0] : value;

    if (type === 'file') {
      if (!newVal) return;
      if (!newVal.type.startsWith('image/')) return setErrors(p => ({ ...p, profilePicture: 'Images only' }));
      if (newVal.size > 5 * 1024 * 1024) return setErrors(p => ({ ...p, profilePicture: 'Max 5 MB' }));

      setPreview(URL.createObjectURL(newVal));
      setErrors(p => ({ ...p, profilePicture: '' }));
    }

    setForm(p => ({ ...p, [name]: newVal }));

    if (touched[name]) {
      setErrors(p => ({ ...p, [name]: validate(name, newVal, { ...form, [name]: newVal }) }));
    }
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched(p => ({ ...p, [name]: true }));
    setErrors(p => ({ ...p, [name]: validate(name, form[name], form) }));
  };

  const uploadPhoto = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', UPLOAD_PRESET);

    const { data } = await axios.post(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      fd,
      { onUploadProgress: e => e.total && setUploadProgress(Math.round(e.loaded * 100 / e.total)) }
    );

    return data.secure_url;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const errs = {};
    Object.keys(form).forEach(k => {
      const err = validate(k, form[k], form);
      if (err) errs[k] = err;
    });

    if (Object.keys(errs).length) {
      setErrors(errs);
      setTouched(Object.fromEntries(Object.keys(form).map(k => [k, true])));
      return;
    }

    setSubmitting(true);

    try {
      let photo = '';
      if (form.profilePicture) photo = await uploadPhoto(form.profilePicture);

      const { user } = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);

      let phone = form.phone.trim().replace(/[\s\-()]/g, '');
      if (phone && !phone.startsWith('+')) phone = `+${phone}`;


      const initialScore = SIGNUP_BONUS;
      const initialRank = getRankFromScore(initialScore);

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,

        // Identity
        username: form.username.trim(),
        displayName: form.username.trim(),
        email: form.email.toLowerCase().trim(),
        phone: phone || null,
        profilePicture: photo,
        bio: '',

        // Social
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        likesReceived: 0,

        // 🔥 Ranking System
        activityScore: initialScore,
        rank: initialRank,
        streakDays: 1,

        // Activity tracking
        lastActiveAt: serverTimestamp(),
        lastActiveDate: new Date().toDateString(),
        isActive: true,

        // Meta
        createdAt: serverTimestamp(),
      });


      window.location.href = '/';
    } catch (err) {
      const msg =
        err.code === 'auth/email-already-in-use' ? 'Email already taken' :
          err.code === 'auth/invalid-email' ? 'Invalid email' :
            err.code === 'auth/weak-password' ? 'Password too weak' :
              'Something went wrong';

      setErrors({ general: msg });
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`signup-page ${theme}`}>
      <button className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
        {theme === 'dark' ? <i className="bi bi-sun-fill" /> : <i className="bi bi-moon-stars-fill" />}
      </button>

      <div className="split-layout">
        <div className="brand-side">
          <div className="brand-content">
            <div className="logo-row">
              <div className="pulse-container">
                <div className="pulse-ring" />
                <div className="pulse-ring delay" />
                <i className="bi bi-activity pulse-icon" />
              </div>
              <h1>Pulse</h1>
            </div>
            <h2>Real connections.<br />Real moments.</h2>
            <p>Join people sharing thoughts, photos, and conversations — instantly.</p>
            <ul className="features">
              <li><i className="bi bi-chat-square-text-fill" /> Live conversations</li>
              <li><i className="bi bi-people-fill" /> Global community</li>
              <li><i className="bi bi-shield-check-fill" /> Private & secure</li>
            </ul>
          </div>
        </div>

        <div className="form-side">
          <div className="form-card">
            <h2>Create Account</h2>
            <p className="subtitle">It's free and takes under a minute</p>

            {errors.general && (
              <div className="error-banner">
                <i className="bi bi-exclamation-triangle-fill" />
                {errors.general}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group avatar-group">
                <label className="avatar-label">
                  <div className="avatar-preview">
                    {preview ? <img src={preview} alt="" /> : <i className="bi bi-person" />}
                  </div>
                  <span>Upload photo (optional)</span>
                  <input type="file" accept="image/*" onChange={handleChange} hidden />
                </label>
                {errors.profilePicture && <div className="error">{errors.profilePicture}</div>}
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="progress-bar"><div style={{ width: `${uploadProgress}%` }} /></div>
                )}
              </div>

              {[
                { name: 'username', label: 'Username', type: 'text', ph: 'e.g. brewmaster' },
                { name: 'email', label: 'Email', type: 'email', ph: 'you@example.com' },
                { name: 'phone', label: 'Phone (optional)', type: 'tel', ph: '+233 123 456 789' },
                { name: 'password', label: 'Password', type: 'password', ph: '≥ 8 characters' },
                { name: 'confirmPassword', label: 'Confirm password', type: 'password', ph: 'Re-enter password' },
              ].map(f => (
                <div key={f.name} className="form-group">
                  <label>{f.label}</label>
                  <input
                    name={f.name}
                    type={f.type}
                    placeholder={f.ph}
                    value={form[f.name] ?? ''}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={touched[f.name] && errors[f.name] ? 'invalid' : ''}
                  />
                  {touched[f.name] && errors[f.name] && <div className="error">{errors[f.name]}</div>}
                </div>
              ))}

              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    name="termsAccepted"
                    checked={form.termsAccepted}
                    onChange={handleChange}
                    onBlur={handleBlur}
                  />
                  I agree to <a href="/terms">Terms</a> & <a href="/privacy">Privacy Policy</a>
                </label>
                {touched.termsAccepted && errors.termsAccepted && <div className="error">{errors.termsAccepted}</div>}
              </div>

              <button type="submit" disabled={submitting} className={`btn-submit ${submitting ? 'loading' : ''}`}>
                {submitting ? <>Creating account…</> : 'Sign Up'}
              </button>

              <p className="login-link">
                Already have an account? <a href="/login">Sign in</a>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;