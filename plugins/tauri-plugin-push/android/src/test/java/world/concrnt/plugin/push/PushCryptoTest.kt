package world.concrnt.plugin.push

import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.Base64

/**
 * Validates PushCrypto.decrypt against the official RFC 8291 Section 5 test
 * vector. This exact vector + algorithm (HKDF-SHA256 with the "WebPush: info"
 * key-derivation label, "Content-Encoding: aes128gcm"/"Content-Encoding: nonce"
 * derivation, AES-128-GCM, trailing 0x02 padding delimiter) was independently
 * verified against both Python's `cryptography` library and plain JCA
 * (KeyAgreement/Mac/Cipher) before being ported here.
 */
class PushCryptoTest {
    private fun b64d(s: String): ByteArray {
        val padded = s + "=".repeat((4 - s.length % 4) % 4)
        return Base64.getUrlDecoder().decode(padded)
    }

    @Test
    fun `decrypts the RFC 8291 section 5 test vector`() {
        val uaPrivate = PushCrypto.decodePrivateKeyRaw(b64d("q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94"))
        val uaPublicBytes = b64d("BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4")
        val auth = b64d("BTBZMqHH6r4Tts7J_aSIgg")
        val body = b64d(
            "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8w" +
                "EqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN"
        )

        val plaintext = PushCrypto.decrypt(body, uaPrivate, uaPublicBytes, auth)

        assertEquals("When I grow up, I want to be a watermelon", String(plaintext, Charsets.UTF_8))
    }
}
