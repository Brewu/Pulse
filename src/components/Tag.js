// src/components/Tag.jsx
import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

import './Tag.css';

const Tag = () => {
  const { tag } = useParams();
  const navigate = useNavigate();

  const [tagPosts, setTagPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tag) return;

    setLoading(true);

    const q = query(
      collection(db, 'posts'),
      where('hashtags', 'array-contains', tag)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const posts = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Sort newest first
        posts.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        setTagPosts(posts);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching tag posts:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [tag]);

  const formatTime = (ts) => {
    if (!ts?.seconds) return 'just now';
    return formatDistanceToNow(new Date(ts.seconds * 1000), { addSuffix: true });
  };

  return (
    <div className="tag-page">
      {/* Header with back button */}
      <header className="tag-header">
        <button className="back-btn" onClick={() => navigate(-1)} aria-label="Back">
          ←
        </button>
        <div className="tag-title">
          <h1>#{tag}</h1>
          <p className="post-count">{tagPosts.length} posts</p>
        </div>
      </header>

      {/* Content */}
      <main className="tag-content">
        {loading ? (
          <div className="loading-state">
            <div className="spinner" />
            <p>Loading posts...</p>
          </div>
        ) : tagPosts.length === 0 ? (
          <div className="empty-state">
            <p>No posts with #{tag} yet.</p>
            <p>Be the first to use this tag!</p>
          </div>
        ) : (
          <div className="tag-posts-grid">
            {tagPosts.map((post) => (
              <Link key={post.id} to={`/post/${post.id}`} className="tag-post-card">
                {/* Author header */}
                <div className="post-author">
                  <div className="author-avatar">
                    <img
                      src={post.profilePicture || 'https://via.placeholder.com/40'}
                      alt={post.userName}
                    />
                  </div>
                  <div className="author-info">
                    <span className="author-name">{post.userName || 'Anonymous'}</span>
                    <span className="post-time">{formatTime(post.createdAt)}</span>
                  </div>
                </div>

                {/* Post content */}
                <div className="post-body">
                  <p className="post-text">{post.content}</p>

                  {post.mediaUrl && (
                    <div className="post-media-preview">
                      {post.mediaType === 'image' && (
                        <img src={post.mediaUrl} alt="Post media" loading="lazy" />
                      )}
                      {post.mediaType === 'video' && (
                        <video src={post.mediaUrl} muted loop playsInline />
                      )}
                      {post.mediaType === 'audio' && (
                        <div className="audio-preview">
                          <audio src={post.mediaUrl} controls />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Quick stats */}
                <div className="post-stats">
                  <span className="stat">
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                      <path
                        d="M10 17.5L8.825 16.45C4.5 12.525 1.875 10.15 1.875 7.25C1.875 4.875 3.625 3.125 6 3.125C7.325 3.125 8.6 3.7 9.5 4.625C10.4 3.7 11.675 3.125 13 3.125C15.375 3.125 17.125 4.875 17.125 7.25C17.125 10.15 14.5 12.525 10.175 16.45L10 17.5Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                    </svg>
                    {post.likes || 0}
                  </span>
                  <span className="stat">
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                      <path
                        d="M17 9C17 12.866 13.866 16 10 16C8.937 16 7.937 15.772 7.05 15.368L3 17L4.368 13.05C3.772 12.133 3.5 11.107 3.5 10C3.5 6.134 6.634 3 10 3C13.866 3 17 6.134 17 9Z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                    </svg>
                    {post.commentsCount || 0}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Tag;