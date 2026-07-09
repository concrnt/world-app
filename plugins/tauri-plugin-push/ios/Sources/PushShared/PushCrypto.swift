import Foundation
import CryptoKit

/// RFC 8188 ("aes128gcm") / RFC 8291 (WebPush) decryption.
///
/// Body layout: salt(16) | record-size(4, big-endian) | keyid-length(1) |
/// keyid(65, uncompressed P-256 point = the application server's ephemeral
/// public key) | ciphertext(AES-128-GCM, 16-byte tag appended).
///
/// Algorithm verified against the official RFC 8291 Section 5 test vector
/// (see PushCryptoTests.swift) using Python's `cryptography` library and
/// plain Java JCA before being ported to CryptoKit; the Android plugin
/// (PushCrypto.kt) implements the identical algorithm.
public enum PushCrypto {
    public enum DecryptionError: Error {
        case bodyTooShort
        case unexpectedKeyIdLength(Int)
        case bodyTruncated
        case missingPaddingDelimiter
    }

    private static let keyInfoPrefix: [UInt8] = Array("WebPush: info".utf8) + [0x00]
    private static let cekInfo: [UInt8] = Array("Content-Encoding: aes128gcm".utf8) + [0x00]
    private static let nonceInfo: [UInt8] = Array("Content-Encoding: nonce".utf8) + [0x00]

    /// Decrypts an "aes128gcm"-encoded WebPush body.
    ///
    /// - Parameters:
    ///   - body: the raw bytes POSTed by the WebPush sender (forwarded through
    ///     the relay unchanged; caller base64url-decodes before calling this)
    ///   - privateKey: the subscription's P-256 private key
    ///   - uaPublicBytes: the subscription's own uncompressed public key point
    ///     (x963Representation, as stored alongside privateKey)
    ///   - auth: the subscription's 16-byte auth secret
    public static func decrypt(
        body: Data,
        privateKey: P256.KeyAgreement.PrivateKey,
        uaPublicBytes: Data,
        auth: Data
    ) throws -> Data {
        guard body.count > 21 else { throw DecryptionError.bodyTooShort }

        let salt = body.subdata(in: 0..<16)
        let idlen = Int(body[body.startIndex + 20])
        guard idlen == 65 else { throw DecryptionError.unexpectedKeyIdLength(idlen) }
        guard body.count >= 21 + idlen else { throw DecryptionError.bodyTruncated }

        let asPublicBytes = body.subdata(in: 21..<(21 + idlen))
        let ciphertext = body.subdata(in: (21 + idlen)..<body.count)

        let serverPublicKey = try P256.KeyAgreement.PublicKey(x963Representation: asPublicBytes)
        let sharedSecret = try privateKey.sharedSecretFromKeyAgreement(with: serverPublicKey)

        var keyInfo = Data(keyInfoPrefix)
        keyInfo.append(uaPublicBytes)
        keyInfo.append(asPublicBytes)

        let ikm = sharedSecret.hkdfDerivedSymmetricKey(
            using: SHA256.self,
            salt: auth,
            sharedInfo: keyInfo,
            outputByteCount: 32
        )

        let cek = HKDF<SHA256>.deriveKey(
            inputKeyMaterial: ikm,
            salt: salt,
            info: Data(cekInfo),
            outputByteCount: 16
        )
        let nonceKey = HKDF<SHA256>.deriveKey(
            inputKeyMaterial: ikm,
            salt: salt,
            info: Data(nonceInfo),
            outputByteCount: 12
        )

        let nonceBytes = nonceKey.withUnsafeBytes { Data($0) }
        let nonce = try AES.GCM.Nonce(data: nonceBytes)

        guard ciphertext.count > 16 else { throw DecryptionError.bodyTruncated }
        let tag = ciphertext.suffix(16)
        let encrypted = ciphertext.dropLast(16)
        let sealedBox = try AES.GCM.SealedBox(nonce: nonce, ciphertext: encrypted, tag: tag)
        var plainPadded = try AES.GCM.open(sealedBox, using: cek)

        while plainPadded.last == 0x00 {
            plainPadded.removeLast()
        }
        guard plainPadded.last == 0x02 else { throw DecryptionError.missingPaddingDelimiter }
        plainPadded.removeLast()

        return plainPadded
    }
}
