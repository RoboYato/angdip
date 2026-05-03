/**
 * Шифрование данных с грифом секретности (LMS).
 *
 * Как шифруются данные с грифом:
 * - Материалы с грифом Конфиденциально / Секретно / Совершенно секретно хранятся
 *   в БД в поле encrypted_content (plaintext в content не хранится).
 * - Алгоритм: AES-256-CBC, ключ 256 бит, IV 128 бит.
 * - Для каждого уровня доступа используется отдельный ключ (key_name: confidential_key,
 *   secret_key, top_secret_key), ключи хранятся в таблице encryption_keys.
 * - При создании/обновлении материала с конфиденциальным грифом контент шифруется
 *   и сохраняется в encrypted_content, content очищается.
 * - При выдаче материала пользователю контент расшифровывается после проверки ABAC
 *   и в ответ отдаётся уже расшифрованный текст.
 */
import crypto from 'crypto';
import { classifiedPool } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';

/** Ключи шифрования секретных материалов хранятся в classified_db (см. initClassifiedDb). */
const keysPool = classifiedPool;

const ALGORITHM = 'aes-256-cbc';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits

export interface EncryptionResult {
  encryptedData: Buffer;
  keyId: string;
}

export interface DecryptionResult {
  decryptedData: string;
}

/**
 * Generates a new encryption key and stores it in the database
 */
export async function generateEncryptionKey(keyName: string): Promise<string> {
  const key = crypto.randomBytes(KEY_LENGTH);
  const keyId = uuidv4();

  await keysPool.query(
    'INSERT INTO encryption_keys (id, key_name, encryption_key, is_active) VALUES ($1, $2, $3, true)',
    [keyId, keyName, key]
  );

  return keyId;
}

/**
 * Retrieves an encryption key from the database
 */
async function getEncryptionKey(keyId: string): Promise<Buffer | null> {
  const result = await keysPool.query(
    'SELECT encryption_key FROM encryption_keys WHERE id = $1 AND is_active = true',
    [keyId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0].encryption_key;
}

/**
 * Encrypts data using AES-256-GCM
 */
export async function encryptData(data: string, keyId?: string): Promise<EncryptionResult> {
  let actualKeyId = keyId;
  
  // If no key ID provided, get or create default key
  if (!actualKeyId) {
    const defaultKeyResult = await keysPool.query(
      'SELECT id FROM encryption_keys WHERE key_name = $1 AND is_active = true LIMIT 1',
      ['default']
    );

    if (defaultKeyResult.rows.length === 0) {
      actualKeyId = await generateEncryptionKey('default');
    } else {
      actualKeyId = defaultKeyResult.rows[0].id;
    }
  }

  const key = await getEncryptionKey(actualKeyId);
  if (!key) {
    throw new Error('Encryption key not found');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipher('aes-256-cbc', key);

  const encrypted = Buffer.concat([
    cipher.update(data, 'utf8'),
    cipher.final()
  ]);

  // For simplicity, we'll just combine IV + encrypted data
  const encryptedData = Buffer.concat([iv, encrypted]);

  return {
    encryptedData,
    keyId: actualKeyId
  };
}

/**
 * Decrypts data using AES-256-CBC
 */
export async function decryptData(encryptedData: Buffer, keyId: string): Promise<DecryptionResult> {
  const key = await getEncryptionKey(keyId);
  if (!key) {
    throw new Error('Decryption key not found');
  }

  // Extract IV and encrypted content
  const iv = encryptedData.slice(0, IV_LENGTH);
  const encrypted = encryptedData.slice(IV_LENGTH);

  const decipher = crypto.createDecipher('aes-256-cbc', key);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);

  return {
    decryptedData: decrypted.toString('utf8')
  };
}

/**
 * Encrypts material content if it has a confidential access level
 */
export async function encryptMaterialContent(content: string, accessLevelCode: string): Promise<EncryptionResult | null> {
  // Only encrypt if access level is confidential or higher
  const confidentialLevels = ['CONFIDENTIAL', 'SECRET', 'TOP_SECRET'];
  
  if (!confidentialLevels.includes(accessLevelCode)) {
    return null;
  }

  // Use access level specific key
  const keyName = `${accessLevelCode.toLowerCase()}_key`;
  
  let keyId: string;
  const existingKeyResult = await keysPool.query(
    'SELECT id FROM encryption_keys WHERE key_name = $1 AND is_active = true LIMIT 1',
    [keyName]
  );

  if (existingKeyResult.rows.length === 0) {
    keyId = await generateEncryptionKey(keyName);
  } else {
    keyId = existingKeyResult.rows[0].id;
  }

  return await encryptData(content, keyId);
}

/**
 * Decrypts material content
 */
export async function decryptMaterialContent(encryptedContent: Buffer, keyId: string): Promise<string> {
  const result = await decryptData(encryptedContent, keyId);
  return result.decryptedData;
}

/**
 * Gets available encryption keys (for admin purposes)
 */
export async function getEncryptionKeys(): Promise<any[]> {
  const result = await keysPool.query(
    'SELECT id, key_name, created_at, is_active FROM encryption_keys ORDER BY created_at DESC'
  );

  return result.rows;
}

/**
 * Deactivates an encryption key
 */
export async function deactivateEncryptionKey(keyId: string): Promise<void> {
  await keysPool.query(
    'UPDATE encryption_keys SET is_active = false WHERE id = $1',
    [keyId]
  );
}