use bip32::{DerivationPath, XPrv};
use bip39::{Language, Mnemonic};
use secp256k1::{PublicKey, Secp256k1, SecretKey};

use crate::ids::compute_ccid;
use crate::mnemonic::{mnemonic_en2ja, mnemonic_ja2en, normalize_nfkd};
use crate::Result;

const HD_PATH: &str = "m/44'/118'/0'/0/0";

#[derive(Debug, Clone, serde::Serialize)]
pub struct Identity {
    pub mnemonic: String,
    pub mnemonic_ja: String,
    pub private_key: String,
    pub public_key: String,
    pub ccid: String,
}

pub fn generate_identity() -> Result<Identity> {
    let mnemonic = Mnemonic::generate_in(Language::English, 12)
        .map_err(|_| "failed to generate mnemonic".to_string())?;
    let mnemonic_en = normalize_nfkd(&mnemonic.to_string());
    let mnemonic_ja = mnemonic_en2ja(&mnemonic_en)
        .map_err(|_| "failed to convert mnemonic to Japanese".to_string())?;

    let (private_key, public_key) = derive_keypair(&mnemonic_en)
        .map_err(|_| "failed to derive keypair from mnemonic".to_string())?;
    let ccid = compute_ccid(&public_key)?;

    Ok(Identity {
        mnemonic: mnemonic_en,
        mnemonic_ja,
        private_key,
        public_key,
        ccid,
    })
}

pub fn load_identity(mnemonic: &str) -> Result<Identity> {
    let normalized = normalize_nfkd(mnemonic);
    if normalized.split(' ').count() != 12 {
        return Err("Mnemonic must be 12 words".into());
    }

    let first = normalized.chars().next().unwrap_or_default();
    let (mnemonic_en, mnemonic_ja) = if first.is_ascii_lowercase() {
        (normalized.clone(), mnemonic_en2ja(&normalized)?)
    } else {
        (mnemonic_ja2en(&normalized)?, normalized.clone())
    };

    let (private_key, public_key) = derive_keypair(&mnemonic_en)?;
    let ccid = compute_ccid(&public_key)?;

    Ok(Identity {
        mnemonic: mnemonic_en,
        mnemonic_ja,
        private_key,
        public_key,
        ccid,
    })
}

pub fn derive_keypair(mnemonic_en: &str) -> Result<(String, String)> {
    let mnemonic = Mnemonic::parse_in(Language::English, &normalize_nfkd(mnemonic_en))
        .map_err(|_| "invalid mnemonic format".to_string())?;
    let seed = mnemonic.to_seed("");
    let path: DerivationPath = HD_PATH
        .parse()
        .map_err(|_| "invalid HD path format".to_string())?;
    let xprv = XPrv::derive_from_path(seed, &path)
        .map_err(|_| "failed to derive xprv from seed and path".to_string())?;
    let private_key_bytes = xprv.private_key().to_bytes();

    let secp = Secp256k1::new();
    let secret_key = SecretKey::from_slice(&private_key_bytes)
        .map_err(|_| "invalid private key bytes for secp256k1".to_string())?;
    let public_key = PublicKey::from_secret_key(&secp, &secret_key);

    let private_key = hex::encode(private_key_bytes);
    let public_key = hex::encode(public_key.serialize_uncompressed());

    Ok((private_key, public_key))
}
