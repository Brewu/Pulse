import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { getUserRankInfo } from "./rankUtils";

export const calculatePostScore = (post) => {
  const LIKE_WEIGHT = 1;
  const COMMENT_WEIGHT = 2;
  const SHARE_WEIGHT = 3;

  return (post.likes || 0) * LIKE_WEIGHT +
         (post.comments || 0) * COMMENT_WEIGHT +
         (post.shares || 0) * SHARE_WEIGHT;
};

export const updatePostVisibility = async (postId) => {
  const postRef = doc(db, "posts", postId);
  const postSnap = await getDoc(postRef);
  if (!postSnap.exists()) return;

  const post = postSnap.data();

  const interactionsScore = calculatePostScore(post);

  // Get poster rank multiplier
  const { multiplier = 1 } = await getUserRankInfo(post.uid);

  // Visibility score = interactions weighted by rank
  const visibilityScore = interactionsScore * multiplier;

  await updateDoc(postRef, { interactionsScore, visibilityScore });
};