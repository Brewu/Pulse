// src/components/FollowingPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '../firebase';
import {
  doc,
  collection,
  query,
  onSnapshot,
  getDoc,
} from 'firebase/firestore';

import './FollowList.css'; // Shared CSS for followers/following lists

const FollowingPage = () => {
  const { uid } = useParams(); // :uid from route /profile/:uid/following
  const navigate = useNavigate();

  const [profileData, setProfileData] = useState(null);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load profile + following list
  useEffect(() => {
    if (!uid) {
      navigate('/profile');
      return;
    }

    setLoading(true);

    // Get basic profile info (username/displayName for header)
    const profileRef = doc(db, 'users', uid);
    const unsubscribeProfile = onSnapshot(profileRef, (snap) => {
      if (snap.exists()) {
        setProfileData({ uid, ...snap.data() });
      } else {
        setProfileData(null);
        setLoading(false);
      }
    });

    // Real-time following list (subcollection: following > uid > userFollowing)
    const followingQuery = query(
      collection(db, 'following', uid, 'userFollowing')
    );

    const unsubscribeFollowing = onSnapshot(followingQuery, async (snap) => {
      const followingUids = snap.docs.map((doc) => doc.id);

      if (followingUids.length === 0) {
        setFollowing([]);
        setLoading(false);
        return;
      }

      // Batch fetch user data for each followed user
      const followingPromises = followingUids.map(async (followingUid) => {
        const userDoc = await getDoc(doc(db, 'users', followingUid));
        if (userDoc.exists()) {
          return { uid: followingUid, ...userDoc.data() };
        }
        return null;
      });

      const loadedFollowing = (await Promise.all(followingPromises)).filter(Boolean);
      setFollowing(loadedFollowing);
      setLoading(false);
    });

    return () => {
      unsubscribeProfile();
      unsubscribeFollowing();
    };
  }, [uid, navigate]);

  if (loading) {
    return <div className="follow-page-loading">Loading following...</div>;
  }

  if (!profileData) {
    return (
      <div className="follow-page-error">
        <h2>User not found</h2>
        <button onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  return (
    <div className="follow-page">
      <header className="follow-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          ←
        </button>
        <div className="header-info">
          <h2>{profileData.displayName || profileData.username}</h2>
          <span className="sub-title">@{profileData.username}</span>
        </div>
      </header>

      <main className="follow-list-container">
        <h3 className="list-title">Following</h3>

        {following.length === 0 ? (
          <div className="empty-state">
            <h4>Not following anyone yet</h4>
            <p>
              When {profileData.username} starts following others, they'll appear here.
            </p>
          </div>
        ) : (
          <div className="user-list">
            {following.map((user) => (
              <Link
                key={user.uid}
                to={`/profile/${user.uid}`}
                className="user-item"
              >
                <img
                  src={
                    user.profilePicture ||
                    `https://via.placeholder.com/56?text=${(user.username?.[0]?.toUpperCase() || '?')}`
                  }
                  alt={user.username}
                  className="user-avatar"
                />
                <div className="user-info">
                  <div className="user-name">
                    {user.displayName || user.username}
                  </div>
                  <div className="user-handle">@{user.username}</div>
                  {user.bio && <div className="user-bio">{user.bio}</div>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default FollowingPage;
