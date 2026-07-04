package world.concrnt.plugin.push

import java.math.BigInteger
import java.security.AlgorithmParameters
import java.security.KeyAgreement
import java.security.KeyFactory
import java.security.spec.ECGenParameterSpec
import java.security.spec.ECParameterSpec
import java.security.spec.ECPoint
import java.security.spec.ECPrivateKeySpec
import java.security.spec.ECPublicKeySpec
import java.security.interfaces.ECPrivateKey
import java.security.interfaces.ECPublicKey
import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * RFC 8188 ("aes128gcm") / RFC 8291 (WebPush) decryption.
 *
 * Body layout: salt(16) | record-size(4, big-endian) | keyid-length(1) |
 * keyid(65, uncompressed P-256 point = the application server's ephemeral
 * public key) | ciphertext(AES-128-GCM, 16-byte tag appended).
 *
 * Algorithm verified against the official RFC 8291 Section 5 test vector
 * (see PushCryptoTest.kt) using this exact JCA API surface.
 */
object PushCrypto {
    private val secp256r1Params: ECParameterSpec by lazy {
        val params = AlgorithmParameters.getInstance("EC")
        params.init(ECGenParameterSpec("secp256r1"))
        params.getParameterSpec(ECParameterSpec::class.java)
    }

    private const val FIELD_SIZE = 32

    // RFC 8291 uses a null-terminated ASCII label as HKDF "info"/context.
    private val KEY_INFO_PREFIX = byteArrayOf(
        'W'.code.toByte(), 'e'.code.toByte(), 'b'.code.toByte(), 'P'.code.toByte(), 'u'.code.toByte(),
        's'.code.toByte(), 'h'.code.toByte(), ':'.code.toByte(), ' '.code.toByte(),
        'i'.code.toByte(), 'n'.code.toByte(), 'f'.code.toByte(), 'o'.code.toByte(), 0x00
    )
    private val CEK_INFO = "Content-Encoding: aes128gcm".toByteArray(Charsets.US_ASCII) + byteArrayOf(0x00)
    private val NONCE_INFO = "Content-Encoding: nonce".toByteArray(Charsets.US_ASCII) + byteArrayOf(0x00)

    fun decodeUncompressedP256(point: ByteArray): ECPublicKey {
        require(point.size == 2 * FIELD_SIZE + 1 && point[0] == 0x04.toByte()) {
            "not an uncompressed P-256 point"
        }
        val x = BigInteger(1, point.copyOfRange(1, 1 + FIELD_SIZE))
        val y = BigInteger(1, point.copyOfRange(1 + FIELD_SIZE, 1 + 2 * FIELD_SIZE))
        val spec = ECPublicKeySpec(ECPoint(x, y), secp256r1Params)
        return KeyFactory.getInstance("EC").generatePublic(spec) as ECPublicKey
    }

    fun encodeUncompressedP256(publicKey: ECPublicKey): ByteArray {
        val x = unsignedBytes(publicKey.w.affineX, FIELD_SIZE)
        val y = unsignedBytes(publicKey.w.affineY, FIELD_SIZE)
        return byteArrayOf(0x04) + x + y
    }

    fun decodePrivateKeyRaw(scalar: ByteArray): ECPrivateKey {
        val spec = ECPrivateKeySpec(BigInteger(1, scalar), secp256r1Params)
        return KeyFactory.getInstance("EC").generatePrivate(spec) as ECPrivateKey
    }

    fun encodePrivateKeyRaw(privateKey: ECPrivateKey): ByteArray = unsignedBytes(privateKey.s, FIELD_SIZE)

    private fun unsignedBytes(value: BigInteger, length: Int): ByteArray {
        val raw = value.toByteArray()
        // BigInteger.toByteArray() may include a leading sign byte, or be
        // shorter than `length` if the value has leading zero bytes.
        val trimmed = if (raw.size > length) raw.copyOfRange(raw.size - length, raw.size) else raw
        if (trimmed.size == length) return trimmed
        val padded = ByteArray(length)
        System.arraycopy(trimmed, 0, padded, length - trimmed.size, trimmed.size)
        return padded
    }

    private fun hmacSha256(key: ByteArray, data: ByteArray): ByteArray {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(key, "HmacSHA256"))
        return mac.doFinal(data)
    }

    private fun hkdfExtract(salt: ByteArray, ikm: ByteArray): ByteArray = hmacSha256(salt, ikm)

    private fun hkdfExpand(prk: ByteArray, info: ByteArray, length: Int): ByteArray {
        var t = ByteArray(0)
        var output = ByteArray(0)
        var counter = 1
        while (output.size < length) {
            t = hmacSha256(prk, t + info + byteArrayOf(counter.toByte()))
            output += t
            counter++
        }
        return output.copyOfRange(0, length)
    }

    class DecryptionException(message: String) : Exception(message)

    /**
     * Decrypts an "aes128gcm"-encoded WebPush body.
     *
     * @param body the raw bytes POSTed by the WebPush sender (forwarded through
     *   the relay unchanged; caller base64url-decodes before calling this)
     * @param privateKey the subscription's P-256 private key
     * @param uaPublicBytes the subscription's own uncompressed public key point
     *   (as returned alongside privateKey by PushKeyStore.getOrCreateKeys)
     * @param auth the subscription's 16-byte auth secret
     */
    fun decrypt(
        body: ByteArray,
        privateKey: ECPrivateKey,
        uaPublicBytes: ByteArray,
        auth: ByteArray
    ): ByteArray {
        if (body.size <= 21) throw DecryptionException("body too short")
        val salt = body.copyOfRange(0, 16)
        val idlen = body[20].toInt() and 0xff
        if (idlen != 2 * FIELD_SIZE + 1) throw DecryptionException("unexpected keyid length: $idlen")
        if (body.size < 21 + idlen) throw DecryptionException("body truncated before keyid")
        val asPublicBytes = body.copyOfRange(21, 21 + idlen)
        val ciphertext = body.copyOfRange(21 + idlen, body.size)

        val serverPublicKey = decodeUncompressedP256(asPublicBytes)
        val ka = KeyAgreement.getInstance("ECDH")
        ka.init(privateKey)
        ka.doPhase(serverPublicKey, true)
        val sharedSecret = ka.generateSecret()

        val keyInfo = KEY_INFO_PREFIX + uaPublicBytes + asPublicBytes
        val ikm = hkdfExpand(hkdfExtract(auth, sharedSecret), keyInfo, 32)

        val prk = hkdfExtract(salt, ikm)
        val cek = hkdfExpand(prk, CEK_INFO, 16)
        val nonce = hkdfExpand(prk, NONCE_INFO, 12)

        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(cek, "AES"), GCMParameterSpec(128, nonce))
        val plainPadded = cipher.doFinal(ciphertext)

        var end = plainPadded.size
        while (end > 0 && plainPadded[end - 1] == 0.toByte()) end--
        if (end == 0 || plainPadded[end - 1] != 0x02.toByte()) {
            throw DecryptionException("missing 0x02 padding delimiter")
        }
        return plainPadded.copyOfRange(0, end - 1)
    }
}
