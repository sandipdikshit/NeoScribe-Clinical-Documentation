# crypto_service_aes_gcm.py
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import os
import json
import base64
from typing import Any, Dict, Union, Optional
import logging

logger = logging.getLogger(__name__)


class AESGCMCryptoService:
    """Service to handle AES-256-GCM encryption and decryption operations"""
    
    def __init__(self):
        """
        Initialize crypto service with either a key or password
        
        Args:
            secret_key: 32-byte key encoded as base64 string
            password: Password to derive key from (if secret_key not provided)
        """
        self.key = os.getenv('AES_SECRET_KEY')
    
    def encrypt(self, data: Any) -> Dict[str, str]:
        """
        Encrypt data using AES-256-GCM and return in the specified format
        
        Args:
            data: Any JSON-serializable data
            
        Returns:
            Dict with keys: encryptedText, authTag, iv (all hex encoded)
        """
        try:
            # Convert data to JSON string if it's not already a string
            if not isinstance(data, str):
                plaintext = json.dumps(data, ensure_ascii=False)
            else:
                plaintext = data
            
            # Generate a random IV (96 bits / 12 bytes for GCM)
            iv = os.urandom(12)

            # Convert hex key to bytes if it's a string
            if isinstance(self.key, str):
                key_bytes = bytes.fromhex(self.key)
            else:
                key_bytes = self.key
            
            # Create cipher
            cipher = Cipher(
                algorithms.AES(key_bytes),
                modes.GCM(iv),
                backend=default_backend()
            )
            encryptor = cipher.encryptor()
            
            # Encrypt the data
            ciphertext = encryptor.update(plaintext.encode('utf-8')) + encryptor.finalize()
            
            # Get the authentication tag (16 bytes)
            auth_tag = encryptor.tag
            
            # Combine ciphertext and auth tag to mirror JavaScript behavior
            # JavaScript's Web Crypto API returns them combined
            combined_encrypted = ciphertext + auth_tag
            
            # Extract encrypted data and auth tag (mimicking JavaScript slice operations)
            encrypted_data = combined_encrypted[:-16]  # Everything except last 16 bytes
            auth_tag_extracted = combined_encrypted[-16:]  # Last 16 bytes
            
            # Return in the specified format (hex encoded)
            return {
                "encryptedText": encrypted_data.hex(),
                "authTag": auth_tag_extracted.hex(),
                "iv": iv.hex()
            }
            
        except Exception as e:
            logger.error(f"Encryption failed: {str(e)}")
            raise
    
    def decrypt(self, encrypted_data: Union[Dict[str, str], str]) -> Any:
        """
        Decrypt AES-256-GCM encrypted data
        
        Args:
            encrypted_data: Either a dict with encryptedText, authTag, iv keys
                          or a JSON string of such dict
                          
        Returns:
            Decrypted data (automatically parsed from JSON if possible)
        """
        try:
            # Parse if it's a JSON string
            if isinstance(encrypted_data, str):
                encrypted_data = json.loads(encrypted_data)

            # Validate required keys
            required_keys = ['encryptedText', 'authTag', 'iv']
            for key in required_keys:
                if key not in encrypted_data:
                    raise ValueError(f"Missing required key: {key} in encrypted_data")


            # Extract components (convert from hex)
            ciphertext = bytes.fromhex(encrypted_data['encryptedText'])
            auth_tag = bytes.fromhex(encrypted_data['authTag'])
            iv = bytes.fromhex(encrypted_data['iv'])

            # Convert hex key to bytes if it's a string
            if isinstance(self.key, str):
                key_bytes = bytes.fromhex(self.key)
            else:
                key_bytes = self.key
            
            # Create cipher with the tag
            cipher = Cipher(
                algorithms.AES(key_bytes),
                modes.GCM(iv, auth_tag),
                backend=default_backend()
            )
            decryptor = cipher.decryptor()
            
            # Decrypt the data
            plaintext = decryptor.update(ciphertext) + decryptor.finalize()
            # print(f"Decrypted plaintext: {plaintext}")
            
            # Try to parse as JSON, otherwise return as string
            plaintext_str = plaintext.decode('utf-8')
            try:
                print("Attempting to parse plaintext as JSON.")
                return json.loads(plaintext_str)
            except json.JSONDecodeError:
                print('Could not parse plaintext as JSON, returning as string.')
                return plaintext_str
                
        except Exception as e:
            logger.info(f"Decryption failed: {str(e)}")
            raise ValueError(f"Decryption failed: {str(e)}")
    
    @staticmethod
    def generate_key() -> str:
        """Generate a new AES-256 key and return as base64 string"""
        key = os.urandom(32)  # 256 bits
        return base64.b64encode(key).decode('utf-8')


# Main service to use in FastAPI
class CryptoService(AESGCMCryptoService):
    """
    Main crypto service that matches frontend expectations.
    Frontend sends encrypted data as the AES-GCM dict directly in config.data
    """
    pass


# Example usage and testing
if __name__ == "__main__":
    # Test the service
    print("=== Testing AES-256-GCM Crypto Service ===\n")
    
    # Initialize with a generated key
    key = AESGCMCryptoService.generate_key()
    print(f"Generated key: {key}\n")
    
    # Create service
    crypto = AESGCMCryptoService(secret_key=key)
    
    # Test data
    test_data = {
        "user": "john_doe",
        "ssn": "123-45-6789",
        "balance": 1500.50,
        "sensitive_info": "This is highly confidential"
    }
    
    print(f"Original data: {json.dumps(test_data, indent=2)}\n")
    
    # Encrypt
    encrypted = crypto.encrypt(test_data)
    print(f"Encrypted result:")
    print(json.dumps(encrypted, indent=2))
    print()
    
    # Decrypt
    decrypted = crypto.decrypt(encrypted)
    print(f"Decrypted data: {json.dumps(decrypted, indent=2)}\n")
    
    # Verify
    assert decrypted == test_data
    print("✓ Encryption/Decryption successful!\n")
    
    # Test with string data
    text_data = "This is a secret message!"
    encrypted_text = crypto.encrypt(text_data)
    decrypted_text = crypto.decrypt(encrypted_text)
    print(f"Text encryption test: '{text_data}' -> '{decrypted_text}'")
    assert decrypted_text == text_data
    print("✓ Text encryption successful!\n")
    
    # Test the compatibility wrapper
    print("=== Testing Compatibility Wrapper ===")
    compat_crypto = CryptoService(secret_key=key)
    
    # This returns a JSON string instead of dict
    encrypted_str = compat_crypto.encrypt(test_data)
    print(f"Encrypted (compat): {encrypted_str[:100]}...")
    
    # Can decrypt the JSON string
    decrypted_compat = compat_crypto.decrypt(encrypted_str)
    assert decrypted_compat == test_data
    print("✓ Compatibility mode successful!")