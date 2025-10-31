// src/utils/cryptoUtils.js
import crypto from 'crypto';
import dotenv from 'dotenv';

// ✅ Ensure .env is loaded (safety fallback)
dotenv.config();

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

// ✅ Lazy load the encryption key only when needed
let ENCRYPTION_KEY = null;

const getEncryptionKey = () => {
  if (ENCRYPTION_KEY) return ENCRYPTION_KEY;

  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY is not set in environment variables');
  }

  ENCRYPTION_KEY = crypto.createHash('sha256').update(key).digest();
  return ENCRYPTION_KEY;
};

/**
 * Encrypt vote data using AES-256-CBC
 */
export const encryptVote = (voteData) => {
  try {
    const ENCRYPTION_KEY = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

    const text = JSON.stringify(voteData);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt vote data');
  }
};

/**
 * Decrypt vote data
 */
export const decryptVote = (encryptedData) => {
  try {
    const ENCRYPTION_KEY = getEncryptionKey();
    const [ivHex, encrypted] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt vote data');
  }
};

/**
 * Generate vote hash for integrity verification
 */
export const generateVoteHash = (voteData) => {
  const dataString = JSON.stringify({
    userId: voteData.userId,
    electionId: voteData.electionId,
    answers: voteData.answers,
    timestamp: voteData.timestamp
  });

  return crypto.createHash('sha256').update(dataString).digest('hex');
};

/**
 * Verify vote hash
 */
export const verifyVoteHash = (voteData, expectedHash) => {
  const actualHash = generateVoteHash(voteData);
  return actualHash === expectedHash;
};

/**
 * Generate verification code for receipt
 */
export const generateVerificationCode = (votingId, userId) => {
  const data = `${votingId}-${userId}-${Date.now()}`;
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  return hash.substring(0, 16).toUpperCase();
};

/**
 * Generate ball number for lottery
 */
export const generateBallNumber = (userId, electionId) => {
  const data = `${userId}-${electionId}`;
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  return parseInt(hash.substring(0, 8), 16) % 1000000;
};

/**
 * Secure random number generator
 */
export const secureRandom = (max) => {
  const randomBytes = crypto.randomBytes(4);
  const randomValue = randomBytes.readUInt32BE(0);
  return randomValue % max;
};

/**
 * Generate lottery random seed
 */
export const generateLotteryRandomSeed = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Hash data (one-way)
 */
export const hashData = (data) => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

/**
 * Create HMAC for verification
 */
export const createHMAC = (data, secret) => {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
};

/**
 * Verify HMAC
 */
export const verifyHMAC = (data, secret, expectedHMAC) => {
  const actualHMAC = createHMAC(data, secret);
  return crypto.timingSafeEqual(
    Buffer.from(actualHMAC),
    Buffer.from(expectedHMAC)
  );
};

export default {
  encryptVote,
  decryptVote,
  generateVoteHash,
  verifyVoteHash,
  generateVerificationCode,
  generateBallNumber,
  secureRandom,
  generateLotteryRandomSeed,
  hashData,
  createHMAC,
  verifyHMAC
};

// // src/utils/cryptoUtils.js
// import crypto from 'crypto';

// const ALGORITHM = 'aes-256-cbc';

// // ✅ FIX: Handle encryption key properly
// const getEncryptionKey = () => {
//   const key = process.env.ENCRYPTION_KEY;
  
//   if (!key) {
//     throw new Error('ENCRYPTION_KEY is not set in environment variables');
//   }
  
//   // Create a 32-byte key from the environment variable
//   return crypto.createHash('sha256').update(key).digest();
// };

// const ENCRYPTION_KEY = getEncryptionKey();
// const IV_LENGTH = 16;

// /**
//  * Encrypt vote data using AES-256-CBC
//  */
// export const encryptVote = (voteData) => {
//   try {
//     const iv = crypto.randomBytes(IV_LENGTH);
//     const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    
//     const text = JSON.stringify(voteData);
//     let encrypted = cipher.update(text, 'utf8', 'hex');
//     encrypted += cipher.final('hex');
    
//     return iv.toString('hex') + ':' + encrypted;
//   } catch (error) {
//     console.error('Encryption error:', error);
//     throw new Error('Failed to encrypt vote data');
//   }
// };

// /**
//  * Decrypt vote data
//  */
// export const decryptVote = (encryptedData) => {
//   try {
//     const parts = encryptedData.split(':');
//     const iv = Buffer.from(parts[0], 'hex');
//     const encrypted = parts[1];
    
//     const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    
//     let decrypted = decipher.update(encrypted, 'hex', 'utf8');
//     decrypted += decipher.final('utf8');
    
//     return JSON.parse(decrypted);
//   } catch (error) {
//     console.error('Decryption error:', error);
//     throw new Error('Failed to decrypt vote data');
//   }
// };

// /**
//  * Generate vote hash for integrity verification
//  */
// export const generateVoteHash = (voteData) => {
//   const dataString = JSON.stringify({
//     userId: voteData.userId,
//     electionId: voteData.electionId,
//     answers: voteData.answers,
//     timestamp: voteData.timestamp
//   });
  
//   return crypto.createHash('sha256').update(dataString).digest('hex');
// };

// /**
//  * Verify vote hash
//  */
// export const verifyVoteHash = (voteData, expectedHash) => {
//   const actualHash = generateVoteHash(voteData);
//   return actualHash === expectedHash;
// };

// /**
//  * Generate verification code for receipt
//  */
// export const generateVerificationCode = (votingId, userId) => {
//   const data = `${votingId}-${userId}-${Date.now()}`;
//   const hash = crypto.createHash('sha256').update(data).digest('hex');
//   return hash.substring(0, 16).toUpperCase();
// };

// /**
//  * Generate ball number for lottery
//  */
// export const generateBallNumber = (userId, electionId) => {
//   const data = `${userId}-${electionId}`;
//   const hash = crypto.createHash('sha256').update(data).digest('hex');
//   return parseInt(hash.substring(0, 8), 16) % 1000000;
// };

// /**
//  * Secure random number generator
//  */
// export const secureRandom = (max) => {
//   const randomBytes = crypto.randomBytes(4);
//   const randomValue = randomBytes.readUInt32BE(0);
//   return randomValue % max;
// };

// /**
//  * Generate lottery random seed
//  */
// export const generateLotteryRandomSeed = () => {
//   return crypto.randomBytes(32).toString('hex');
// };

// /**
//  * Hash data (one-way)
//  */
// export const hashData = (data) => {
//   return crypto.createHash('sha256').update(data).digest('hex');
// };

// /**
//  * Create HMAC for verification
//  */
// export const createHMAC = (data, secret) => {
//   return crypto.createHmac('sha256', secret).update(data).digest('hex');
// };

// /**
//  * Verify HMAC
//  */
// export const verifyHMAC = (data, secret, expectedHMAC) => {
//   const actualHMAC = createHMAC(data, secret);
//   return crypto.timingSafeEqual(
//     Buffer.from(actualHMAC),
//     Buffer.from(expectedHMAC)
//   );
// };

// export default {
//   encryptVote,
//   decryptVote,
//   generateVoteHash,
//   verifyVoteHash,
//   generateVerificationCode,
//   generateBallNumber,
//   secureRandom,
//   generateLotteryRandomSeed,
//   hashData,
//   createHMAC,
//   verifyHMAC
// };
// import crypto from 'crypto';

// const ALGORITHM = 'aes-256-cbc';
// const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY).slice(0, 32);
// const IV_LENGTH = 16;

// /**
//  * Encrypt vote data using AES-256-CBC
//  */
// export const encryptVote = (voteData) => {
//   try {
//     const iv = crypto.randomBytes(IV_LENGTH);
//     const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    
//     const text = JSON.stringify(voteData);
//     let encrypted = cipher.update(text, 'utf8', 'hex');
//     encrypted += cipher.final('hex');
    
//     return iv.toString('hex') + ':' + encrypted;
//   } catch (error) {
//     console.error('Encryption error:', error);
//     throw new Error('Failed to encrypt vote data');
//   }
// };

// /**
//  * Decrypt vote data
//  */
// export const decryptVote = (encryptedData) => {
//   try {
//     const parts = encryptedData.split(':');
//     const iv = Buffer.from(parts[0], 'hex');
//     const encrypted = parts[1];
    
//     const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    
//     let decrypted = decipher.update(encrypted, 'hex', 'utf8');
//     decrypted += decipher.final('utf8');
    
//     return JSON.parse(decrypted);
//   } catch (error) {
//     console.error('Decryption error:', error);
//     throw new Error('Failed to decrypt vote data');
//   }
// };

// /**
//  * Generate vote hash for integrity verification
//  */
// export const generateVoteHash = (voteData) => {
//   const dataString = JSON.stringify({
//     userId: voteData.userId,
//     electionId: voteData.electionId,
//     answers: voteData.answers,
//     timestamp: voteData.timestamp
//   });
  
//   return crypto.createHash('sha256').update(dataString).digest('hex');
// };

// /**
//  * Verify vote hash
//  */
// export const verifyVoteHash = (voteData, expectedHash) => {
//   const actualHash = generateVoteHash(voteData);
//   return actualHash === expectedHash;
// };

// /**
//  * Generate verification code for receipt
//  */
// export const generateVerificationCode = (votingId, userId) => {
//   const data = `${votingId}-${userId}-${Date.now()}`;
//   const hash = crypto.createHash('sha256').update(data).digest('hex');
//   return hash.substring(0, 16).toUpperCase();
// };

// /**
//  * Generate ball number for lottery
//  */
// export const generateBallNumber = (userId, electionId) => {
//   const data = `${userId}-${electionId}`;
//   const hash = crypto.createHash('sha256').update(data).digest('hex');
//   return parseInt(hash.substring(0, 8), 16) % 1000000;
// };

// /**
//  * Secure random number generator
//  */
// export const secureRandom = (max) => {
//   const randomBytes = crypto.randomBytes(4);
//   const randomValue = randomBytes.readUInt32BE(0);
//   return randomValue % max;
// };

// /**
//  * Generate lottery random seed
//  */
// export const generateLotteryRandomSeed = () => {
//   return crypto.randomBytes(32).toString('hex');
// };

// /**
//  * Create HMAC for verification
//  */
// export const createHMAC = (data, secret) => {
//   return crypto.createHmac('sha256', secret).update(data).digest('hex');
// };

// /**
//  * Verify HMAC
//  */
// export const verifyHMAC = (data, secret, expectedHMAC) => {
//   const actualHMAC = createHMAC(data, secret);
//   return crypto.timingSafeEqual(
//     Buffer.from(actualHMAC),
//     Buffer.from(expectedHMAC)
//   );
// };

// export default {
//   encryptVote,
//   decryptVote,
//   generateVoteHash,
//   verifyVoteHash,
//   generateVerificationCode,
//   generateBallNumber,
//   secureRandom,
//   generateLotteryRandomSeed,
//   createHMAC,
//   verifyHMAC
// };
// import crypto from 'crypto';
// import dotenv from 'dotenv';

// dotenv.config();

// const ALGORITHM = process.env.VOTE_ENCRYPTION_ALGORITHM || 'aes-256-cbc';
// const ENCRYPTION_KEY = process.env.VOTE_ENCRYPTION_KEY || crypto.randomBytes(32);
// const IV_LENGTH = 16;

// /**
//  * Encrypt vote data
//  * @param {Object} voteData - Vote data to encrypt
//  * @returns {string} - Encrypted string
//  */
// export const encryptVote = (voteData) => {
//   try {
//     const iv = crypto.randomBytes(IV_LENGTH);
//     const cipher = crypto.createCipheriv(
//       ALGORITHM,
//       Buffer.from(ENCRYPTION_KEY),
//       iv
//     );
    
//     let encrypted = cipher.update(JSON.stringify(voteData), 'utf8', 'hex');
//     encrypted += cipher.final('hex');
    
//     return iv.toString('hex') + ':' + encrypted;
//   } catch (error) {
//     console.error('Encryption error:', error);
//     throw new Error('Failed to encrypt vote data');
//   }
// };

// /**
//  * Decrypt vote data
//  * @param {string} encryptedData - Encrypted vote string
//  * @returns {Object} - Decrypted vote data
//  */
// export const decryptVote = (encryptedData) => {
//   try {
//     const parts = encryptedData.split(':');
//     const iv = Buffer.from(parts.shift(), 'hex');
//     const encryptedText = parts.join(':');
    
//     const decipher = crypto.createDecipheriv(
//       ALGORITHM,
//       Buffer.from(ENCRYPTION_KEY),
//       iv
//     );
    
//     let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
//     decrypted += decipher.final('utf8');
    
//     return JSON.parse(decrypted);
//   } catch (error) {
//     console.error('Decryption error:', error);
//     throw new Error('Failed to decrypt vote data');
//   }
// };

// /**
//  * Generate vote hash using SHA-256
//  * @param {Object} voteData - Vote data to hash
//  * @returns {string} - Hash string
//  */
// export const generateVoteHash = (voteData) => {
//   try {
//     const hash = crypto
//       .createHash('sha256')
//       .update(JSON.stringify(voteData))
//       .digest('hex');
//     return hash;
//   } catch (error) {
//     console.error('Hash generation error:', error);
//     throw new Error('Failed to generate vote hash');
//   }
// };

// /**
//  * Generate verification code for receipt
//  * @param {string} votingId - Voting ID
//  * @param {string} userId - User ID
//  * @returns {string} - Verification code
//  */
// export const generateVerificationCode = (votingId, userId) => {
//   try {
//     const data = `${votingId}:${userId}:${Date.now()}`;
//     const code = crypto
//       .createHash('sha256')
//       .update(data)
//       .digest('hex')
//       .substring(0, 12)
//       .toUpperCase();
//     return code;
//   } catch (error) {
//     console.error('Verification code generation error:', error);
//     throw new Error('Failed to generate verification code');
//   }
// };

// /**
//  * Generate lottery ball number from user ID (deterministic)
//  * @param {string} userId - User ID
//  * @param {number} electionId - Election ID
//  * @returns {number} - Ball number (1-9999999)
//  */
// export const generateBallNumber = (userId, electionId) => {
//   try {
//     const hash = crypto
//       .createHash('sha256')
//       .update(`${userId}:${electionId}`)
//       .digest('hex');
    
//     // Convert first 8 hex characters to number
//     const number = parseInt(hash.substring(0, 8), 16);
//     // Mod to get number between 1 and 9999999
//     return (number % 9999999) + 1;
//   } catch (error) {
//     console.error('Ball number generation error:', error);
//     throw new Error('Failed to generate ball number');
//   }
// };

// /**
//  * Generate cryptographically secure random number for lottery
//  * @param {number} max - Maximum value (exclusive)
//  * @returns {number} - Random number between 0 and max-1
//  */
// export const secureRandom = (max) => {
//   try {
//     const randomBytes = crypto.randomBytes(4);
//     const randomNumber = randomBytes.readUInt32BE(0);
//     return randomNumber % max;
//   } catch (error) {
//     console.error('Secure random generation error:', error);
//     throw new Error('Failed to generate secure random number');
//   }
// };

// /**
//  * Generate lottery random seed for transparency
//  * @returns {string} - Random seed hex string
//  */
// export const generateLotteryRandomSeed = () => {
//   try {
//     return crypto.randomBytes(32).toString('hex');
//   } catch (error) {
//     console.error('Random seed generation error:', error);
//     throw new Error('Failed to generate random seed');
//   }
// };

// /**
//  * Verify vote hash
//  * @param {Object} voteData - Vote data to verify
//  * @param {string} storedHash - Stored hash to compare
//  * @returns {boolean} - True if hash matches
//  */
// export const verifyVoteHash = (voteData, storedHash) => {
//   try {
//     const newHash = generateVoteHash(voteData);
//     return newHash === storedHash;
//   } catch (error) {
//     console.error('Hash verification error:', error);
//     return false;
//   }
// };

// export default {
//   encryptVote,
//   decryptVote,
//   generateVoteHash,
//   generateVerificationCode,
//   generateBallNumber,
//   secureRandom,
//   generateLotteryRandomSeed,
//   verifyVoteHash
// };