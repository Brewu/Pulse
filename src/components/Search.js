import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "./Search.css";

const Search = () => {
  const [queryText, setQueryText] = useState("");
  const [userResults, setUserResults] = useState([]);
  const [postResults, setPostResults] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchResults = async () => {
      if (queryText.trim() === "") {
        setUserResults([]);
        setPostResults([]);
        return;
      }

      const lowerQuery = queryText.toLowerCase();

      // Search users
      const usersRef = collection(db, "users");
      const userSnap = await getDocs(usersRef);
      const filteredUsers = userSnap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((user) =>
          user.username?.toLowerCase().includes(lowerQuery)
        );
      setUserResults(filteredUsers);

      // Search posts
      const postsRef = collection(db, "posts");
      const postSnap = await getDocs(postsRef);
      const filteredPosts = postSnap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((post) =>
          post.content?.toLowerCase().includes(lowerQuery)
        );
      setPostResults(filteredPosts);
    };

    fetchResults();
  }, [queryText]);

  return (
    <div className="search-page">
      <header className="search-header">
        <h2>Search</h2>
      </header>

      <div className="search-box">
        <i className="bi bi-search"></i>
        <input
          type="text"
          placeholder="Search users or posts"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
        />
      </div>

      <div className="search-results">
        {queryText.trim() === "" ? (
          <p className="search-empty">Start typing to search</p>
        ) : userResults.length === 0 && postResults.length === 0 ? (
          <p className="search-empty">No results found</p>
        ) : (
          <>
            {userResults.length > 0 && (
              <div className="search-section">
                <h4>Users</h4>
                {userResults.map((user) => (
                  <div
                    key={user.id}
                    className="search-item"
                    onClick={() => navigate(`/profile/${user.id}`)}
                  >
                    <div className="avatar-placeholder">
                      {user.username?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <span>{user.username}</span>
                  </div>
                ))}
              </div>
            )}

            {postResults.length > 0 && (
              <div className="search-section">
                <h4>Posts</h4>
                {postResults.map((post) => (
                  <div
                    key={post.id}
                    className="search-item post-item"
                    onClick={() => navigate(`/post/${post.id}`)}
                  >
                    <p>{post.content}</p>
                    <div className="post-media">
                      {post.mediaUrl && post.mediaType === "image" && (
                        <img src={post.mediaUrl} alt="post" className="post-thumb" />
                      )}
                      {post.mediaUrl && post.mediaType === "video" && (
                        <div
                          className="video-thumb-wrapper"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/reels/${post.id}`);
                          }}
                        >
                          <video
                            src={post.mediaUrl}
                            className="post-thumb"
                            muted
                            playsInline
                            preload="metadata"
                          />
                          <div className="play-overlay">▶</div>
                        </div>
                      )}
                      {post.mediaUrl && post.mediaType === "audio" && (
                        <audio controls className="post-thumb">
                          <source src={post.mediaUrl} type="audio/mpeg" />
                        </audio>
                      )}
                      {!post.mediaUrl && post.mediaType && (
                        <p className="expired-media">⏰ Media expired</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Search;