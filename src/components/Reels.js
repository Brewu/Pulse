// src/pages/Reels.jsx
import { useEffect, useState, useRef, useMemo } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  increment,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useParams, useNavigate } from 'react-router-dom';
import './Reels.css';

const Reels = () => {
  const { postId } = useParams();
  const navigate = useNavigate();

  const [videos, setVideos] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [animatingLikeId, setAnimatingLikeId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  const containerRef = useRef(null);
  const videoRefs = useRef([]);

  // Auth listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    
    return unsubscribe;
  }, []);

  // Fetch video posts (no forced defaults — rely on Firestore data)
  useEffect(() => {
    const q = query(
      collection(db, 'posts'),
      where('mediaType', '==', 'video'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setVideos(data);
    });

    return unsubscribe;
  }, []);

  // Reorder for deep-linked video
  const displayedVideos = useMemo(() => {
    if (!postId) return videos;

    const selectedIndex = videos.findIndex((v) => v.id === postId);
    if (selectedIndex === -1) return videos;

    const selectedVideo = videos[selectedIndex];
    const otherVideos = videos.filter((_, idx) => idx !== selectedIndex);
    
    return [selectedVideo, ...otherVideos];
  }, [videos, postId]);

  // Scroll to deep-linked video
  useEffect(() => {
    if (!postId || displayedVideos.length === 0) return;

    const targetIndex = displayedVideos.findIndex((v) => v.id === postId);
    if (targetIndex === -1) return;

    setActiveIndex(targetIndex);

    requestAnimationFrame(() => {
      containerRef.current?.children[targetIndex]?.scrollIntoView({
        behavior: 'instant',
        block: 'start',
      });
    });
  }, [displayedVideos, postId]);

  // Play/pause logic
  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (!video) return;

      if (index === activeIndex) {
        video.play().catch(() => {});
      } else {
        video.pause();
        video.currentTime = 0;
      }
    });
  }, [activeIndex]);

  // Scroll detection
  const handleScroll = () => {
    if (!containerRef.current) return;

    const scrollTop = containerRef.current.scrollTop;
    const viewportHeight = window.innerHeight;
    const newIndex = Math.round(scrollTop / viewportHeight);

    if (
      newIndex !== activeIndex &&
      newIndex >= 0 &&
      newIndex < displayedVideos.length
    ) {
      setActiveIndex(newIndex);
    }
  };

  // Like toggle (keeps likeCount and likedBy in sync)
  const toggleLike = async (videoId) => {
    if (!currentUser) {
      // TODO: Show login toast
      return;
    }

    const video = displayedVideos.find((v) => v.id === videoId);
    if (!video) return;

    const likedBy = video.likedBy || [];
    const isLiked = likedBy.includes(currentUser.uid);
    const postRef = doc(db, 'posts', videoId);

    try {
      if (isLiked) {
        await updateDoc(postRef, {
          likeCount: increment(-1),
          likedBy: arrayRemove(currentUser.uid),
        });
      } else {
        await updateDoc(postRef, {
          likeCount: increment(1),
          likedBy: arrayUnion(currentUser.uid),
        });

        // Like animation
        setAnimatingLikeId(videoId);
        setTimeout(() => setAnimatingLikeId(null), 1000);
      }
    } catch (error) {
      console.error('Like error:', error);
    }
  };

  const formatCount = (num) => {
    if (!num && num !== 0) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace('.0', '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace('.0', '') + 'K';
    return num.toString();
  };

  // Fallback like count: use likeCount if present, else likedBy array length
  const getLikeCount = (video) => {
    return video.likeCount ?? (video.likedBy || []).length ?? 0;
  };

  return (
    <div className="reels-page">
      <button className="reels-back" onClick={() => navigate(-1)}>
        ←
      </button>

      <div
        className="reels-container"
        ref={containerRef}
        onScroll={handleScroll}
      >
        {displayedVideos.map((video, index) => {
          const likedBy = video.likedBy || [];
          const isLiked = currentUser ? likedBy.includes(currentUser.uid) : false;

          return (
            <div key={video.id} className="reel">
              <video
                ref={(el) => (videoRefs.current[index] = el)}
                src={video.mediaUrl}
                loop
                playsInline
                muted
                className="reel-video"
                onClick={(e) => {
                  e.currentTarget.muted = !e.currentTarget.muted;
                }}
                onDoubleClick={() => toggleLike(video.id)}
              />

              {/* Double-tap like popup */}
              {animatingLikeId === video.id && (
                <div className="like-popup">
                  <svg className="popup-heart" viewBox="0 0 24 24">
                    <path
                      d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                      fill="#ff0050"
                    />
                  </svg>
                </div>
              )}

              <div className="reel-overlay">
                <div className="reel-user">@{video.userName}</div>
                <p className="reel-caption">{video.content}</p>
              </div>

              {/* Actions */}
              <div className="reel-actions" onClick={(e) => e.stopPropagation()}>
                {/* Like */}
                <div className="action-item">
                  <button
                    className={`action-btn like-btn ${isLiked ? 'liked' : ''}`}
                    onClick={() => toggleLike(video.id)}
                  >
                    <svg className="action-icon" viewBox="0 0 24 24">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </button>
                  <span className="action-count">{formatCount(getLikeCount(video))}</span>
                </div>

                {/* Comment */}
                <div className="action-item">
                  <button
                    className="action-btn comment-btn"
                    onClick={() => navigate(`/post/${video.id}`)}
                  >
                    <svg className="action-icon" viewBox="0 0 24 24">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </button>
                  <span className="action-count">{formatCount(video.commentCount || 0)}</span>
                </div>
              </div>

              {/* Creator avatar */}
              <div className="reel-creator-avatar" onClick={(e) => e.stopPropagation()}>
                <img
                  className="creator-avatar-img"
                  src={
                    video.userAvatar ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      video.userName
                    )}&background=random&bold=true`
                  }
                  alt={`@${video.userName}`}
                  onClick={() =>
                    navigate(`/profile/${video.userId || video.userName}`)
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Reels;