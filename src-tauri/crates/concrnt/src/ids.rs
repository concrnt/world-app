use bech32::{Bech32, Hrp};
use ripemd::Ripemd160;
use secp256k1::PublicKey;
use sha2::{Digest as Sha2Digest, Sha256};

use crate::Result;

pub fn compute_ccid(public_key_hex: &str) -> Result<String> {
    compute_bech32_id(public_key_hex, "con")
}

pub fn compute_ckid(public_key_hex: &str) -> Result<String> {
    compute_bech32_id(public_key_hex, "cck")
}

fn compute_bech32_id(public_key_hex: &str, prefix: &str) -> Result<String> {
    let public_key_bytes =
        hex::decode(public_key_hex).map_err(|_| "public key is not valid hex".to_string())?;
    let public_key =
        PublicKey::from_slice(&public_key_bytes).map_err(|_| "invalid public key bytes".to_string())?;
    let compressed_pubkey = public_key.serialize();

    let sha_hash = Sha256::digest(compressed_pubkey);
    let raw_address = Ripemd160::digest(sha_hash);

    let hrp = Hrp::parse(prefix).map_err(|_| "invalid HRP for bech32 encoding".to_string())?;
    let bech32 = bech32::encode::<Bech32>(hrp, &raw_address)
        .map_err(|_| "failed to encode bech32 address".to_string())?;
    Ok(bech32)
}
