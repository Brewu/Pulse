export const getRankFromScore = (score) => {
  if (score >= 5000) return 'Pulse Legend ⭐';
  if (score >= 1000) return 'Influencer 💫';
  if (score >= 250)  return 'Rising Star 🔆';
  if (score >= 50)   return 'Active 🔹';
  return 'New Member 🟢';
};

export const DAILY_ACTIVE_POINTS = 15;
export const SIGNUP_BONUS = 20;