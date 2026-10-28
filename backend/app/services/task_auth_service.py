from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, List

from app.models.project import ProjectMember, ProjectRole

if TYPE_CHECKING:
    from app.models.card import Card


def is_manager(member: ProjectMember) -> bool:
    """Project Manager / Team Lead has owner role or manager job_role."""
    return member.role == ProjectRole.owner or member.job_role == "manager"


def is_designer(member: ProjectMember) -> bool:
    """UI/UX Designer has cross-team read visibility."""
    if member.job_role == "designer":
        return True
    if member.team and member.team.slug == "design":
        return True
    return False


def is_hr(member: ProjectMember) -> bool:
    """HR Manager has access strictly to HR-only and HR team tasks."""
    if member.job_role == "hr":
        return True
    if member.team and member.team.slug == "hr":
        return True
    return False


def has_explicit_grant(card: Card, member: ProjectMember, user_id: uuid.UUID) -> str | None:
    """Returns permission ('view' | 'edit') if granted explicitly to user or team, else None."""
    if not hasattr(card, "access_grants") or not card.access_grants:
        return None

    for grant in card.access_grants:
        if grant.user_id and grant.user_id == user_id:
            return grant.permission
        if grant.team_id and member.team_id and grant.team_id == member.team_id:
            return grant.permission
    return None


def can_view_card(card: Card, member: ProjectMember, user_id: uuid.UUID) -> bool:
    """
    Evaluates whether the user may view this card according to OWASP least privilege:
    - Manager: can view all tasks
    - HR: can view ONLY HR tasks (visibility == 'hr_only' or owner_team.slug == 'hr')
    - Designer: can view all non-HR tasks (or HR tasks if explicitly granted)
    - Engineers: can view only own team's tasks or explicitly shared tasks
    """
    if is_manager(member):
        return True

    card_is_hr = card.visibility == "hr_only" or (
        card.owner_team is not None and card.owner_team.slug == "hr"
    )

    if is_hr(member):
        # HR can only see HR tasks
        return card_is_hr

    # Non-HR users cannot see HR tasks unless granted explicitly
    if card_is_hr:
        grant_perm = has_explicit_grant(card, member, user_id)
        return grant_perm is not None

    # Designer has cross-team read visibility on all engineering tasks
    if is_designer(member):
        return True

    # Creator can view card they created
    if card.created_by == user_id:
        return True

    # Check own team ownership
    if card.owner_team_id and member.team_id and card.owner_team_id == member.team_id:
        return True

    # Check explicit sharing grants
    grant_perm = has_explicit_grant(card, member, user_id)
    return grant_perm is not None


def can_edit_card(card: Card, member: ProjectMember, user_id: uuid.UUID) -> bool:
    """
    Evaluates whether the user may edit or move this card:
    - Manager: can edit any card
    - HR: can edit HR cards
    - Designer: can edit Design team cards, or cards with explicit 'edit' grant.
      Other teams' cards are read-only for Designer.
    - Engineers: can edit own team cards, or cards with explicit 'edit' grant.
    """
    if is_manager(member):
        return True

    card_is_hr = card.visibility == "hr_only" or (
        card.owner_team is not None and card.owner_team.slug == "hr"
    )

    if is_hr(member):
        return card_is_hr

    if card_is_hr:
        # Non-HR cannot edit HR cards
        grant_perm = has_explicit_grant(card, member, user_id)
        return grant_perm == "edit"

    if is_designer(member):
        # Designer can only edit cards owned by Design team, unless granted edit permission
        is_design_card = card.owner_team is not None and card.owner_team.slug == "design"
        if is_design_card:
            return True
        grant_perm = has_explicit_grant(card, member, user_id)
        return grant_perm == "edit"

    # Creator can edit card they created
    if card.created_by == user_id:
        return True

    # Engineers can edit their own team's cards
    if card.owner_team_id and member.team_id and card.owner_team_id == member.team_id:
        return True

    # Check explicit edit grants
    grant_perm = has_explicit_grant(card, member, user_id)
    return grant_perm == "edit"


def can_comment_card(card: Card, member: ProjectMember, user_id: uuid.UUID) -> bool:
    """Any member who can view a card may comment on it."""
    return can_view_card(card, member, user_id)


def can_delete_card(card: Card, member: ProjectMember, user_id: uuid.UUID) -> bool:
    """Only managers (owners) or the card creator can delete a card."""
    if is_manager(member):
        return True
    return card.created_by == user_id


def can_share_card(card: Card, member: ProjectMember, user_id: uuid.UUID) -> bool:
    """Only managers (owners) can manage task access grants."""
    return is_manager(member)


def filter_visible_cards(cards: List[Card], member: ProjectMember, user_id: uuid.UUID) -> List[Card]:
    """Filters a list of cards to only those visible to the given member."""
    return [c for c in cards if can_view_card(c, member, user_id)]
