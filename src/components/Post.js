// src/components/Post.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  increment,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { formatDistanceToNow } from 'date-fns';

import { parseText } from '../utils/parseText';
import './Post.css';

const Post = () => {
  const { postId } = useParams();
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [animatingLike, setAnimatingLike] = useState(false);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) navigate('/login');
    });
    return () => unsubscribe();
  }, [navigate]);

  // Fetch post + track view
  useEffect(() => {
    if (!postId || !currentUser) return;

    const fetchPost = async () => {
      setLoading(true);
      setError(null);
      try {
        const postRef = doc(db, 'posts', postId);
        const snap = await getDoc(postRef);

        if (!snap.exists()) {
          setError('Post not found');
          navigate('/', { replace: true });
          return;
        }

        const data = snap.data();

        // Fetch author's profile picture from 'users' collection
        const userSnap = await getDoc(doc(db, 'users', data.userId));
        const userData = userSnap.exists() ? userSnap.data() : {};

        setPost({
          id: postId,
          ...data,
          profilePicture: userData.profilePicture || null,
          userName: userData.displayName || data.userName || 'Anonymous',
          userRank: userData.rank || null,
        });

        // Track view...
      } catch (err) {
        console.error('Fetch post error:', err);
        setError(err.message || 'Failed to load post');
      } finally {
        setLoading(false);
      }
    };


    fetchPost();
  }, [postId, currentUser, navigate]);

  // Real-time comments
  useEffect(() => {
    if (!postId) return;

    const q = query(
      collection(db, 'posts', postId, 'comments'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const loaded = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setComments(loaded);
      },
      (err) => console.error('Comments listener error:', err)
    );

    return () => unsubscribe();
  }, [postId]);

  // Like handler with animation
  const handleLike = async () => {
    if (!currentUser || !post) return;

    const wasLiked = post.likesUsers?.includes(currentUser.uid) ?? false;
    const delta = wasLiked ? -1 : 1;

    // Trigger animation only on like
    if (delta > 0) {
      setAnimatingLike(true);
      setTimeout(() => setAnimatingLike(false), 800);
    }

    // Optimistic update
    setPost((prev) => ({
      ...prev,
      likes: (prev.likes || 0) + delta,
      likesUsers: wasLiked
        ? prev.likesUsers.filter((uid) => uid !== currentUser.uid)
        : [...(prev.likesUsers || []), currentUser.uid],
    }));

    try {
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        likes: increment(delta),
        likesUsers: wasLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
      });

      await updateDoc(doc(db, 'users', post.userId), {
        likesReceived: increment(delta),
      });
    } catch (err) {
      console.error('Like failed:', err);
      // Rollback
      setPost((prev) => ({
        ...prev,
        likes: (prev.likes || 0) - delta,
        likesUsers: wasLiked
          ? [...(prev.likesUsers || []), currentUser.uid]
          : prev.likesUsers.filter((uid) => uid !== currentUser.uid),
      }));
    }
  };

  // Comment submission
  const handleCommentSubmit = async () => {
    if (!commentText.trim() || !currentUser) return;

    const trimmed = commentText.trim();
    const tempId = `temp-${Date.now()}`;

    const optimistic = {
      id: tempId,
      userId: currentUser.uid,
      userName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
      profilePicture: currentUser.photoURL || null,
      content: trimmed,
      createdAt: new Date(),
      isTemp: true,
    };

    setComments((prev) => [...prev, optimistic]);
    setCommentText('');

    try {
      await addDoc(collection(db, 'posts', postId, 'comments'), {
        userId: currentUser.uid,
        userName: optimistic.userName,
        profilePicture: optimistic.profilePicture,
        content: trimmed,
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'posts', postId), {
        commentsCount: increment(1),
      });
    } catch (err) {
      console.error('Comment error:', err);
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setCommentText(trimmed);
      alert('Failed to post comment');
    }
  };

  // Delete comment
  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Delete this comment?')) return;

    try {
      await deleteDoc(doc(db, 'posts', postId, 'comments', commentId));
      await updateDoc(doc(db, 'posts', postId), {
        commentsCount: increment(-1),
      });
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete comment');
    }
  };

  const formatTime = (ts) => {
    if (!ts) return 'just now';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return formatDistanceToNow(date, { addSuffix: true });
  };

  if (loading) {
    return <div className="post-page loading">Loading post...</div>;
  }

  if (error || !post) {
    return (
      <div className="post-page error-state">
        <h2>{error || 'Post not found'}</h2>
        <button onClick={() => navigate('/')}>Go Home</button>
      </div>
    );
  }

  const isLiked = currentUser && post.likesUsers?.includes(currentUser.uid);

  return (
    <div className="post-page">
      {/* Header */}
      <header className="post-header">
        <button className="back-btn" onClick={() => navigate(-1)} aria-label="Back">
          ←
        </button>
        <h1>Post</h1>
      </header>

      {/* Main Content */}
      <main className="post-main">
        {/* Post Card */}
        <article className="post-card">
          {/* Author */}
          <button
            className="author-section"
            onClick={() => navigate(`/profile/${post.userId}`)}
          >
            <div className="author-avatar">
              <img
                src={post.profilePicture || 'https://via.placeholder.com/80'}
                alt={post.userName}
              />
            </div>
            <div className="author-info">
              <div className="author-name-line">
                <span className="author-name">{post.userName || 'Anonymous'}</span>
                {post.userRank && <span className="author-rank">{post.userRank}</span>}
              </div>
              <span className="post-time">{formatTime(post.createdAt)}</span>
            </div>
          </button>

          {/* Content */}
          <div className="post-content">
            <p className="post-text">{parseText(post.content || '', navigate)}</p>

            {post.mediaUrl && (
              <div className="post-media">
                {post.mediaType === 'image' && (
                  <img src={post.mediaUrl} alt="Post media" loading="lazy" />
                )}
                {post.mediaType === 'video' && (
                  <video src={post.mediaUrl} controls className="media-video" />
                )}
                {post.mediaType === 'audio' && (
                  <audio src={post.mediaUrl} controls className="media-audio" />
                )}
              </div>
            )}
          </div>

          {/* Stats & Like */}
          <div className="post-actions">
            <button
              className={`like-action ${isLiked ? 'liked' : ''} ${animatingLike ? 'animating' : ''}`}
              onClick={handleLike}
              aria-label={isLiked ? 'Unlike' : 'Like'}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 20 20"
                className="heart-icon"
                fill={isLiked ? 'currentColor' : 'none'}
              >
                <path
                  d="M10 17.5L8.825 16.45C4.5 12.525 1.875 10.15 1.875 7.25C1.875 4.875 3.625 3.125 6 3.125C7.325 3.125 8.6 3.7 9.5 4.625C10.4 3.7 11.675 3.125 13 3.125C15.375 3.125 17.125 4.875 17.125 7.25C17.125 10.15 14.5 12.525 10.175 16.45L10 17.5Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="count">{post.likes || 0}</span>
            </button>

            <div className="stat">
              <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
                <path
                  d="M17 9C17 12.866 13.866 16 10 16C8.937 16 7.937 15.772 7.05 15.368L3 17L4.368 13.05C3.772 12.133 3.5 11.107 3.5 10C3.5 6.134 6.634 3 10 3C13.866 3 17 6.134 17 9Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
              <span>{post.commentsCount || 0}</span>
            </div>

            <div className="stat">
              <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
                <path
                  d="M10 3V6M10 14V17M17 10H14M6 10H3M15.5 4.5L13 7M15.5 15.5L13 13M4.5 4.5L7 7M4.5 15.5L7 13"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <span>{post.views || 0}</span>
            </div>
          </div>
        </article>

        {/* Comments */}
        <section className="comments-section">
          <h2>Comments ({comments.length})</h2>

          <div className="comment-composer">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) =>
                e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleCommentSubmit())
              }
              placeholder="Write a comment..."
            />
            <button onClick={handleCommentSubmit} disabled={!commentText.trim()}>
              Send
            </button>
          </div>

          {comments.length === 0 ? (
            <p className="no-comments">No comments yet. Start the conversation!</p>
          ) : (
            <div className="comments-list">
              {comments.map((comment) => {
                const isOwn = currentUser && comment.userId === currentUser.uid;

                return (
                  <div key={comment.id} className="comment">
                    <img
                      src={comment.profilePicture || 'https://via.placeholder.com/40'}
                      alt={comment.userName}
                      className="comment-avatar"
                    />
                    <div className="comment-body">
                      <div className="comment-meta">
                        <strong>{comment.userName || 'Anonymous'}</strong>
                        <span className="comment-time">{formatTime(comment.createdAt)}</span>
                        {isOwn && (
                          <button
                            className="delete-comment"
                            onClick={() => handleDeleteComment(comment.id)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                      <p className="comment-text">{parseText(comment.content || '', navigate)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Post;