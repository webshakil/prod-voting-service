import validator from 'validator';

/**
 * Sanitize vote answers to prevent injection attacks
 */
export const sanitizeVoteAnswers = (answers) => {
  if (typeof answers !== 'object' || Array.isArray(answers)) {
    throw new Error('Invalid answers format');
  }

  const sanitized = {};
  
  for (const [questionId, optionIds] of Object.entries(answers)) {
    // Validate question ID is integer
    const qId = parseInt(questionId);
    if (isNaN(qId) || qId < 1) {
      throw new Error(`Invalid question ID: ${questionId}`);
    }

    // Validate option IDs are integers
    if (!Array.isArray(optionIds)) {
      throw new Error(`Invalid options for question ${questionId}`);
    }

    const sanitizedOptions = optionIds.map(optId => {
      const oId = parseInt(optId);
      if (isNaN(oId) || oId < 1) {
        throw new Error(`Invalid option ID: ${optId}`);
      }
      return oId;
    });

    // Check for duplicate options
    if (new Set(sanitizedOptions).size !== sanitizedOptions.length) {
      throw new Error(`Duplicate options detected for question ${questionId}`);
    }

    sanitized[qId] = sanitizedOptions;
  }

  return sanitized;
};

/**
 * Validate and sanitize election ID
 */
export const sanitizeElectionId = (electionId) => {
  const id = parseInt(electionId);
  if (isNaN(id) || id < 1) {
    throw new Error('Invalid election ID');
  }
  return id;
};

/**
 * Sanitize text input (prevent XSS)
 */
export const sanitizeText = (text, maxLength = 500) => {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  let sanitized = validator.escape(text);
  sanitized = sanitized.trim();
  
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
};

/**
 * Validate UUID format
 */
export const isValidUUID = (uuid) => {
  return validator.isUUID(uuid);
};

/**
 * Validate amount (for payments/withdrawals)
 */
export const sanitizeAmount = (amount) => {
  const num = parseFloat(amount);
  if (isNaN(num) || num < 0 || num > 1000000) {
    throw new Error('Invalid amount');
  }
  return Math.round(num * 100) / 100;
};

export default {
  sanitizeVoteAnswers,
  sanitizeElectionId,
  sanitizeText,
  isValidUUID,
  sanitizeAmount
};