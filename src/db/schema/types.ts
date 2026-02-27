export type Role = "user" | "admin" | "moderator" | "collaborator" | "editor";
export type Theme = "light" | "dark" | "system";
export type PrivacyLevel = "public" | "private" | "followersOnly";
export type SocialAuthProvider = "google" | "apple" | "facebook";

export type SocialMedia = {
    twitter?: string;
    linkedin?: string;
    github?: string;
    website?: string;
};

export type SessionMetadata = {
    ip?: string;
    userAgent?: string;
    deviceType?: string;
    location?: string;
};

// --- Content ---
export type PostStatus =
    | "draft"
    | "pending"
    | "published"
    | "scheduled"
    | "archived"
    | "trashed";

export type PostType = "article" | "news" | "page" | "podcast" | "video";


// --- Comments ---
export type CommentStatus = "pending" | "approved" | "spam" | "trashed";

export type CommentClass =
    | "best"
    | "good"
    | "average"
    | "hate_speech"
    | "bullying"
    | "vulgar"
    | "spamming"
    | "expedient"
    | "peoples_choice";

export type Sentiment =
    | "positive"
    | "negative"
    | "neutral"
    | "expedient"
    | "peoples_choice";

// --- Social ---
export type ReactionType = "like" | "dislike";
export type EmojiSentiment = "positive" | "negative";
export type FollowStatus = "follow" | "block";
export type FriendRequestStatus = "pending" | "accepted" | "rejected" | "blocked";

// --- Chat ---
export type ChatRoomVisibility = "public" | "private";
export type MessageStatus = "sent" | "delivered" | "read";

// --- Notifications ---
export type NotificationStatus = "unread" | "read" | "dismissed";

// --- Polls ---
export type PollType = "single_choice" | "multiple_choice";

export type PollStyles = {
    theme?: string;
    customCss?: string;
    showTitle?: boolean;
};

// --- Taxonomy ---
export type TaxonomyType = "category" | "tag" | "topic";

// --- Mailing ---
export type EmailDeliveryStatus =
    | "pending"
    | "sent"
    | "delivered"
    | "bounced"
    | "failed";