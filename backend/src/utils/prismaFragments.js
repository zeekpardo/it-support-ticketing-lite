// User with just id and name
export const USER_SELECT_BRIEF = {
  id: true,
  name: true,
};

// User with id, name, and email
export const USER_SELECT = {
  id: true,
  name: true,
  email: true,
};

// User with id, name, email, and image
export const USER_SELECT_FULL = {
  id: true,
  name: true,
  email: true,
  image: true,
};

// Member with user brief info
export const MEMBER_WITH_USER_BRIEF = {
  id: true,
  user: { select: USER_SELECT_BRIEF },
};

// Member with user email info
export const MEMBER_WITH_USER = {
  id: true,
  user: { select: USER_SELECT },
};

// Member with role and user brief info
export const MEMBER_WITH_ROLE_AND_USER_BRIEF = {
  id: true,
  role: true,
  user: { select: USER_SELECT_BRIEF },
};

// Member with role and user + email
export const MEMBER_WITH_ROLE_AND_USER = {
  id: true,
  role: true,
  user: { select: USER_SELECT },
};

// Project brief info
export const PROJECT_SELECT_BRIEF = {
  id: true,
  name: true,
  projectCode: true,
};

// Project with client name
export const PROJECT_SELECT = {
  id: true,
  name: true,
  projectCode: true,
  clientName: true,
};

// Project with active status (used in assignments)
export const PROJECT_SELECT_ACTIVE = {
  id: true,
  name: true,
  projectCode: true,
  isActive: true,
};

// Ticket stage select
export const STAGE_SELECT = {
  id: true,
  name: true,
  slug: true,
  color: true,
  position: true,
  isDefault: true,
  isResolved: true,
};

// Project assignment with project info
export const PROJECT_ASSIGNMENT_INCLUDE = {
  project: {
    select: {
      id: true,
      name: true,
      projectCode: true,
      isActive: true,
    },
  },
};
