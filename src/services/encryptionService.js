import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const ALGORITHM = process.env.VOTE_ENCRYPTION_ALGORITHM || 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.VOTE_ENCRYPTION_KEY || crypto.randomBytes(32);
const IV_LENGTH = 16;

/**
 * Encryption Service
 * Provides vote encryption, decryption, and integrity verification
 */

/**
 * Encrypt data
 */
export const encrypt = (data) => {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY),
      iv
    );
    
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    let encrypted = cipher.update(dataString, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypt data
 */
export const decrypt = (encryptedData) => {
  try {
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = parts.join(':');
    
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY),
      iv
    );
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    try {
      return JSON.parse(decrypted);
    } catch {
      return decrypted;
    }
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
};

/**
 * Generate hash
 */
export const hash = (data) => {
  try {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto
      .createHash('sha256')
      .update(dataString)
      .digest('hex');
  } catch (error) {
    console.error('Hash generation error:', error);
    throw new Error('Failed to generate hash');
  }
};

/**
 * Verify hash
 */
export const verifyHash = (data, storedHash) => {
  try {
    const newHash = hash(data);
    return newHash === storedHash;
  } catch (error) {
    console.error('Hash verification error:', error);
    return false;
  }
};

/**
 * Generate secure random string
 */
export const generateSecureRandom = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Generate UUID
 */
export const generateUUID = () => {
  return crypto.randomUUID();
};

/**
 * Generate verification code
 */
export const generateVerificationCode = (data) => {
  const combined = `${data}:${Date.now()}:${crypto.randomBytes(8).toString('hex')}`;
  return crypto
    .createHash('sha256')
    .update(combined)
    .digest('hex')
    .substring(0, 12)
    .toUpperCase();
};

/**
 * Generate HMAC signature
 */
export const generateSignature = (data, secret) => {
  try {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto
      .createHmac('sha256', secret)
      .update(dataString)
      .digest('hex');
  } catch (error) {
    console.error('Signature generation error:', error);
    throw new Error('Failed to generate signature');
  }
};

/**
 * Verify HMAC signature
 */
export const verifySignature = (data, signature, secret) => {
  try {
    const expectedSignature = generateSignature(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
};

/**
 * Encrypt vote with metadata
 */
export const encryptVote = (voteData, metadata = {}) => {
  const votePackage = {
    vote: voteData,
    metadata: {
      ...metadata,
      timestamp: new Date().toISOString(),
      version: '1.0'
    }
  };

  const encrypted = encrypt(votePackage);
  const voteHash = hash(voteData);

  return {
    encryptedVote: encrypted,
    voteHash
  };
};

/**
 * Decrypt vote and verify
 */
export const decryptVote = (encryptedVote, expectedHash) => {
  try {
    const decryptedPackage = decrypt(encryptedVote);
    const voteData = decryptedPackage.vote;
    
    // Verify hash
    const isValid = verifyHash(voteData, expectedHash);
    
    return {
      voteData,
      metadata: decryptedPackage.metadata,
      isValid
    };
  } catch (error) {
    console.error('Vote decryption error:', error);
    throw new Error('Failed to decrypt vote');
  }
};

/**
 * Generate lottery ball number (deterministic from user ID)
 */
export const generateBallNumber = (userId, electionId) => {
  try {
    const combined = `${userId}:${electionId}`;
    const hashValue = crypto
      .createHash('sha256')
      .update(combined)
      .digest('hex');
    
    // Convert first 8 hex characters to number
    const number = parseInt(hashValue.substring(0, 8), 16);
    // Mod to get number between 1 and 9999999
    return (number % 9999999) + 1;
  } catch (error) {
    console.error('Ball number generation error:', error);
    throw new Error('Failed to generate ball number');
  }
};

/**
 * Generate cryptographically secure random number
 */
export const secureRandomInt = (max) => {
  try {
    const randomBytes = crypto.randomBytes(4);
    const randomNumber = randomBytes.readUInt32BE(0);
    return randomNumber % max;
  } catch (error) {
    console.error('Secure random generation error:', error);
    throw new Error('Failed to generate secure random number');
  }
};

/**
 * Generate lottery random seed
 */
export const generateLotteryRandomSeed = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Password hashing (for future use)
 */
export const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      resolve(salt + ':' + derivedKey.toString('hex'));
    });
  });
};

/**
 * Verify password (for future use)
 */
export const verifyPassword = async (password, hashedPassword) => {
  const [salt, key] = hashedPassword.split(':');
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      resolve(key === derivedKey.toString('hex'));
    });
  });
};

export default {
  encrypt,
  decrypt,
  hash,
  verifyHash,
  generateSecureRandom,
  generateUUID,
  generateVerificationCode,
  generateSignature,
  verifySignature,
  encryptVote,
  decryptVote,
  generateBallNumber,
  secureRandomInt,
  generateLotteryRandomSeed,
  hashPassword,
  verifyPassword
};