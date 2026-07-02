package ghup

import (
	"crypto/hmac"
	"crypto/sha256"
)

func GenHMAC256(ciphertext, key []byte) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write(ciphertext)
	return mac.Sum(nil)
}
