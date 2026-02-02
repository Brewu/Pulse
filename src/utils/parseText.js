import React from 'react';
import { Link } from 'react-router-dom';
import {  query, collection, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Converts text with @mentions, #hashtags, and web links into clickable links
 * @param {string} text
 * @param {function} navigate - react-router navigate function
 */
export const parseText = (text, navigate) => {
    if (!text) return null;

    // Split by spaces but keep separators
    const parts = text.split(/(\s+)/);

    return parts.map((part, index) => {
        if (!part.trim()) return part; // keep spaces

        // Hashtag
        if (part.startsWith('#')) {
            const tag = part.slice(1);
            return (
                <Link key={index} to={`/tag/${tag}`} className="hashtag-link">
                    {part}
                </Link>
            );
        }

        // Mention
        if (part.startsWith('@')) {
            const username = part.slice(1);

            const handleClick = async () => {
                try {
                    const usersRef = collection(db, 'users');
                    const q = query(usersRef, where('username', '==', username));
                    const snap = await getDocs(q);

                    if (!snap.empty) {
                        const userDoc = snap.docs[0];
                        navigate(`/profile/${userDoc.id}`);
                    } else {
                        alert('User not found');
                    }
                } catch (err) {
                    console.error('Mention click error:', err);
                }
            };

            return (
                <span
                    key={index}
                    className="mention-link"
                    onClick={handleClick}
                    style={{ cursor: 'pointer', color: '#1DA1F2' }}
                >
                    {part}
                </span>
            );
        }

        // Web links (URLs)
        const urlPattern = /(https?:\/\/[^\s]+)/g;
        if (urlPattern.test(part)) {
            return part.split(urlPattern).map((segment, i) => {
                if (urlPattern.test(segment)) {
                    return (
                        <a
                            key={`${index}-${i}`}
                            href={segment}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#0645AD', textDecoration: 'underline' }}
                        >
                            {segment}
                        </a>
                    );
                }
                return segment; // plain text between URLs
            });
        }

        // Plain text
        return part;
    });
};
