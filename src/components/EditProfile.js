// src/components/EditProfile.jsx
import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

import './EditProfile.css';

const CLOUD_NAME = 'derrl2nsr';
const UPLOAD_PRESET = 'pulses';

const MAX_DISPLAY_NAME = 50;
const MAX_USERNAME = 30;
const MAX_BIO = 160;

const EditProfile = () => {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile fields
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');

  // Image states
  const [profilePicFile, setProfilePicFile] = useState(null);
  const [profilePicPreview, setProfilePicPreview] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);

  // Password change states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Load user data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('/login');
        return;
      }

      setCurrentUser(user);

      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          setDisplayName(data.displayName || '');
          setUsername(data.username || '');
          setBio(data.bio || '');
          setProfilePicPreview(data.profilePicture || null);
          setBannerPreview(data.bannerUrl || null);
        }
      } catch (err) {
        console.error('Failed to load profile data:', err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      if (profilePicPreview && profilePicPreview.startsWith('blob:')) URL.revokeObjectURL(profilePicPreview);
      if (bannerPreview && bannerPreview.startsWith('blob:')) URL.revokeObjectURL(bannerPreview);
    };
  }, [profilePicPreview, bannerPreview]);

  // Cloudinary upload helper
  const uploadToCloudinary = async (file, folder = 'pulse') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', folder);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      { method: 'POST', body: formData }
    );

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error?.message || 'Upload failed');
    }

    const data = await res.json();
    return data.secure_url;
  };

  // File handlers
  const handleProfilePicChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }

    // Cleanup previous blob URL
    if (profilePicPreview && profilePicPreview.startsWith('blob:')) {
      URL.revokeObjectURL(profilePicPreview);
    }

    const previewUrl = URL.createObjectURL(file);
    setProfilePicFile(file);
    setProfilePicPreview(previewUrl);
  };

  const handleBannerChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }

    // Cleanup previous blob URL
    if (bannerPreview && bannerPreview.startsWith('blob:')) {
      URL.revokeObjectURL(bannerPreview);
    }

    const previewUrl = URL.createObjectURL(file);
    setBannerFile(file);
    setBannerPreview(previewUrl);
  };

  // Save profile handler
  const handleSave = async () => {
    setSaving(true);

    try {
      const updates = {};

      if (displayName.trim()) updates.displayName = displayName.trim();
      if (username.trim()) updates.username = username.trim().toLowerCase();
      if (bio.trim() !== undefined) updates.bio = bio.trim();

      if (profilePicFile) {
        updates.profilePicture = await uploadToCloudinary(profilePicFile, 'pulse/avatars');
      }

      if (bannerFile) {
        updates.bannerUrl = await uploadToCloudinary(bannerFile, 'pulse/banners');
      }

      if (Object.keys(updates).length === 0) {
        alert('No changes to save');
        setSaving(false);
        return;
      }

      await updateDoc(doc(db, 'users', currentUser.uid), updates);
      alert('Profile updated successfully! 🎉');
      navigate(`/profile`);
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Password change handler
  const handleChangePassword = async () => {
    // Reset messages
    setPasswordError('');
    setPasswordSuccess('');

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordError('New password must be different from current password');
      return;
    }

    setChangingPassword(true);

    try {
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        currentPassword
      );
      
      await reauthenticateWithCredential(currentUser, credential);
      
      // Update password
      await updatePassword(currentUser, newPassword);
      
      // Success
      setPasswordSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setPasswordSuccess('');
        setShowPasswordModal(false);
      }, 3000);
      
    } catch (err) {
      console.error('Password change failed:', err);
      
      switch (err.code) {
        case 'auth/wrong-password':
          setPasswordError('Current password is incorrect');
          break;
        case 'auth/requires-recent-login':
          setPasswordError('Please log in again to change your password');
          break;
        case 'auth/weak-password':
          setPasswordError('New password is too weak');
          break;
        default:
          setPasswordError('Failed to change password. Please try again.');
      }
    } finally {
      setChangingPassword(false);
    }
  };

  // Close password modal
  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setPasswordSuccess('');
  };

  if (loading) {
    return <div className="edit-loading">Loading your profile...</div>;
  }

  return (
    <>
      <div className="edit-profile-page">
        {/* Header */}
        <header className="edit-header">
          <button className="back-btn" onClick={() => navigate(-1)} aria-label="Back">
            ✕
          </button>
          <h1>Edit Profile</h1>
          <button className="save-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </header>

        {/* Main Content */}
        <main className="edit-main">
          {/* Banner */}
          <div className="banner-section">
            <div className="banner-preview">
              {bannerPreview ? (
                <img src={bannerPreview} alt="Banner preview" />
              ) : (
                <div className="banner-placeholder">
                  <span>No banner</span>
                </div>
              )}
              <div className="banner-overlay-container">
                <label className="change-banner-btn">
                  <span>Change Banner</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleBannerChange} 
                    className="banner-file-input"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Profile Picture */}
          <div className="profile-pic-section">
            <div className="profile-pic-preview">
              {profilePicPreview ? (
                <img src={profilePicPreview} alt="Profile preview" />
              ) : (
                <div className="profile-pic-placeholder">
                  <span>{displayName?.[0]?.toUpperCase() || '?'}</span>
                </div>
              )}
              <div className="profile-pic-overlay">
                <label className="change-pic-btn">
                  <span>Change</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleProfilePicChange} 
                    className="profile-pic-file-input"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="form-section">
            <div className="input-group">
              <label>Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={MAX_DISPLAY_NAME}
                placeholder="Your display name"
              />
              <span className="char-count">{displayName.length}/{MAX_DISPLAY_NAME}</span>
            </div>

            <div className="input-group">
              <label>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-z0-9_]/gi, ''))}
                maxLength={MAX_USERNAME}
                placeholder="yourusername"
              />
              <span className="char-count">{username.length}/{MAX_USERNAME}</span>
            </div>

            <div className="input-group">
              <label>Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={MAX_BIO}
                rows={4}
                placeholder="Tell us about yourself..."
              />
              <span className="char-count">{bio.length}/{MAX_BIO}</span>
            </div>

            {/* Change Password Button */}
            <div className="password-section">
              <h3>Account Security</h3>
              <button 
                className="change-password-btn"
                onClick={() => setShowPasswordModal(true)}
              >
                Change Password
              </button>
              <p className="password-hint">
                You'll be asked to enter your current password to change it.
              </p>
            </div>
          </div>
        </main>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={closePasswordModal}>
          <div className="password-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Change Password</h2>
              <button className="modal-close" onClick={closePasswordModal}>✕</button>
            </div>
            
            <div className="modal-body">
              {passwordSuccess ? (
                <div className="success-message">
                  <span className="success-icon">✓</span>
                  <p>{passwordSuccess}</p>
                </div>
              ) : (
                <>
                  <div className="modal-input-group">
                    <label>Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                    />
                  </div>
                  
                  <div className="modal-input-group">
                    <label>New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                    />
                  </div>
                  
                  <div className="modal-input-group">
                    <label>Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                    />
                  </div>
                  
                  {passwordError && (
                    <div className="error-message">
                      <span className="error-icon">⚠</span>
                      <p>{passwordError}</p>
                    </div>
                  )}
                  
                  <div className="modal-actions">
                    <button 
                      className="cancel-btn" 
                      onClick={closePasswordModal}
                      disabled={changingPassword}
                    >
                      Cancel
                    </button>
                    <button 
                      className="confirm-btn" 
                      onClick={handleChangePassword}
                      disabled={changingPassword}
                    >
                      {changingPassword ? 'Changing...' : 'Change Password'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EditProfile;