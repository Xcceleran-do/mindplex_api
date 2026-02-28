import { Role } from "$src/db/schema";

export const ROLE_HIERARCHY: Record<Role, number> = {
    user: 1,
    collaborator: 2,
    moderator: 3,
    editor: 4,
    admin: 5,
};

export const hasRole = (userRole: Role, requiredRole: Role): boolean => ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];