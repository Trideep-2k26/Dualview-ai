from typing import Optional

def calculate_engagement_rate(likes: Optional[int], comments: Optional[int], views: Optional[int]) -> Optional[float]:
    try:
        if likes is None or comments is None or views is None:
            return None
        likes_val = int(likes)
        comments_val = int(comments)
        views_val = int(views)
    except Exception:
        return None

    if views_val <= 0:
        return None
    return round(((likes_val + comments_val) / views_val) * 100, 4)
