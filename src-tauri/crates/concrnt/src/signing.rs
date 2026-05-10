use secp256k1::{Message, Secp256k1, SecretKey};
use sha3::{Digest as Sha3Digest, Keccak256};

use crate::Result;

pub fn sign(private_key_hex: &str, payload: &str) -> Result<String> {
    let private_key_bytes =
        hex::decode(private_key_hex).map_err(|_| "private key is not valid hex".to_string())?;
    let secret_key =
        SecretKey::from_slice(&private_key_bytes).map_err(|_| "invalid private key bytes".to_string())?;

    let message_hash = Keccak256::digest(payload.as_bytes());
    let message = Message::from_digest_slice(&message_hash)
        .map_err(|_| "failed to create message from payload hash".to_string())?;
    let secp = Secp256k1::new();
    let signature = secp.sign_ecdsa_recoverable(&message, &secret_key);
    let (recovery_id, compact) = signature.serialize_compact();

    let r = hex::encode(&compact[..32]);
    let s = hex::encode(&compact[32..64]);
    let v = match recovery_id.to_i32() {
        0 => "00",
        1 => "01",
        _ => return Err("invalid recovery id".into()),
    };

    Ok(format!("{r}{s}{v}"))
}
