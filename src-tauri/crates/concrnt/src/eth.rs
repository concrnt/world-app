use bip32::{DerivationPath, XPrv};
use bip39::{Language, Mnemonic};
use secp256k1::{Message, PublicKey, Secp256k1, SecretKey};
use sha3::{Digest as Sha3Digest, Keccak256};

use crate::mnemonic::normalize_nfkd;
use crate::Result;

// Concrnt (m/44'/118'/0'/0/0, Cosmos) と同じmnemonicから、Ethereum標準パスで別の鍵を派生する。
// MetaMask等と同じパスなので、同じmnemonicをインポートすれば同じアドレスになる。
const ETH_HD_PATH: &str = "m/44'/60'/0'/0/0";

#[derive(Debug, Clone, serde::Serialize)]
pub struct EthIdentity {
    /// 32バイト秘密鍵のhex(0xプレフィックス無し)
    pub private_key: String,
    /// EIP-55チェックサム付きアドレス(0xプレフィックス付き)
    pub address: String,
}

pub fn derive_eth_identity(mnemonic_en: &str) -> Result<EthIdentity> {
    let mnemonic = Mnemonic::parse_in(Language::English, &normalize_nfkd(mnemonic_en))
        .map_err(|_| "invalid mnemonic format".to_string())?;
    let seed = mnemonic.to_seed("");
    let path: DerivationPath = ETH_HD_PATH
        .parse()
        .map_err(|_| "invalid HD path format".to_string())?;
    let xprv = XPrv::derive_from_path(seed, &path)
        .map_err(|_| "failed to derive xprv from seed and path".to_string())?;
    let private_key_bytes = xprv.private_key().to_bytes();

    let secp = Secp256k1::new();
    let secret_key = SecretKey::from_slice(&private_key_bytes)
        .map_err(|_| "invalid private key bytes for secp256k1".to_string())?;
    let public_key = PublicKey::from_secret_key(&secp, &secret_key);

    Ok(EthIdentity {
        private_key: hex::encode(private_key_bytes),
        address: eth_address_from_pubkey(&public_key),
    })
}

/// 非圧縮公開鍵(0x04を除いた64バイト)のkeccak256の下位20バイトをEIP-55形式で返す。
fn eth_address_from_pubkey(public_key: &PublicKey) -> String {
    let uncompressed = public_key.serialize_uncompressed();
    let hash = Keccak256::digest(&uncompressed[1..]);
    to_checksum_address(&hash[12..])
}

fn to_checksum_address(raw: &[u8]) -> String {
    let lower = hex::encode(raw);
    let hash = Keccak256::digest(lower.as_bytes());
    let mut out = String::with_capacity(42);
    out.push_str("0x");
    for (i, c) in lower.chars().enumerate() {
        let nibble = if i % 2 == 0 {
            hash[i / 2] >> 4
        } else {
            hash[i / 2] & 0x0f
        };
        if c.is_ascii_alphabetic() && nibble >= 8 {
            out.push(c.to_ascii_uppercase());
        } else {
            out.push(c);
        }
    }
    out
}

fn strip_0x(s: &str) -> &str {
    s.strip_prefix("0x").or_else(|| s.strip_prefix("0X")).unwrap_or(s)
}

/// 32バイトのダイジェストに署名し、Ethereum形式の65バイト署名 `0x{r}{s}{v}` (v = 27/28) を返す。
/// トランザクション署名(EIP-155/EIP-1559のsigning hash)、personal_sign、EIP-712など
/// あらゆるEthereum署名の共通プリミティブ。ハッシュ計算・RLPエンコードはJS側(viem等)で行う。
pub fn eth_sign_hash(private_key_hex: &str, hash_hex: &str) -> Result<String> {
    let private_key_bytes =
        hex::decode(private_key_hex).map_err(|_| "private key is not valid hex".to_string())?;
    let secret_key =
        SecretKey::from_slice(&private_key_bytes).map_err(|_| "invalid private key bytes".to_string())?;

    let hash = hex::decode(strip_0x(hash_hex)).map_err(|_| "hash is not valid hex".to_string())?;
    if hash.len() != 32 {
        return Err("hash must be 32 bytes".into());
    }
    let message = Message::from_digest_slice(&hash)
        .map_err(|_| "failed to create message from hash".to_string())?;

    let secp = Secp256k1::new();
    let signature = secp.sign_ecdsa_recoverable(&message, &secret_key);
    let (recovery_id, compact) = signature.serialize_compact();
    let v = 27 + recovery_id.to_i32() as u8;

    Ok(format!("0x{}{:02x}", hex::encode(compact), v))
}

/// EIP-191 (personal_sign) のハッシュ: keccak256("\x19Ethereum Signed Message:\n" + len + message)
pub fn eth_message_hash(message: &[u8]) -> String {
    let mut hasher = Keccak256::new();
    hasher.update(b"\x19Ethereum Signed Message:\n");
    hasher.update(message.len().to_string().as_bytes());
    hasher.update(message);
    hex::encode(hasher.finalize())
}

pub fn eth_sign_message(private_key_hex: &str, message: &[u8]) -> Result<String> {
    eth_sign_hash(private_key_hex, &eth_message_hash(message))
}

#[cfg(test)]
mod tests {
    use super::*;

    const MNEMONIC: &str =
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

    #[test]
    fn derives_well_known_address() {
        // https://github.com/ethereum/tests のBIP44テストベクタ / MetaMaskの既知値
        let id = derive_eth_identity(MNEMONIC).expect("derive");
        assert_eq!(id.address, "0x9858EfFD232B4033E47d90003D41EC34EcaEda94");
        assert_eq!(
            id.private_key,
            "1ab42cc412b618bdea3a599e3c9bae199ebf030895b039e9db1e30dafb12b727"
        );
    }

    #[test]
    fn checksums_address() {
        let raw = hex::decode("fb6916095ca1df60bb79ce92ce3ea74c37c5d359").unwrap();
        assert_eq!(to_checksum_address(&raw), "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359");
    }

    #[test]
    fn signs_hash_with_ethereum_v() {
        let id = derive_eth_identity(MNEMONIC).expect("derive");
        let sig = eth_sign_hash(&id.private_key, &"11".repeat(32)).expect("sign");
        assert_eq!(sig.len(), 2 + 130);
        assert!(sig.ends_with("1b") || sig.ends_with("1c"));
        // 0xプレフィックス付きも受け付ける
        let sig2 = eth_sign_hash(&id.private_key, &format!("0x{}", "11".repeat(32))).expect("sign");
        assert_eq!(sig, sig2);
        assert!(eth_sign_hash(&id.private_key, "1234").is_err());
    }

    #[test]
    fn signs_personal_message_recoverably() {
        use secp256k1::ecdsa::{RecoverableSignature, RecoveryId};

        let id = derive_eth_identity(MNEMONIC).expect("derive");
        let sig = eth_sign_message(&id.private_key, b"hello").expect("sign");
        let bytes = hex::decode(strip_0x(&sig)).unwrap();
        let rec_id = RecoveryId::from_i32((bytes[64] - 27) as i32).unwrap();
        let rsig = RecoverableSignature::from_compact(&bytes[..64], rec_id).unwrap();
        let hash = hex::decode(eth_message_hash(b"hello")).unwrap();
        let msg = Message::from_digest_slice(&hash).unwrap();
        let pubkey = Secp256k1::new().recover_ecdsa(&msg, &rsig).unwrap();
        assert_eq!(eth_address_from_pubkey(&pubkey), id.address);
    }
}
