// src/components/Create.jsx
import React, { useState, useRef, useEffect } from 'react';
import { auth, db } from '../firebase';
import {
  collection,
  addDoc,
  doc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import imageCompression from 'browser-image-compression';
import EmojiPicker from 'emoji-picker-react';
import './Create.css';

const CLOUD_NAME = 'derrl2nsr';
const UPLOAD_PRESET = 'pulses';
const MAX_RECORDING_SECONDS = 180; // 3 minutes max
const MAX_TEXT_LENGTH = 500;

const Create = () => {
  // ── States ──────────────────────────────────────────────────────
  const [text, setText] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaType, setMediaType] = useState(''); // 'image' | 'video' | 'audio'
  const [mediaPreview, setMediaPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  // ── Helpers ─────────────────────────────────────────────────────
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ── Voice Recording ─────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });

        setMediaFile(file);
        setMediaType('audio');
        setMediaPreview(url);
        // Keep the final recordingTime for display
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const next = prev + 1;
          if (next >= MAX_RECORDING_SECONDS) {
            stopRecording();
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Unable to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    setIsRecording(false);
    clearInterval(timerRef.current);
  };

  // ── Media Upload & Processing ───────────────────────────────────
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Clear previous media
    setMediaFile(null);
    setMediaType('');
    setMediaPreview(null);
    setRecordingTime(0);

    try {
      if (file.type.startsWith('image/')) {
        let processed = file;
        if (file.size > 2 * 1024 * 1024) {
          processed = await imageCompression(file, {
            maxSizeMB: 1.5,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
          });
        }
        const url = URL.createObjectURL(processed);
        setMediaFile(processed);
        setMediaType('image');
        setMediaPreview(url);
      } else if (file.type.startsWith('video/')) {
        if (file.size > 10 * 1024 * 1024) {
          alert('Video must be 10MB or smaller.');
          return;
        }
        const url = URL.createObjectURL(file);
        setMediaFile(file);
        setMediaType('video');
        setMediaPreview(url);
      } else if (file.type.startsWith('audio/')) {
        if (file.size > 10 * 1024 * 1024) {
          alert('Audio must be 10MB or smaller.');
          return;
        }
        const url = URL.createObjectURL(file);
        setMediaFile(file);
        setMediaType('audio');
        setMediaPreview(url);
      } else {
        alert('Unsupported file type. Please upload image, video, or audio.');
      }
    } catch (err) {
      console.error('Media processing error:', err);
      alert('Failed to process file.');
    }
  };

  const removeMedia = () => {
    setMediaPreview(null);
    setMediaFile(null);
    setMediaType('');
    setRecordingTime(0);
  };

  // ── Cloudinary Upload ───────────────────────────────────────────
  const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', 'pulse');

    const resourceType = mediaType === 'audio' ? 'raw' : mediaType;
    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;

    const res = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error?.message || 'Upload failed');
    }

    const data = await res.json();
    return data.secure_url;
  };

  // ── Post Submission ─────────────────────────────────────────────
  const handleSubmit = async () => {
    const trimmedText = text.trim();
    if (!trimmedText && !mediaFile) {
      alert('Add some text or media to your pulse!');
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');

      let userName = user.displayName;
      if (!userName) {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        userName = userSnap.exists() ? userSnap.data().username || 'Anonymous' : 'Anonymous';
      }

      let mediaUrl = null;
      if (mediaFile) {
        mediaUrl = await uploadToCloudinary(mediaFile);
      }

      await addDoc(collection(db, 'posts'), {
        content: trimmedText,
        userId: user.uid,
        userName,
        profilePicture: user.photoURL || null,
        mediaUrl,
        mediaType: mediaFile ? mediaType : null,
        likes: 0,
        likesUsers: [],
        commentsCount: 0,
        views: 0,
        viewsUsers: [],
        createdAt: serverTimestamp(),
      });

      // Success cleanup
      setText('');
      removeMedia();
      setShowEmojiPicker(false);
      alert('Pulse posted successfully! 🎉');
    } catch (err) {
      console.error('Post creation failed:', err);
      alert('Failed to post. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Cleanup Effects ─────────────────────────────────────────────
  // Revoke object URLs when mediaPreview changes or on unmount
  useEffect(() => {
    return () => {
      if (mediaPreview) {
        URL.revokeObjectURL(mediaPreview);
      }
    };
  }, [mediaPreview]);

  // Stop any ongoing recording on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="create-page">
      <header className="create-header">
        <button className="close-btn" onClick={() => window.history.back()}>
          ✕
        </button>
        <h2>Create Pulse</h2>
        <div className="header-spacer" />
      </header>

      <main className="create-main">
        <div className="text-input-section">
          <textarea
            placeholder="What's on your mind?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_TEXT_LENGTH}
            rows={5}
            disabled={loading}
          />
          <div className="text-meta">
            <span className="char-count">
              {text.length}/{MAX_TEXT_LENGTH}
            </span>
            <button
              className="emoji-toggle"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              disabled={loading}
            >
              😊
            </button>
          </div>

          {showEmojiPicker && (
            <div className="emoji-picker-wrapper">
              <EmojiPicker
                onEmojiClick={(emoji) => {
                  setText((prev) => prev + emoji.emoji);
                  setShowEmojiPicker(false);
                }}
                previewConfig={{ showPreview: false }}
              />
            </div>
          )}
        </div>

        {mediaPreview && (
          <div className="media-preview-section">
            <div className="preview-container">
              {mediaType === 'image' && (
                <img src={mediaPreview} alt="Preview" />
              )}
              {mediaType === 'video' && (
                <video src={mediaPreview} controls muted />
              )}
              {mediaType === 'audio' && (
                <div className="audio-preview">
                  <audio src={mediaPreview} controls />
                  <p>
                    {recordingTime > 0
                      ? `Voice note • ${formatTime(recordingTime)}`
                      : 'Audio file'}
                  </p>
                </div>
              )}
            </div>
            <button className="remove-media-btn" onClick={removeMedia} disabled={loading}>
              Remove
            </button>
          </div>
        )}

        <div className="media-actions">
          <label className="media-btn">
            📷
            <input
              type="file"
              accept="image/*,video/*,audio/*"
              onChange={handleFileChange}
              disabled={loading || isRecording}
              hidden
            />
          </label>

          <button
            className={`record-btn ${isRecording ? 'recording' : ''}`}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={loading || !!mediaFile}
          >
            {isRecording ? (
              <>
                <span className="recording-indicator">●</span>
                {formatTime(recordingTime)}
              </>
            ) : (
              '🎤 Voice'
            )}
          </button>
        </div>

        <button
          className="submit-btn"
          onClick={handleSubmit}
          disabled={loading || (!text.trim() && !mediaFile)}
        >
          {loading ? 'Posting...' : 'Post Pulse'}
        </button>
      </main>
    </div>
  );
};

export default Create;
