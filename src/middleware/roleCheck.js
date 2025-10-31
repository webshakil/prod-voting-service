
// // src/middleware/roleCheck.js
import { USER_ROLES, ADMIN_ROLES, CREATOR_ROLES, ERROR_MESSAGES } from '../config/constants.js';

/**
 * Check if user has any of the required roles
 * @param {string[]} allowedRoles - Array of role names
 */
export const hasRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: ERROR_MESSAGES.UNAUTHORIZED
      });
    }

    const userRole = req.user.role;
    const hasRequiredRole = allowedRoles.includes(userRole);

    if (!hasRequiredRole) {
      return res.status(403).json({
        success: false,
        message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
        error: `Required roles: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
};

/**
 * Check if user is admin (Manager or Admin role)
 */
export const isAdmin = (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(401).json({
      success: false,
      message: ERROR_MESSAGES.UNAUTHORIZED
    });
  }

  const userRole = req.user.role;
  const isAdminUser = ADMIN_ROLES.includes(userRole);

  if (!isAdminUser) {
    return res.status(403).json({
      success: false,
      message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
      error: 'Admin access required'
    });
  }

  next();
};

/**
 * Check if user is subscribed content creator
 */
export const isSubscribedCreator = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: ERROR_MESSAGES.UNAUTHORIZED
    });
  }

  const userRole = req.user.role;
  const subscribedCreatorRoles = [
    USER_ROLES.CONTENT_CREATOR_SUBSCRIBED,
    USER_ROLES.ORGANIZATION_CREATOR_SUBSCRIBED
  ];
  
  const isCreator = CREATOR_ROLES.includes(userRole) || ADMIN_ROLES.includes(userRole);
  const isSubscribed = subscribedCreatorRoles.includes(userRole) || 
                       req.user.isSubscribed || 
                       req.user.is_subscribed ||
                       ADMIN_ROLES.includes(userRole);

  if (!isCreator || !isSubscribed) {
    return res.status(403).json({
      success: false,
      message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
      error: 'Subscribed creator access required'
    });
  }

  next();
};

/**
 * Check if user is auditor
 */
export const isAuditor = (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(401).json({
      success: false,
      message: ERROR_MESSAGES.UNAUTHORIZED
    });
  }

  const userRole = req.user.role;
  const auditorRoles = [USER_ROLES.AUDITOR, USER_ROLES.MANAGER, USER_ROLES.ADMIN];
  const isAuditorUser = auditorRoles.includes(userRole);

  if (!isAuditorUser) {
    return res.status(403).json({
      success: false,
      message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
      error: 'Auditor access required'
    });
  }

  next();
};

/**
 * Check if user is analyst
 */
export const isAnalyst = (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(401).json({
      success: false,
      message: ERROR_MESSAGES.UNAUTHORIZED
    });
  }

  const userRole = req.user.role;
  const analystRoles = [USER_ROLES.ANALYST, USER_ROLES.MANAGER, USER_ROLES.ADMIN];
  const isAnalystUser = analystRoles.includes(userRole);

  if (!isAnalystUser) {
    return res.status(403).json({
      success: false,
      message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
      error: 'Analyst access required'
    });
  }

  next();
};

/**
 * Check if user can manage election (creator or admin)
 */
export const canManageElection = (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(401).json({
      success: false,
      message: ERROR_MESSAGES.UNAUTHORIZED
    });
  }

  const userRole = req.user.role;
  const managerRoles = [
    USER_ROLES.MANAGER,
    USER_ROLES.ADMIN,
    USER_ROLES.MODERATOR,
    USER_ROLES.CONTENT_CREATOR,
    USER_ROLES.CONTENT_CREATOR_SUBSCRIBED,
    USER_ROLES.ORGANIZATION_CREATOR,
    USER_ROLES.ORGANIZATION_CREATOR_SUBSCRIBED
  ];
  
  const canManage = managerRoles.includes(userRole);

  if (!canManage) {
    return res.status(403).json({
      success: false,
      message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
      error: 'Election management permission required'
    });
  }

  next();
};

export default {
  hasRole,
  isAdmin,
  isSubscribedCreator,
  isAuditor,
  isAnalyst,
  canManageElection
};









// import { ROLES, ERROR_MESSAGES } from '../config/constants.js';

// /**
//  * Check if user has any of the required roles
//  * @param {string[]} allowedRoles - Array of role names
//  */
// export const hasRole = (allowedRoles) => {
//   return (req, res, next) => {
//     if (!req.user || !req.user.roles) {
//       return res.status(401).json({
//         success: false,
//         message: ERROR_MESSAGES.UNAUTHORIZED
//       });
//     }

//     const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.roles];
//     const hasRequiredRole = userRoles.some(role => allowedRoles.includes(role));

//     if (!hasRequiredRole) {
//       return res.status(403).json({
//         success: false,
//         message: ERROR_MESSAGES.FORBIDDEN,
//         error: `Required roles: ${allowedRoles.join(', ')}`
//       });
//     }

//     next();
//   };
// };

// /**
//  * Check if user is admin (Manager or Admin role)
//  */
// export const isAdmin = (req, res, next) => {
//   if (!req.user || !req.user.roles) {
//     return res.status(401).json({
//       success: false,
//       message: ERROR_MESSAGES.UNAUTHORIZED
//     });
//   }

//   const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.roles];
//   const isAdminUser = userRoles.some(role => 
//     [ROLES.MANAGER, ROLES.ADMIN].includes(role)
//   );

//   if (!isAdminUser) {
//     return res.status(403).json({
//       success: false,
//       message: ERROR_MESSAGES.FORBIDDEN,
//       error: 'Admin access required'
//     });
//   }

//   next();
// };

// /**
//  * Check if user is subscribed content creator
//  */
// export const isSubscribedCreator = (req, res, next) => {
//   if (!req.user) {
//     return res.status(401).json({
//       success: false,
//       message: ERROR_MESSAGES.UNAUTHORIZED
//     });
//   }

//   const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.roles];
//   const isCreator = userRoles.some(role => 
//     [ROLES.CONTENT_CREATOR, ROLES.CONTENT_CREATOR_SUBSCRIBED, ROLES.ORGANIZATION_CREATOR].includes(role)
//   );

//   if (!isCreator || !req.user.isSubscribed) {
//     return res.status(403).json({
//       success: false,
//       message: ERROR_MESSAGES.FORBIDDEN,
//       error: 'Subscribed creator access required'
//     });
//   }

//   next();
// };

// /**
//  * Check if user is auditor
//  */
// export const isAuditor = (req, res, next) => {
//   if (!req.user || !req.user.roles) {
//     return res.status(401).json({
//       success: false,
//       message: ERROR_MESSAGES.UNAUTHORIZED
//     });
//   }

//   const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.roles];
//   const isAuditorUser = userRoles.some(role => 
//     [ROLES.AUDITOR, ROLES.MANAGER, ROLES.ADMIN].includes(role)
//   );

//   if (!isAuditorUser) {
//     return res.status(403).json({
//       success: false,
//       message: ERROR_MESSAGES.FORBIDDEN,
//       error: 'Auditor access required'
//     });
//   }

//   next();
// };

// /**
//  * Check if user is analyst
//  */
// export const isAnalyst = (req, res, next) => {
//   if (!req.user || !req.user.roles) {
//     return res.status(401).json({
//       success: false,
//       message: ERROR_MESSAGES.UNAUTHORIZED
//     });
//   }

//   const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.roles];
//   const isAnalystUser = userRoles.some(role => 
//     [ROLES.ANALYST, ROLES.MANAGER, ROLES.ADMIN].includes(role)
//   );

//   if (!isAnalystUser) {
//     return res.status(403).json({
//       success: false,
//       message: ERROR_MESSAGES.FORBIDDEN,
//       error: 'Analyst access required'
//     });
//   }

//   next();
// };

// /**
//  * Check if user can manage election (creator or admin)
//  */
// export const canManageElection = (req, res, next) => {
//   if (!req.user || !req.user.roles) {
//     return res.status(401).json({
//       success: false,
//       message: ERROR_MESSAGES.UNAUTHORIZED
//     });
//   }

//   const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.roles];
//   const canManage = userRoles.some(role => 
//     [
//       ROLES.MANAGER,
//       ROLES.ADMIN,
//       ROLES.MODERATOR,
//       ROLES.CONTENT_CREATOR,
//       ROLES.CONTENT_CREATOR_SUBSCRIBED,
//       ROLES.ORGANIZATION_CREATOR
//     ].includes(role)
//   );

//   if (!canManage) {
//     return res.status(403).json({
//       success: false,
//       message: ERROR_MESSAGES.FORBIDDEN,
//       error: 'Election management permission required'
//     });
//   }

//   next();
// };

// export default {
//   hasRole,
//   isAdmin,
//   isSubscribedCreator,
//   isAuditor,
//   isAnalyst,
//   canManageElection
// };