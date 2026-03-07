---- ============================================================
-- post_reactions: INSERT → increment, DELETE → decrement
-- ============================================================

CREATE OR REPLACE FUNCTION trg_post_reaction_insert() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO post_stats (post_id, like_count, dislike_count)
    VALUES (
        NEW.post_id,
        CASE WHEN NEW.reaction = 'like' THEN 1 ELSE 0 END,
        CASE WHEN NEW.reaction = 'dislike' THEN 1 ELSE 0 END
    )
    ON CONFLICT (post_id) DO UPDATE SET
        like_count    = post_stats.like_count    + CASE WHEN NEW.reaction = 'like' THEN 1 ELSE 0 END,
        dislike_count = post_stats.dislike_count + CASE WHEN NEW.reaction = 'dislike' THEN 1 ELSE 0 END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_post_reaction_delete() RETURNS TRIGGER AS $$
BEGIN
    UPDATE post_stats SET
        like_count    = GREATEST(0, like_count    - CASE WHEN OLD.reaction = 'like' THEN 1 ELSE 0 END),
        dislike_count = GREATEST(0, dislike_count - CASE WHEN OLD.reaction = 'dislike' THEN 1 ELSE 0 END)
    WHERE post_id = OLD.post_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER post_reaction_after_insert
    AFTER INSERT ON post_reactions
    FOR EACH ROW EXECUTE FUNCTION trg_post_reaction_insert();

CREATE TRIGGER post_reaction_after_delete
    AFTER DELETE ON post_reactions
    FOR EACH ROW EXECUTE FUNCTION trg_post_reaction_delete();


-- ============================================================
-- comments: status changes + delete
--   UPDATE status → 'approved'        → +1
--   UPDATE status FROM 'approved' →   → -1  (covers trash, spam, pending)
--   DELETE when status was 'approved'  → -1
-- ============================================================

CREATE OR REPLACE FUNCTION trg_comment_status_update() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
        INSERT INTO post_stats (post_id, comment_count)
        VALUES (NEW.post_id, 1)
        ON CONFLICT (post_id) DO UPDATE SET
            comment_count = post_stats.comment_count + 1;
    END IF;

    IF OLD.status = 'approved' AND NEW.status <> 'approved' THEN
        UPDATE post_stats SET
            comment_count = GREATEST(0, comment_count - 1)
        WHERE post_id = NEW.post_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_comment_delete() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'approved' THEN
        UPDATE post_stats SET
            comment_count = GREATEST(0, comment_count - 1)
        WHERE post_id = OLD.post_id;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comment_after_status_update
    AFTER UPDATE OF status ON comments
    FOR EACH ROW EXECUTE FUNCTION trg_comment_status_update();

CREATE TRIGGER comment_after_delete
    AFTER DELETE ON comments
    FOR EACH ROW EXECUTE FUNCTION trg_comment_delete();


-- ============================================================
-- shares: INSERT only → increment
-- ============================================================

CREATE OR REPLACE FUNCTION trg_share_insert() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO post_stats (post_id, share_count)
    VALUES (NEW.post_id, 1)
    ON CONFLICT (post_id) DO UPDATE SET
        share_count = post_stats.share_count + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER share_after_insert
    AFTER INSERT ON shares
    FOR EACH ROW EXECUTE FUNCTION trg_share_insert();


-- ============================================================
-- bookmarks: INSERT → increment, DELETE → decrement
-- ============================================================

CREATE OR REPLACE FUNCTION trg_bookmark_insert() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO post_stats (post_id, bookmark_count)
    VALUES (NEW.post_id, 1)
    ON CONFLICT (post_id) DO UPDATE SET
        bookmark_count = post_stats.bookmark_count + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_bookmark_delete() RETURNS TRIGGER AS $$
BEGIN
    UPDATE post_stats SET
        bookmark_count = GREATEST(0, bookmark_count - 1)
    WHERE post_id = OLD.post_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bookmark_after_insert
    AFTER INSERT ON bookmarks
    FOR EACH ROW EXECUTE FUNCTION trg_bookmark_insert();

CREATE TRIGGER bookmark_after_delete
    AFTER DELETE ON bookmarks
    FOR EACH ROW EXECUTE FUNCTION trg_bookmark_delete();


-- ============================================================
-- peoples_choice_votes: INSERT → increment, DELETE → decrement
-- ============================================================

CREATE OR REPLACE FUNCTION trg_peoples_choice_insert() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO post_stats (post_id, peoples_choice_count)
    VALUES (NEW.post_id, 1)
    ON CONFLICT (post_id) DO UPDATE SET
        peoples_choice_count = post_stats.peoples_choice_count + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_peoples_choice_delete() RETURNS TRIGGER AS $$
BEGIN
    UPDATE post_stats SET
        peoples_choice_count = GREATEST(0, peoples_choice_count - 1)
    WHERE post_id = OLD.post_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER peoples_choice_after_insert
    AFTER INSERT ON peoples_choice_votes
    FOR EACH ROW EXECUTE FUNCTION trg_peoples_choice_insert();

CREATE TRIGGER peoples_choice_after_delete
    AFTER DELETE ON peoples_choice_votes
    FOR EACH ROW EXECUTE FUNCTION trg_peoples_choice_delete();


-- ============================================================
-- BACKFILL: populate post_stats from existing data
-- ============================================================

INSERT INTO post_stats (
    post_id, like_count, dislike_count, comment_count,
    share_count, bookmark_count, peoples_choice_count
)
SELECT
    p.id,
    COALESCE(likes.cnt, 0),
    COALESCE(dislikes.cnt, 0),
    COALESCE(cmts.cnt, 0),
    COALESCE(shrs.cnt, 0),
    COALESCE(bkms.cnt, 0),
    COALESCE(ppl.cnt, 0)
FROM posts p
LEFT JOIN (
    SELECT post_id, COUNT(*) AS cnt FROM post_reactions
    WHERE reaction = 'like' GROUP BY post_id
) likes ON likes.post_id = p.id
LEFT JOIN (
    SELECT post_id, COUNT(*) AS cnt FROM post_reactions
    WHERE reaction = 'dislike' GROUP BY post_id
) dislikes ON dislikes.post_id = p.id
LEFT JOIN (
    SELECT post_id, COUNT(*) AS cnt FROM comments
    WHERE status = 'approved' GROUP BY post_id
) cmts ON cmts.post_id = p.id
LEFT JOIN (
    SELECT post_id, COUNT(*) AS cnt FROM shares
    GROUP BY post_id
) shrs ON shrs.post_id = p.id
LEFT JOIN (
    SELECT post_id, COUNT(*) AS cnt FROM bookmarks
    GROUP BY post_id
) bkms ON bkms.post_id = p.id
LEFT JOIN (
    SELECT post_id, COUNT(*) AS cnt FROM peoples_choice_votes
    GROUP BY post_id
) ppl ON ppl.post_id = p.id
ON CONFLICT (post_id) DO UPDATE SET
    like_count           = EXCLUDED.like_count,
    dislike_count        = EXCLUDED.dislike_count,
    comment_count        = EXCLUDED.comment_count,
    share_count          = EXCLUDED.share_count,
    bookmark_count       = EXCLUDED.bookmark_count,
    peoples_choice_count = EXCLUDED.peoples_choice_count;