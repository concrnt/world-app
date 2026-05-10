mod identity;
mod ids;
mod mnemonic;
mod signing;

pub use identity::{derive_keypair, generate_identity, load_identity, Identity};
pub use ids::{compute_ccid, compute_ckid};
pub use mnemonic::{mnemonic_en2ja, mnemonic_ja2en, normalize_nfkd};
pub use signing::sign;

pub type Error = String;
pub type Result<T> = std::result::Result<T, Error>;

#[cfg(test)]
mod tests {
    use super::*;

    const ENGLISH_MNEMONIC: &str =
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    #[test]
    fn loads_english_identity() {
        let identity = load_identity(ENGLISH_MNEMONIC).expect("identity should load");

        assert_eq!(identity.mnemonic, ENGLISH_MNEMONIC);
        assert_eq!(identity.private_key.len(), 64);
        assert_eq!(identity.public_key.len(), 130);
        assert!(identity.ccid.starts_with("con1"));
    }

    #[test]
    fn converts_japanese_mnemonic_back_to_english() {
        let japanese = mnemonic_en2ja(ENGLISH_MNEMONIC).expect("english to japanese");
        let english = mnemonic_ja2en(&japanese).expect("japanese to english");

        assert_eq!(english, ENGLISH_MNEMONIC);
    }

    #[test]
    fn signs_payload_with_derived_key() {
        let identity = load_identity(ENGLISH_MNEMONIC).expect("identity should load");
        let signature = sign(&identity.private_key, "payload").expect("signature should be created");

        assert_eq!(signature.len(), 130);
    }
}
