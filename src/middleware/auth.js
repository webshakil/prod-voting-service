// src/middleware/auth.js
import { USER_ROLES, ADMIN_ROLES, CREATOR_ROLES, ERROR_MESSAGES } from '../config/constants.js';

/**
 * Extract user data from request headers
 * Assumes user-service or API gateway has already validated authentication
 * and attached user data to x-user-data header
 */
export const extractUserData = (req, res, next) => {
  try {
    // Get user data from header (set by auth-service/gateway)
    const userDataHeader = req.headers['x-user-data'];
    
    if (!userDataHeader) {
      return res.status(401).json({
        success: false,
        message: ERROR_MESSAGES.UNAUTHORIZED,
        error: 'User data not found in request headers'
      });
    }

    // Parse user data (assuming it's JSON string or already parsed)
    let userData;
    if (typeof userDataHeader === 'string') {
      try {
        userData = JSON.parse(userDataHeader);
      } catch (parseError) {
        return res.status(401).json({
          success: false,
          message: ERROR_MESSAGES.UNAUTHORIZED,
          error: 'Invalid user data format'
        });
      }
    } else {
      userData = userDataHeader;
    }

    // Validate required user fields
    if (!userData.user_id || !userData.role) {
      return res.status(401).json({
        success: false,
        message: ERROR_MESSAGES.UNAUTHORIZED,
        error: 'Incomplete user data'
      });
    }

    // Attach user data to request object
    req.user = {
      user_id: userData.user_id,
      email: userData.email,
      role: userData.role,
      organization_id: userData.organization_id || null,
      subscription_status: userData.subscription_status || 'free',
      is_subscribed: userData.is_subscribed || false,
      ...userData
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: error.message
    });
  }
};

/**
 * Check if user is authenticated
 * Simple check that user data exists
 */
export const requireAuth = (req, res, next) => {
  if (!req.user || !req.user.user_id) {
    return res.status(401).json({
      success: false,
      message: ERROR_MESSAGES.UNAUTHORIZED,
      error: 'Authentication required'
    });
  }
  next();
};

/**
 * Check if user has specific role
 */
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: ERROR_MESSAGES.UNAUTHORIZED,
        error: 'User role not found'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
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
 * Check if user is admin (any admin role)
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(401).json({
      success: false,
      message: ERROR_MESSAGES.UNAUTHORIZED
    });
  }

  if (!ADMIN_ROLES.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
      error: 'Admin access required'
    });
  }

  next();
};

/**
 * Check if user is creator (any creator role)
 */
export const requireCreator = (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(401).json({
      success: false,
      message: ERROR_MESSAGES.UNAUTHORIZED
    });
  }

  if (!CREATOR_ROLES.includes(req.user.role) && !ADMIN_ROLES.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
      error: 'Creator or admin access required'
    });
  }

  next();
};

/**
 * Check if user is subscribed creator
 */
export const requireSubscribedCreator = (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(401).json({
      success: false,
      message: ERROR_MESSAGES.UNAUTHORIZED
    });
  }

  const subscribedCreatorRoles = [
    USER_ROLES.CONTENT_CREATOR_SUBSCRIBED,
    USER_ROLES.ORGANIZATION_CREATOR_SUBSCRIBED
  ];

  if (!subscribedCreatorRoles.includes(req.user.role) && !ADMIN_ROLES.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
      error: 'Subscribed creator or admin access required'
    });
  }

  next();
};

/**
 * Check if user is voter
 */
export const requireVoter = (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(401).json({
      success: false,
      message: ERROR_MESSAGES.UNAUTHORIZED
    });
  }

  // Any authenticated user can be a voter
  next();
};

/**
 * Check if user is sponsor
 */
export const requireSponsor = (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(401).json({
      success: false,
      message: ERROR_MESSAGES.UNAUTHORIZED
    });
  }

  if (req.user.role !== USER_ROLES.SPONSOR && !ADMIN_ROLES.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
      error: 'Sponsor or admin access required'
    });
  }

  next();
};

/**
 * Check if user is auditor
 */
export const requireAuditor = (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(401).json({
      success: false,
      message: ERROR_MESSAGES.UNAUTHORIZED
    });
  }

  const auditorRoles = [
    USER_ROLES.AUDITOR,
    USER_ROLES.MANAGER,
    USER_ROLES.ADMIN
  ];

  if (!auditorRoles.includes(req.user.role)) {
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
export const requireAnalyst = (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(401).json({
      success: false,
      message: ERROR_MESSAGES.UNAUTHORIZED
    });
  }

  const analystRoles = [
    USER_ROLES.ANALYST,
    USER_ROLES.MANAGER,
    USER_ROLES.ADMIN
  ];

  if (!analystRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
      error: 'Analyst access required'
    });
  }

  next();
};

/**
 * Optional auth - attach user data if present, but don't require it
 */
export const optionalAuth = (req, res, next) => {
  try {
    const userDataHeader = req.headers['x-user-data'];
    
    if (userDataHeader) {
      let userData;
      if (typeof userDataHeader === 'string') {
        try {
          userData = JSON.parse(userDataHeader);
          req.user = {
            user_id: userData.user_id,
            email: userData.email,
            role: userData.role,
            organization_id: userData.organization_id || null,
            subscription_status: userData.subscription_status || 'free',
            is_subscribed: userData.is_subscribed || false,
            ...userData
          };
        } catch (parseError) {
          // Ignore parse errors for optional auth
        }
      }
    }
    
    next();
  } catch (error) {
    // Continue without user data for optional auth
    next();
  }
};

/**
 * Check if user owns the resource (e.g., election, vote)
 * Used in combination with other middleware
 */
export const requireOwnership = (resourceUserIdField = 'creator_id') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: ERROR_MESSAGES.UNAUTHORIZED
      });
    }

    // Admin can access any resource
    if (ADMIN_ROLES.includes(req.user.role)) {
      return next();
    }

    // Check ownership (resource should be attached to req by previous middleware)
    const resource = req.resource;
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found'
      });
    }

    if (resource[resourceUserIdField] !== req.user.user_id) {
      return res.status(403).json({
        success: false,
        message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
        error: 'You do not own this resource'
      });
    }

    next();
  };
};

export default {
  extractUserData,
  requireAuth,
  requireRole,
  requireAdmin,
  requireCreator,
  requireSubscribedCreator,
  requireVoter,
  requireSponsor,
  requireAuditor,
  requireAnalyst,
  optionalAuth,
  requireOwnership
};