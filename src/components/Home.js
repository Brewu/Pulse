// src/components/Home.jsx
import { useState, useEffect, useRef } from 'react';
import { auth, db } from '../firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  increment,
  arrayUnion,
  arrayRemove,
  serverTimestamp
} from 'firebase/firestore';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { getRankFromScore } from '../utils/ranking';
import { parseText } from '../utils/parseText';

import './Home.css';

const Home = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [animatingLikeId, setAnimatingLikeId] = useState(null);
  
  const menuRef = useRef(null);
  const startY = useRef(0);
  const navigate = useNavigate();

  /**
   * Calculate feed score for post ranking
   */
  const getFeedScore = (post) => {
    const interaction = (post.likes || 0) * 2 + (post.commentsCount || 0);
    const rankBoost =
      post.userRank?.includes('Pulse Legend') ? 20 :
        post.userRank?.includes('Influencer') ? 10 :
          post.userRank?.includes('Rising') ? 5 : 0;
    return interaction + rankBoost;
  };

  /**
   * Reward user for daily activity
   */
  const rewardDailyActivity = async (userSnap, uid) => {
    if (!userSnap.exists()) return;

    const data = userSnap.data();
    const today = new Date().toDateString();

    if (data.lastActiveDate === today) return;

    const lastActive = data.lastActiveAt?.toDate?.();
    if (lastActive) {
      const daysAway = (Date.now() - lastActive.getTime()) / 86400000;
      if (daysAway >= 14) {
        await updateDoc(doc(db, 'users', uid), {
          activityScore: Math.floor((data.activityScore || 0) * 0.5),
          streakDays: 0,
        });
        return;
      }
    }

    const newScore = (data.activityScore || 0) + 15;
    const newStreak = (data.streakDays || 0) + 1;

    await updateDoc(doc(db, 'users', uid), {
      activityScore: newScore,
      streakDays: newStreak,
      lastActiveDate: today,
      lastActiveAt: serverTimestamp(),
      rank: getRankFromScore(newScore),
    });
  };

  /**
   * Refresh posts
   */
  const refreshPosts = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);

    try {
      const snap = await getDocs(collection(db, 'posts'));
      const data = await Promise.all(
        snap.docs.map(async (d) => {
          const postData = { id: d.id, ...d.data() };
          
          // Fetch user data for each post
          try {
            const userSnap = await getDoc(doc(db, 'users', postData.userId));
            const userData = userSnap.exists() ? userSnap.data() : {};
            return {
              ...postData,
              profilePicture: userData.profilePicture || null,
              userName: userData.displayName || userData.username || postData.userName || 'Anonymous',
              userRank: userData.rank || null,
            };
          } catch (err) {
            console.error('Failed to fetch user for post', postData.id, err);
            return postData;
          }
        })
      );

      const sorted = data.sort((a, b) => getFeedScore(b) - getFeedScore(a));
      setPosts(sorted);
    } catch (error) {
      console.error('Failed to refresh posts:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  /**
   * Authentication setup
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        navigate('/login');
        return;
      }

      setUser(u);

      try {
        const snap = await getDoc(doc(db, 'users', u.uid));
        if (snap.exists()) {
          await rewardDailyActivity(snap, u.uid);
          const refreshed = await getDoc(doc(db, 'users', u.uid));
          setUserData(refreshed.data());
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    });

    return unsubscribe;
  }, [navigate]);

  /**
   * First visit check
   */
  useEffect(() => {
    const firstVisit = localStorage.getItem('pulse_first_visit');
    if (!firstVisit) {
      setShowTour(true);
      localStorage.setItem('pulse_first_visit', 'true');
    }
  }, []);

  /**
   * Close menu on click outside
   */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Real-time posts subscription - FIXED PROFILE PICTURES
   */
  useEffect(() => {
    const q = query(
      collection(db, 'posts'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snap) => {
      const data = await Promise.all(
        snap.docs.map(async (d) => {
          const postData = { id: d.id, ...d.data() };
          
          try {
            // Fetch user data from users collection
            const userSnap = await getDoc(doc(db, 'users', postData.userId));
            const userData = userSnap.exists() ? userSnap.data() : {};
            
            return {
              ...postData,
              // Use the actual profile picture URL from user data
              profilePicture: userData.profilePicture || null,
              // Prefer displayName, fallback to username, then post data, then Anonymous
              userName: userData.displayName || userData.username || postData.userName || 'Anonymous',
              userRank: userData.rank || null,
            };
          } catch (err) {
            console.error('Failed to fetch user for post', postData.id, err);
            return postData;
          }
        })
      );

      const sorted = data.sort((a, b) => getFeedScore(b) - getFeedScore(a));
      setPosts(sorted);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  /**
   * Like post handler with animation
   */
  const likePost = async (post) => {
    if (!user) return;

    const postRef = doc(db, 'posts', post.id);
    const ownerRef = doc(db, 'users', post.userId);
    const wasLiked = post.likesUsers?.includes(user.uid) ?? false;
    const delta = wasLiked ? -1 : 1;

    if (delta > 0) {
      setAnimatingLikeId(post.id);
      setTimeout(() => setAnimatingLikeId(null), 800);
    }

    // Optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? {
              ...p,
              likes: (p.likes || 0) + delta,
              likesUsers: wasLiked
                ? (p.likesUsers || []).filter((id) => id !== user.uid)
                : [...(p.likesUsers || []), user.uid],
            }
          : p
      )
    );

    try {
      await updateDoc(postRef, {
        likes: increment(delta),
        likesUsers: wasLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
      });
      await updateDoc(ownerRef, {
        likesReceived: increment(delta),
        activityScore: increment(delta > 0 ? 2 : -2),
      });
    } catch (err) {
      console.error('Like failed:', err);
      // Rollback
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                likes: (p.likes || 0) - delta,
                likesUsers: wasLiked
                  ? [...(p.likesUsers || []), user.uid]
                  : (p.likesUsers || []).filter((id) => id !== user.uid),
              }
            : p
        )
      );
    }
  };

  /**
   * Theme toggle
   */
  const toggleTheme = () => {
    document.body.classList.toggle('light');
  };

  /**
   * Logout
   */
  const logout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  /**
   * Delete post
   */
  const deletePost = async (id) => {
    if (!window.confirm('Delete this post?')) return;

    try {
      await deleteDoc(doc(db, 'posts', id));
    } catch (error) {
      console.error('Failed to delete post:', error);
      alert('Failed to delete post. Please try again.');
    }
  };

  /**
   * Format timestamp
   */
  const timeAgo = (ts) =>
    ts ? formatDistanceToNow(ts.toDate(), { addSuffix: true }) : 'just now';

  if (!userData) {
    return (
      <div className="loading-state">
        <div className="loading-spinner">
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
        </div>
        <p className="loading-text">Loading your pulse...</p>
      </div>
    );
  }

  return (
    <div className="home">
      {/* Welcome Tour Overlay */}
      {showTour && (
        <div className="tour-overlay">
          <div className="tour-content">
            <h2>Welcome to Pulse! 🎉</h2>
            <p>Swipe down to refresh your feed.</p>
            <p>Tap posts to view and comment.</p>
            <p>Like posts to interact and increase your rank.</p>
            <button onClick={() => setShowTour(false)}>Got it!</button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="home-header">
        <div className="header-content">
          <div className="header-left">
            <button
              className="logo-btn"
              onClick={() => navigate('/')}
              aria-label="Home"
            >
              <div className="pulse-icon">
                <span className="pulse-ring"></span>
                <span className="pulse-dot"></span>
              </div>
              <span className="logo-text">Pulse</span>
            </button>
          </div>

          <div className="header-right">
            <button
              className="user-menu-toggle"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="User menu"
            >
              {userData.profilePicture ? (
                <img 
                  src={userData.profilePicture} 
                  alt="Profile" 
                  className="user-avatar-img"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div className="user-avatar-fallback">
                {userData.username?.[0]?.toUpperCase() || '?'}
              </div>
              <span className="user-name-desktop">{userData.username}</span>
              <svg
                className={`chevron ${menuOpen ? 'rotate' : ''}`}
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
              >
                <path
                  d="M4 6L8 10L12 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {menuOpen && (
              <div className="user-menu" ref={menuRef}>
                <div className="menu-header">
                  {userData.profilePicture ? (
                    <img 
                      src={userData.profilePicture} 
                      alt="Profile" 
                      className="menu-avatar-img"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className="menu-avatar-fallback">
                    {userData.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="menu-user-info">
                    <div className="menu-username">{userData.username}</div>
                    {userData.rank && (
                      <div className="menu-rank">{userData.rank}</div>
                    )}
                  </div>
                </div>

                <div className="menu-divider"></div>

                <button
                  className="menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/profile');
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M10 10C12.2091 10 14 8.20914 14 6C14 3.79086 12.2091 2 10 2C7.79086 2 6 3.79086 6 6C6 8.20914 7.79086 10 10 10Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M4 18C4 14.6863 6.68629 12 10 12C13.3137 12 16 14.6863 16 18"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>View profile</span>
                </button>

                <button className="menu-item" onClick={toggleTheme}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M10 2V4M10 16V18M18 10H16M4 10H2M15.5 15.5L14.5 14.5M14.5 5.5L15.5 4.5M5.5 15.5L4.5 14.5M4.5 5.5L5.5 4.5M14 10C14 12.2091 12.2091 14 10 14C7.79086 14 6 12.2091 6 10C6 7.79086 7.79086 6 10 6C12.2091 6 14 7.79086 14 10Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>Toggle theme</span>
                </button>

                <div className="menu-divider"></div>

                <button className="menu-item danger" onClick={logout}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M13 14L17 10M17 10L13 6M17 10H7M11 14V15C11 16.1046 10.1046 17 9 17H5C3.89543 17 3 16.1046 3 15V5C3 3.89543 3.89543 3 5 3H9C10.1046 3 11 3.89543 11 5V6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Feed */}
      <main
        className="feed-container"
        onTouchStart={(e) => {
          startY.current = e.touches[0].clientY;
        }}
        onTouchEnd={(e) => {
          const endY = e.changedTouches[0].clientY;
          if (endY - startY.current > 80 && window.scrollY === 0) {
            refreshPosts();
          }
        }}
      >
        {isRefreshing && (
          <div className="refresh-indicator">
            Refreshing 🔄
          </div>
        )}

        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner">
              <div className="spinner-ring"></div>
              <div className="spinner-ring"></div>
              <div className="spinner-ring"></div>
            </div>
            <p className="loading-text">Loading your pulse...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                <circle cx="40" cy="40" r="38" stroke="currentColor" strokeWidth="2" opacity="0.2" />
                <path
                  d="M40 20V40M40 40V60M40 40H60M40 40H20"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h2 className="empty-title">Quiet for now</h2>
            <p className="empty-description">
              Be the first to share something!
            </p>
          </div>
        ) : (
          <div className="posts-grid">
            {posts.map((post, index) => {
              const isLiked = post.likesUsers?.includes(user.uid) ?? false;
              return (
                <article
                  key={post.id}
                  className="post-card"
                  style={{ animationDelay: `${index * 0.05}s` }}
                  onClick={() => navigate(`/post/${post.id}`)}
                >
                  {/* Post Header */}
                  <div className="post-header">
                    <button
                      className="post-author"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/profile/${post.userId}`);
                      }}
                    >
                      <div className="author-avatar-container">
                        {post.profilePicture ? (
                          <img 
                            src={post.profilePicture} 
                            alt={post.userName} 
                            className="author-avatar-img"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div className="author-avatar-fallback">
                          {post.userName?.[0]?.toUpperCase() || '?'}
                        </div>
                      </div>
                      <div className="author-info">
                        <div className="author-name-row">
                          <span className="author-name">
                            {post.userName || 'Anonymous'}
                          </span>
                          {post.userRank && (
                            <span className="author-rank">{post.userRank}</span>
                          )}
                        </div>
                        <span className="post-time">{timeAgo(post.createdAt)}</span>
                      </div>
                    </button>

                    {post.userId === user.uid && (
                      <button
                        className="delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePost(post.id);
                        }}
                        aria-label="Delete post"
                      >
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                          <path
                            d="M7 3H13M3 5H17M15.5 5L15 15C15 16.1046 14.1046 17 13 17H7C5.89543 17 5 16.1046 5 15L4.5 5M8 8V13M12 8V13"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Post Content */}
                  <div className="post-content">
                    <p className="post-text">
                      {parseText(post.content, navigate)}
                    </p>

                    {post.mediaUrl && (
                      <div className="post-media">
                        {post.mediaType === 'image' && (
                          <img
                            src={post.mediaUrl}
                            alt="Post media"
                            className="media-image"
                            onContextMenu={(e) => e.preventDefault()}
                          />
                        )}
                        {post.mediaType === 'video' && (
                          <div
                            className="video-container"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/reels/${post.id}`);
                            }}
                          >
                            <video
                              src={post.mediaUrl}
                              className="media-video"
                              controls
                              controlsList="nodownload noremoteplayback"
                              onContextMenu={(e) => e.preventDefault()}
                              playsInline
                              muted
                              loop
                            />
                            <div className="video-play-overlay">
                              <svg
                                width="48"
                                height="48"
                                viewBox="0 0 48 48"
                                fill="none"
                                className="play-icon"
                              >
                                <circle
                                  cx="24"
                                  cy="24"
                                  r="22"
                                  fill="rgba(0, 0, 0, 0.6)"
                                  stroke="white"
                                  strokeWidth="2"
                                />
                                <path
                                  d="M18 14L34 24L18 34V14Z"
                                  fill="white"
                                />
                              </svg>
                            </div>
                          </div>
                        )}
                        {post.mediaType === 'audio' && (
                          <audio
                            src={post.mediaUrl}
                            controls
                            className="media-audio"
                            controlsList='nodownload'
                            onClick={(e) => e.stopPropagation()}
                            onContextMenu={(e) => e.preventDefault()}
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Post Actions */}
                  <div className="post-actions">
                    <button
                      className={`action-btn like-btn ${isLiked ? 'liked' : ''} ${animatingLikeId === post.id ? 'animating-like' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        likePost(post);
                      }}
                      aria-label={isLiked ? 'Unlike' : 'Like'}
                    >
                      <svg
                        width="20"
                        height="20"
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
                      <span className="action-count">{post.likes || 0}</span>
                    </button>

                    <button
                      className="action-btn comment-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/post/${post.id}`);
                      }}
                      aria-label="Comment"
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path
                          d="M17 9C17 12.866 13.866 16 10 16C8.937 16 7.937 15.772 7.05 15.368L3 17L4.368 13.05C3.772 12.133 3.5 11.107 3.5 10C3.5 6.134 6.634 3 10 3C13.866 3 17 6.134 17 9Z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="action-count">{post.commentsCount || 0}</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Home;