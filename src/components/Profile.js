// src/components/Profile.jsx
import React, { useState, useEffect } from 'react';
import {
  auth,
  db,
} from '../firebase';
import {
  doc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  setDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { parseText } from '../utils/parseText';

import './Profile.css';

const POSTS_LIMIT = 50;

const Profile = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const { uid: profileUidParam } = useParams();

  const targetUid = profileUidParam || currentUser?.uid;
  const isOwnProfile = !profileUidParam || profileUidParam === currentUser?.uid;

  // Rank glow + badge styles
  const getRankStyles = (rank) => {
    if (!rank) return { glow: 'none', borderGradient: '#e2e8f0', badgeGradient: '#64748b', animation: 'none' };

    const lower = rank.toLowerCase();

    if (lower.includes('pulse legend')) {
      return {
        glow: '0 0 30px rgba(255, 0, 128, 0.7), 0 0 60px rgba(255, 140, 0, 0.5), 0 0 90px rgba(64, 224, 208, 0.4)',
        borderGradient: 'conic-gradient(#ff0080, #ff8c00, #40e0d0, #9d00ff, #ff0080)',
        badgeGradient: 'linear-gradient(135deg, #ff0080, #40e0d0)',
        animation: 'rainbow-rotate 6s linear infinite',
      };
    }
    if (lower.includes('influencer')) {
      return {
        glow: '0 0 25px rgba(168, 85, 247, 0.7), 0 0 50px rgba(236, 72, 153, 0.5)',
        borderGradient: 'linear-gradient(135deg, #a855f7, #ec4899)',
        badgeGradient: 'linear-gradient(135deg, #a855f7, #ec4899)',
        animation: 'glow-pulse 2s ease-in-out infinite',
      };
    }
    if (lower.includes('rising')) {
      return {
        glow: '0 0 20px rgba(59, 130, 246, 0.6), 0 0 40px rgba(6, 182, 212, 0.4)',
        borderGradient: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
        badgeGradient: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
        animation: 'glow-pulse 2.5s ease-in-out infinite',
      };
    }
    if (lower.includes('active')) {
      return {
        glow: '0 0 18px rgba(16, 185, 129, 0.5)',
        borderGradient: 'linear-gradient(135deg, #10b981, #84cc16)',
        badgeGradient: 'linear-gradient(135deg, #10b981, #84cc16)',
        animation: 'glow-pulse 3s ease-in-out infinite',
      };
    }
    return {
      glow: '0 0 15px rgba(99, 102, 241, 0.4)',
      borderGradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
      badgeGradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
      animation: 'none',
    };
  };

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate('/login');
        return;
      }
      setCurrentUser(user);
    });
    return unsubscribe;
  }, [navigate]);

  // Profile data, posts, follow status
  useEffect(() => {
    if (!currentUser || !targetUid) return;

    setLoading(true);

    // Profile data
    const profileRef = doc(db, 'users', targetUid);
    const unsubscribeProfile = onSnapshot(profileRef, (snap) => {
      if (snap.exists()) {
        setProfileData({ uid: targetUid, ...snap.data() });
      } else {
        setProfileData(null);
      }
      setLoading(false);
    });

    // User posts (ordered + limited)
    const postsQuery = query(
      collection(db, 'posts'),
      where('userId', '==', targetUid),
      orderBy('createdAt', 'desc'),
      limit(POSTS_LIMIT)
    );
    const unsubscribePosts = onSnapshot(postsQuery, (snap) => {
      const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setUserPosts(posts);
    });

    // Following status
    let unsubscribeFollowing;
    if (!isOwnProfile) {
      const followRef = doc(db, 'following', currentUser.uid, 'userFollowing', targetUid);
      unsubscribeFollowing = onSnapshot(followRef, (snap) => {
        setIsFollowing(snap.exists());
      });
    }

    return () => {
      unsubscribeProfile();
      unsubscribePosts();
      unsubscribeFollowing?.();
    };
  }, [currentUser, targetUid, isOwnProfile]);

  // Toggle follow
  const toggleFollow = async () => {
    if (!currentUser || isOwnProfile) return;

    const followerUid = currentUser.uid;
    const followingRef = doc(db, 'following', followerUid, 'userFollowing', targetUid);
    const followerRef = doc(db, 'followers', targetUid, 'userFollowers', followerUid);

    try {
      if (isFollowing) {
        await Promise.all([
          deleteDoc(followingRef),
          deleteDoc(followerRef),
          updateDoc(doc(db, 'users', targetUid), { followersCount: increment(-1) }),
          updateDoc(doc(db, 'users', followerUid), { followingCount: increment(-1) }),
        ]);
      } else {
        await Promise.all([
          setDoc(followingRef, { followedAt: serverTimestamp(), uid: targetUid }),
          setDoc(followerRef, { followedAt: serverTimestamp(), uid: followerUid }),
          updateDoc(doc(db, 'users', targetUid), { followersCount: increment(1) }),
          updateDoc(doc(db, 'users', followerUid), { followingCount: increment(1) }),
        ]);
      }
    } catch (error) {
      console.error('Follow toggle failed:', error);
    }
  };

  if (loading || !profileData) {
    return <div className="profile-loading">Loading profile...</div>;
  }

  const joinedDate = profileData.createdAt
    ? new Date(profileData.createdAt.seconds * 1000).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : 'Unknown';

  const rankStyles = getRankStyles(profileData.rank);

  return (
    <div className="profile-page">
      {/* Header */}
      <header className="profile-header">
        <button className="back-btn" onClick={() => navigate(-1)} aria-label="Back">
          ←
        </button>
        <div className="header-info">
          <h2 className="profile-username">{profileData.username}</h2>
          <span className="post-count">{userPosts.length} posts</span>
        </div>
      </header>

      {/* Banner + Avatar with Glow */}
      <div className="profile-banner-container">
        <img
          src={profileData.bannerUrl || 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1600'}
          alt="Banner"
          className="profile-banner"
          onClick={() => isOwnProfile && navigate('/editprofile')}
        />

        <div className="profile-avatar-wrapper">
          <div
            className="avatar-glow-outer"
            style={{
              boxShadow: rankStyles.glow,
              animation: rankStyles.animation,
            }}
          >
            <div
              className="avatar-border-ring"
              style={{
                background: rankStyles.borderGradient,
                animation: rankStyles.animation,
              }}
            >
              <img
                src={profileData.profilePicture || 'https://via.placeholder.com/150'}
                alt="Profile picture"
                className="profile-avatar"
                onClick={() => isOwnProfile && navigate('/editprofile')}
              />
            </div>
          </div>

          {profileData.rank && (
            <div
              className="rank-badge"
              style={{ background: rankStyles.badgeGradient }}
            >
              {profileData.rank}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="profile-actions-bar">
        {isOwnProfile ? (
          <button className="edit-profile-btn" onClick={() => navigate('/editprofile')}>
            Edit profile
          </button>
        ) : (
          <button
            className={`follow-btn ${isFollowing ? 'following' : ''}`}
            onClick={toggleFollow}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </button>
        )}
      </div>

      {/* Bio & Stats */}
      <div className="profile-info">
        <h3 className="display-name">{profileData.displayName || profileData.username}</h3>
        <p className="username">@{profileData.username}</p>

{profileData.bio && (
  <p className="bio">
    {parseText(profileData.bio, navigate)}
  </p>
)}

        <p className="joined-date">Joined {joinedDate}</p>

        <div className="profile-stats">
          <Link to={`/profile/${targetUid}/following`} className="stat">
            <strong>{profileData.followingCount || 0}</strong> Following
          </Link>
          <Link to={`/profile/${targetUid}/followers`} className="stat">
            <strong>{profileData.followersCount || 0}</strong> Followers
          </Link>
          <div className="stat">
            <strong>{userPosts.reduce((acc, p) => acc + (p.likes || 0), 0)}</strong> Likes
          </div>
        </div>
      </div>

      {/* Posts List */}
      <div className="profile-posts-section">
        <div className="section-header">
          <h3>Posts</h3>
        </div>

        {userPosts.length === 0 ? (
          <div className="empty-posts">
            <p>No posts yet</p>
          </div>
        ) : (
          <div className="user-posts-list">
            {userPosts.map((post) => (
              <Link key={post.id} to={`/post/${post.id}`} className="post-card">
                <div className="post-header">
                  <img
                    src={profileData.profilePicture || 'https://via.placeholder.com/48'}
                    alt=""
                    className="tiny-avatar"
                  />
                  <div>
                    <span className="post-name">{profileData.displayName || profileData.username}</span>
                    <span className="post-username">@{profileData.username}</span>
                  </div>
                </div>

                <p className="post-content">{post.content}</p>

                {post.mediaUrl && (
                  <div className="post-media">
                    {post.mediaType === 'image' && (
                      <img src={post.mediaUrl} alt="Post media" loading="lazy" />
                    )}
                    {post.mediaType === 'video' && (
                      <video
                        src={post.mediaUrl}
                        className="media-video"
                        muted
                        autoPlay
                        loop
                        playsInline
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          navigate(`/reels/${post.id}`);
                        }}
                      />
                    )}
                    {post.mediaType === 'audio' && (
                      <audio
                        src={post.mediaUrl}
                        controls
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </div>
                )}

                <div className="post-footer">
                  <span>{new Date(post.createdAt?.seconds * 1000).toLocaleString()}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;