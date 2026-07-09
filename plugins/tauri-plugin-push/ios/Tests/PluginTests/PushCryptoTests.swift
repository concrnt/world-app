import XCTest
import CryptoKit
@testable import PushShared

/// Validates PushCrypto.decrypt against the official RFC 8291 Section 5 test
/// vector. This exact vector + algorithm (HKDF-SHA256 with the "WebPush: info"
/// key-derivation label, "Content-Encoding: aes128gcm"/"Content-Encoding: nonce"
/// derivation, AES-128-GCM, trailing 0x02 padding delimiter) was independently
/// verified against both Python's `cryptography` library and plain Java JCA
/// before being ported here; the Android plugin (PushCrypto.kt) implements the
/// identical algorithm and is verified against the same vector.
final class PushCryptoTests: XCTestCase {
    private func b64d(_ s: String) -> Data {
        var padded = s
        let remainder = s.count % 4
        if remainder > 0 {
            padded += String(repeating: "=", count: 4 - remainder)
        }
        return Data(base64Encoded: padded.replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/"))!
    }

    func testDecryptsRfc8291SectionFiveVector() throws {
        let uaPrivate = try P256.KeyAgreement.PrivateKey(
            rawRepresentation: b64d("q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94")
        )
        let uaPublicBytes = b64d("BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4")
        let auth = b64d("BTBZMqHH6r4Tts7J_aSIgg")
        let body = b64d(
            "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8w" +
            "EqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN"
        )

        let plaintext = try PushCrypto.decrypt(body: body, privateKey: uaPrivate, uaPublicBytes: uaPublicBytes, auth: auth)

        XCTAssertEqual(String(data: plaintext, encoding: .utf8), "When I grow up, I want to be a watermelon")
    }
}
