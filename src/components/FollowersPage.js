// src/components/FollowersPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import {
  doc,
  collection,
  query,
  onSnapshot,
  getDoc,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

import './FollowList.css'; // We'll create shared CSS below

const FollowersPage = () => {
  const { uid } = useParams(); // :uid from route /profile/:uid/followers
  const navigate = useNavigate();

  const [profileData, setProfileData] = useState(null);
  const [followers, setFollowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null); // Track logged-in user

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setCurrentUser);
    return () => unsubscribe();
  }, []);

  // Load profile + followers list
  useEffect(() => {
    if (!uid) {
      navigate('/profile');
      return;
    }

    setLoading(true);

    // Get basic profile info (mainly username/displayName)
    const profileRef = doc(db, 'users', uid);
    const unsubscribeProfile = onSnapshot(profileRef, (snap) => {
      if (snap.exists()) {
        setProfileData({ uid, ...snap.data() });
      }
    });

    // Real-time followers list
    const followersQuery = query(
      collection(db, 'followers', uid, 'userFollowers')
    );

    const unsubscribeFollowers = onSnapshot(followersQuery, async (snap) => {
      const followerUids = snap.docs.map((doc) => doc.id);

      if (followerUids.length === 0) {
        setFollowers([]);
        setLoading(false);
        return;
      }

      // Fetch user data for each follower
      const followerPromises = followerUids.map(async (followerUid) => {
        const userDoc = await getDoc(doc(db, 'users', followerUid));
        if (userDoc.exists()) {
          return { uid: followerUid, ...userDoc.data() };
        }
        return null;
      });

      const loadedFollowers = (await Promise.all(followerPromises)).filter(Boolean);
      setFollowers(loadedFollowers);
      setLoading(false);
    });

    return () => {
      unsubscribeProfile();
      unsubscribeFollowers();
    };
  }, [uid, navigate]);

  if (loading) {
    return <div className="follow-page-loading">Loading followers...</div>;
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
        <h3 className="list-title">Followers</h3>

        {followers.length === 0 ? (
          <div className="empty-state">
            <h4>No followers yet</h4>
            <p>
              When people start following {profileData.username}, they'll appear here.
            </p>
          </div>
        ) : (
          <div className="user-list">
            {followers.map((user) => (
              <Link
                key={user.uid}
                to={`/profile/${user.uid}`}
                className="user-item"
              >
                <img
                
                  src={
                    user.profilePicture ||
                    'https://via.placeholder.com/56?text=' + (user.username?.[0] || '?')
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

export default FollowersPage;
